// server/whatsapp.mjs — view-once AUTO-CAPTURE + X AGENT + OWN ANTIBAN.
//
// Changes vs. previous version:
//   1. baileys-antiban removed (it was crashing on wrapper.js:340).
//   2. Own throttle inside safeSendMessage:
//        - serializes sends per-JID
//        - 1.5–4s human-like jitter between sends to the same chat
//        - 10 msgs/min hard cap per chat, excess waits out the window
//   3. DM handling stays (inbound only), agent hook stays, viewonce
//      stays, quote-replies stay.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { promises as fsp } from 'node:fs'

import { usePostgresAuthState } from './pg-auth-store.mjs'

import P from 'pino'
import QRCode from 'qrcode'

/* [X AGENT] */
import {
  shouldReply,
  markReplied,
  isAgentEnabled,
  detectMentionOfX,
  detectReplyToX,
  shouldReplyToDM
} from './vibe.mjs'

import {
  learnFromMessage,
  generateReply,
  filterDMResponse
} from './agent.mjs'

import { logDM, chatCountSince } from './memory.mjs'

import db from './db.mjs'

import { currentName } from './persona.mjs'

/* [ANTIDELETE] */
import {
  MessageStore,
  extractRevoke,
  unwrapViewOnce,
  downloadViewOnce
} from './anti-delete.mjs'

import {
  getGroup,
  listGroups,
  listMembers,
  groupStats,
  upsertGroup,
  updateGroupSettings,
  replaceMembers,
  getMember,
  findMemberByIdentity,
  updateMemberIdentity,
  getMemberDisplayName as resolveStoredMemberDisplayName,
  touchMember,
  awardXP,
  leaderboard,
  getBotMode,
  warning,
  warningCount,
  clearWarnings,
  addAudit,
  getCommandAsset,
  isBanned,
  getTenant,
  setTenantOwner,
  logTenantActivity,
  logConnectionEvent,
  setBoardMessageId,
  getGameByBoardMessageId,
  getAntideleteMode
} from './db.mjs'

import {
  renderTemplate,
  renderWelcomeStyle,
  renderGoodbyeStyle,
  createMention,
  welcomeStyles,
  goodbyeStyles
} from './templates.mjs'

import { executeCommand } from './commands.mjs'
import { handleMangaSelection } from './commands.mjs'
import { answerWithConfiguredProvider } from './ai-context.mjs'
import { eventCard, commandCard } from './graphics.mjs'

import {
  identityFromMessage,
  roleFor,
  can,
  configuredOwnerIdentifiers,
  candidateIdentityValues,
  isOwner as rbacIsOwner
} from './rbac.mjs'

import { huntIfRival } from './bot-hunter.mjs'


/* -------------------------------------------------------------------------- */
/* Reaction emoji resolver                                                    */
/* -------------------------------------------------------------------------- */

const CATEGORY_REACTIONS = {
  core: '⚡',
  group: '👥',
  moderation: '🛡️',
  profile: '👤',
  economy: '💰',
  games: '🎮',
  anime: '🌸',
  manga: '📚',
  media: '🎬',
  actions: '🎭',
  ai: '🧠',
  owner: '👑',
  utilities: '🔧',
  other: '👀'
}

function reactionFor(command) {
  if (!command) return '👀'
  if (command.reaction) return command.reaction
  const category = String(command.category || 'other').toLowerCase()
  return CATEGORY_REACTIONS[category] || '👀'
}


/* -------------------------------------------------------------------------- */
/* View-once vault root                                                       */
/* -------------------------------------------------------------------------- */

const VIEWONCE_ROOT = path.resolve(
  process.env.X_VIEWONCE_DIR || './data/viewonce_vault'
)

fs.mkdirSync(VIEWONCE_ROOT, { recursive: true })


/* -------------------------------------------------------------------------- */
/* File helpers                                                               */
/* -------------------------------------------------------------------------- */

function extFromMime(mime = '') {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/3gpp': '3gp',
    'audio/ogg': 'ogg',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3'
  }
  return map[mime.split(';')[0].trim()] || 'bin'
}

function safeFileName(str = '') {
  return String(str)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80)
}


/* -------------------------------------------------------------------------- */
/* Own antiban constants                                                      */
/* -------------------------------------------------------------------------- */

const SEND_MIN_DELAY_MS = 1500
const SEND_MAX_JITTER_MS = 2500
const SEND_PER_CHAT_PER_MIN = 10

const norm = v => String(v || '').trim().toLowerCase()
const digits = v => String(v || '').replace(/\D/g, '')
const jidUser = v => {
  const s = String(v || '').trim()
  if (!s) return ''
  const at = s.indexOf('@')
  const beforeAt = at === -1 ? s : s.slice(0, at)
  const colon = beforeAt.indexOf(':')
  return colon === -1 ? beforeAt : beforeAt.slice(0, colon)
}

export class WhatsAppRuntime {
  constructor(tenantId = 'default') {
    this.tenantId = tenantId
    this.intentionalShutdown = false
    this.groupCount = 0
    this.sock = null
    this.qr = null
    this.status = 'disconnected'
    this.lastError = null
    this.registered = false
    this.warmode = false

    this.authDir =
      tenantId === 'default'
        ? path.resolve(process.env.WHATSAPP_AUTH_DIR || './auth/x')
        : path.resolve('./auth', `x-${tenantId}`)

    this.cooldowns = new Map()
    this.spamBuckets = new Map()

    /* [OWN ANTIBAN] — per-chat send throttle */
    this._sendTimestamps = new Map()

    /* [X AGENT] — per-group last unprompted drop */
    this._lastUnprompted = new Map()

    this.connecting = false
    this.reconnectTimer = null
    this.connectionGeneration = 0
    this.syncingGroups = false
    this.lastWelcomeStyles = new Map()
    this.memberAvatarCache = new Map()

    /* [ANTIDELETE] */
    this.antideleteDebug =
      String(process.env.X_ANTIDELETE_DEBUG || '') === '1'

    this.messageStore = new MessageStore({
      tenantId: this.tenantId,
      maxMessagesPerChat: 1000,
      ttl: 24 * 60 * 60 * 1000,
      debug: this.antideleteDebug
    })

    fs.mkdirSync(this.authDir, { recursive: true })
  }


  /* -----------------------------------------------------
   * Connection state
   * --------------------------------------------------- */

  isConnected() {
    return Boolean(this.sock && this.status === 'connected')
  }


  markDisconnected(error = null) {
    if (error) {
      this.lastError = error?.message || String(error)
    }
    if (this.status !== 'logged_out') {
      this.status = 'reconnecting'
    }
  }


  makeMention(jid) {
    return createMention(jid).text || ''
  }


  listAdmins(groupId) {
    return listMembers(this.tenantId, groupId, 100, 0).filter(
      (m) => m.role === 'admin' || m.role === 'superadmin'
    )
  }


  /* -----------------------------------------------------
   * Reactions
   * --------------------------------------------------- */

  async reactTo(jid, messageKey, emoji) {
    if (!this.isConnected() || !this.sock) return false
    if (!jid || !messageKey) return false
    if (!emoji) return false

    try {
      await this.safeSendMessage(
        jid,
        { react: { text: emoji, key: messageKey } },
        { label: 'reaction' }
      )
      return true
    } catch (error) {
      console.warn('[X REACTION] failed:', error?.message || error)
      return false
    }
  }


  /* -----------------------------------------------------
   * Safe reconnect scheduler
   * --------------------------------------------------- */

  scheduleReconnect(delay = 2500) {
    if (this.status === 'logged_out') return
    if (this.intentionalShutdown) return
    if (this.reconnectTimer) return

    this.status = 'reconnecting'

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      if (this.status === 'logged_out') return
      if (this.intentionalShutdown) return

      try {
        await this.connect()
      } catch (error) {
        this.lastError = error?.message || String(error)
        this.scheduleReconnect(Math.min(delay * 2, 15000))
      }
    }, delay)
  }


  /* -----------------------------------------------------
   * Main connection
   * --------------------------------------------------- */

  async connect() {
    if (this.connecting || this.status === 'connected') {
      return this.status
    }

    this.intentionalShutdown = false
    this.connecting = true
    const generation = ++this.connectionGeneration

    try {
      const baileys = await import('@whiskeysockets/baileys')

      const {
        default: makeWASocket,
        DisconnectReason,
        Browsers,
        fetchLatestBaileysVersion
      } = baileys

      const { state, saveCreds } = await usePostgresAuthState(`x-bot-${this.tenantId}`)

      this.registered = !!state.creds.registered
      this.status = 'connecting'
      this.lastError = null

      let version
      try {
        version = (await fetchLatestBaileysVersion()).version
      } catch (error) {
        console.warn('[X WHATSAPP] Could not fetch latest Baileys version:', error?.message || error)
      }

      const sock = makeWASocket({
        auth: state,
        browser: Browsers.ubuntu('X Bot'),
        printQRInTerminal: false,
        version: version || [4, 23, 9],
        qrTimeout: 120_000,

        getMessage: async () => undefined,
        markOnlineOnConnect: false,

        connectTimeoutMs: 60_000,
        defaultQueryTimeoutMs: 120_000,
        retryRequestDelayMs: 500
      })

      this.sock = sock

      /* =========================================================
       * [ANTIDELETE] Raw event tap.
       * ========================================================= */
      sock.ev.process(async (events) => {
        try {
          const upsert = events['messages.upsert']

          if (upsert?.messages?.length) {
            for (const message of upsert.messages) {
              try {
                this.messageStore.storeMessage(message)

                if (message?.message && !message?.key?.fromMe) {
                  try {
                    await this.captureViewOnce(
                      message.key.remoteJid,
                      message,
                      message.key.participant || message.key.remoteJid,
                      null
                    )
                  } catch (captureError) {
                    if (this.antideleteDebug) {
                      console.warn(
                        '[X VIEWONCE] raw auto-capture failed:',
                        captureError?.message || captureError
                      )
                    }
                  }
                }

                if (this.antideleteDebug) {
                  const inner = message?.message
                  const hasBody = Boolean(inner)
                  const kind = this.messageStore.getKind(
                    message?.key?.remoteJid,
                    message?.key?.id
                  )

                  console.log('[X CACHE-RAW]', {
                    type: upsert.type,
                    chat: message?.key?.remoteJid,
                    id: message?.key?.id,
                    fromMe: message?.key?.fromMe,
                    kind,
                    hasBody,
                    innerKeys: hasBody ? Object.keys(inner) : null
                  })
                }
              } catch (cacheError) {
                console.warn(
                  '[X ANTIDELETE] raw cache failed:',
                  cacheError?.message || cacheError
                )
              }
            }
          }

          const update = events['messages.update']

          if (Array.isArray(update)) {
            for (const u of update) {
              try {
                const revoke = extractRevoke(u)
                if (!revoke) continue

                await this.handleMessageRevoke(revoke)
              } catch (revokeError) {
                console.warn(
                  '[X ANTIDELETE] raw revoke failed:',
                  revokeError?.message || revokeError
                )
              }
            }
          }
        } catch (error) {
          console.error('[X WHATSAPP] ev.process error:', error)
        }
      })

      sock.ev.on('creds.update', saveCreds)

      sock.ev.on('connection.update', async (update) => {
        try {
          const { connection, qr, lastDisconnect } = update

          if (qr) {
            try {
              this.qr = {
                value: qr,
                dataUrl: await QRCode.toDataURL(qr)
              }
              try {
                logConnectionEvent(this.tenantId, 'qr_generated', null)
              } catch {}
            } catch (error) {
              this.lastError = error?.message || String(error)
            }
          }

          if (connection === 'open') {
            if (generation !== this.connectionGeneration) return

            this.status = 'connected'

            try {
              const { markTenantConnected } = await import('./db.mjs')
              markTenantConnected(this.tenantId)
            } catch (error) {
              console.warn('[X TENANT] mark connected failed:', error?.message || error)
            }

            try {
              const current = getTenant(this.tenantId)

              if (
                current &&
                (!current.owner_jid ||
                  String(current.owner_jid).startsWith('pending_'))
              ) {
                const ownJid = sock?.user?.id

                if (ownJid) {
                  setTenantOwner(this.tenantId, ownJid)
                  console.log(
                    `[X TENANT] ${this.tenantId} owner adopted: ${ownJid}`
                  )

                  try {
                    const {
                      provisionTenantDashboardUser
                    } = await import('./auth.mjs')

                    const creds = await provisionTenantDashboardUser(this.tenantId)

                    if (creds) {
                      const dashboardUrl =
                        process.env.X_DASHBOARD_URL ||
                        process.env.X_PAIR_URL ||
                        'http://localhost:3000'

                      const loginUrl = `${dashboardUrl.replace(/\/$/, '')}/app`

                      await this.safeSendMessage(
                        ownJid,
                        {
                          text: [
                            '🔐 *X CONTROL CENTER*',
                            '',
                            'Your login for the dashboard:',
                            '',
                            `👤 Username: *${creds.username}*`,
                            `🔑 Password: *${creds.plainPassword}*`,
                            '',
                            `Dashboard: ${loginUrl}`,
                            '',
                            '_Save this. You can change your password from the Account page._'
                          ].join('\n')
                        },
                        { label: 'dashboard credentials' }
                      )
                    }
                  } catch (error) {
                    console.warn(
                      '[X TENANT] dashboard provisioning failed:',
                      error?.message || error
                    )
                  }
                }
              }
            } catch (error) {
              console.warn(
                '[X TENANT] owner adoption failed:',
                error?.message || error
              )
            }

            this.registered = true
            this.qr = null
            this.lastError = null
            console.log('[X WHATSAPP] Connection opened.')

            try {
              await this.syncGroups()
            } catch (error) {
              this.lastError = error?.message || String(error)
              console.error('[X WHATSAPP] Initial group sync failed:', error)
            }

            try {
              await this.backfillMemberNames()
            } catch (error) {
              console.warn('[X WHATSAPP] Name backfill failed:', error?.message || error)
            }

            try {
              logConnectionEvent(this.tenantId, 'connected', sock?.user?.id || null)
            } catch {}

            return
          }

          if (connection === 'close') {
            if (this.intentionalShutdown) {
              console.log('[X WHATSAPP] Intentional shutdown — no reconnect.')
              this.status = 'logged_out'
              if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer)
                this.reconnectTimer = null
              }
              return
            }

            let code = lastDisconnect?.error?.output?.statusCode
            if (!code && lastDisconnect?.error) {
              code =
                lastDisconnect.error?.output?.statusCode ||
                lastDisconnect.error?.statusCode
            }

            const loggedOut = code === DisconnectReason.loggedOut
            const forbidden = code === 403
            const errorMessage =
              lastDisconnect?.error?.message ||
              `WhatsApp connection closed (${code || 'unknown'})`

            console.warn('[X WHATSAPP] Connection closed:', code, errorMessage)

            try {
              logConnectionEvent(
                this.tenantId,
                'disconnected',
                `${code || 'unknown'} — ${errorMessage}`
              )
            } catch {}

            if (this.sock === sock) {
              this.sock = null
            }

            if (forbidden) {
              console.error(
                '[X WHATSAPP] 403 Forbidden. Session dead. Bot halted.'
              )
              this.status = 'logged_out'
              this.lastError = 'Account forbidden (403). Session halted. Re-pair required.'

              if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer)
                this.reconnectTimer = null
              }

              return
            }

            this.status = loggedOut ? 'logged_out' : 'reconnecting'

            try {
              const { markTenantDisconnected } = await import('./db.mjs')
              markTenantDisconnected(this.tenantId)
            } catch (error) {
              console.warn('[X TENANT] mark disconnected failed:', error?.message || error)
            }

            this.lastError = loggedOut ? errorMessage : null

            if (!loggedOut) {
              this.scheduleReconnect(2500)
            }
          }
        } catch (error) {
          this.lastError = error?.message || String(error)
          console.error('[X WHATSAPP] connection.update handler error:', error)
          this.scheduleReconnect(3000)
        }
      })

      sock.ev.on('groups.upsert', async (groups) => {
        try {
          for (const group of groups || []) {
            try {
              if (!this.isConnected()) break
              await this.syncGroup(group.id, group)
            } catch (error) {
              console.error('[X WHATSAPP] groups.upsert sync failed:', error)
            }
          }
        } catch (error) {
          console.error('[X WHATSAPP] groups.upsert handler failed:', error)
        }
      })

      sock.ev.on('groups.update', async (updates) => {
        try {
          for (const update of updates || []) {
            try {
              if (!this.isConnected()) break
              await this.syncGroup(update.id)
            } catch (error) {
              console.error('[X WHATSAPP] groups.update sync failed:', error)
            }
          }
        } catch (error) {
          console.error('[X WHATSAPP] groups.update handler failed:', error)
        }
      })

      sock.ev.on('group-participants.update', async (event) => {
        try {
          if (!this.isConnected()) return
          await this.handleParticipantEvent(event)
        } catch (error) {
          this.lastError = error?.message || String(error)
          console.error('[X WHATSAPP] participant event failed:', error)
        }
      })

      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
          for (const message of messages || []) {
            try {
              if (!this.isConnected()) break

              try {
                this.messageStore.storeMessage(message)
              } catch (cacheError) {
                console.warn(
                  '[X ANTIDELETE] cache failed:',
                  cacheError?.message || cacheError
                )
              }

              if (type && type !== 'notify') continue

              if (message?.message?.reactionMessage) {
                await this.handleReaction(message)
                continue
              }

              const proto = message?.message?.protocolMessage
              if (proto && proto.type === 0 && proto.key) {
                await this.handleMessageRevoke({
                  key: proto.key,
                  protocolMessage: proto
                })
                continue
              }

              await this.handleMessage(message)
            } catch (error) {
              this.lastError = error?.message || String(error)
              console.error('[X WHATSAPP] Message handler failed:', error)
            }
          }
        } catch (error) {
          console.error('[X WHATSAPP] messages.upsert handler failed:', error)
        }
      })

      sock.ev.on('messages.update', async (updates) => {
        try {
          if (!this.isConnected()) return

          for (const update of updates || []) {
            try {
              const revoke = extractRevoke(update)
              if (!revoke) continue

              await this.handleMessageRevoke(revoke)
            } catch (error) {
              console.warn(
                '[X ANTIDELETE] revoke handler failed:',
                error?.message || error
              )
            }
          }
        } catch (error) {
          console.error('[X WHATSAPP] messages.update handler failed:', error)
        }
      })

      this.connecting = false
      return this.status
    } catch (error) {
      this.connecting = false
      this.status = 'error'
      this.lastError = error?.message || String(error)
      this.sock = null
      throw error
    }
  }


  /* -----------------------------------------------------
   * [ANTIDELETE] Recovery
   * --------------------------------------------------- */

  async handleMessageRevoke(normalized) {
    const key = normalized?.key
    if (!key) return

    const { remoteJid, id, participant } = key
    if (!remoteJid || !id) return

    if (!String(remoteJid).endsWith('@g.us')) return

    const mode = getAntideleteMode(this.tenantId, remoteJid)

    if (this.antideleteDebug) {
      console.log('[X ANTIDELETE] revoke for', { remoteJid, id, mode })
    }

    if (mode === 'off') return

    const group = getGroup(this.tenantId, remoteJid)
    if (!group) return

    if (key.fromMe) return

    const original = this.messageStore.getMessage(remoteJid, id)

    if (!original) return

    const senderJid =
      participant ||
      original?.key?.participant ||
      original?.participant ||
      original?.key?.remoteJid ||
      'unknown'

    const deleterJid =
      normalized?.protocolMessage?.participant ||
      original?.key?.participant ||
      null

    const senderName = this.getMemberDisplayName(
      remoteJid,
      senderJid,
      'Member'
    )

    const deleterName = deleterJid
      ? this.getMemberDisplayName(remoteJid, deleterJid, 'Unknown')
      : null

    const recovered = await this.captureViewOnce(
      remoteJid,
      original,
      senderJid,
      deleterJid,
      { fromRevoke: true }
    )

    if (recovered) {
      try {
        addAudit(
          this.tenantId,
          remoteJid,
          deleterJid || senderJid,
          'antidelete:viewonce',
          senderJid,
          { messageId: id, mode }
        )
      } catch {}
      return
    }

    const text = this.extractTextFromStored(original)
    if (!text) return

    const header = [
      '🚨 *ANTI-DELETE*',
      '',
      `👤 Sender: *${senderName}*`,
      deleterName && deleterName !== senderName
        ? `🗑️ Deleted by: *${deleterName}*`
        : null
    ]
      .filter(Boolean)
      .join('\n')

    const body = `${header}\n\n${text}`

    try {
      if (mode === 'admins') {
        await this.deliverToAdmins(remoteJid, body)
      } else {
        await this.safeSendMessage(
          remoteJid,
          { text: body },
          { label: 'antidelete recovery' }
        )
      }

      try {
        addAudit(
          this.tenantId,
          remoteJid,
          deleterJid || senderJid,
          'antidelete:text',
          senderJid,
          { messageId: id, mode }
        )
      } catch {}
    } catch (error) {
      console.warn(
        '[X ANTIDELETE] text recovery send failed:',
        error?.message || error
      )
    }
  }


  async deliverToAdmins(groupId, text) {
    const admins = this.listAdmins(groupId)

    const targets = admins
      .map((a) => a.jid)
      .filter(Boolean)

    if (!targets.length) {
      return this.safeSendMessage(
        groupId,
        { text },
        { label: 'antidelete admins-fallback' }
      )
    }

    for (const jid of targets) {
      try {
        await this.safeSendMessage(
          jid,
          {
            text: [
              `📥 *ANTI-DELETE (admins-only)*`,
              `Group: ${groupId}`,
              '',
              text
            ].join('\n')
          },
          { label: 'antidelete admin DM' }
        )
      } catch (error) {
        console.warn(
          '[X ANTIDELETE] admin DM failed:',
          jid,
          error?.message || error
        )
      }
    }
  }


  /* -----------------------------------------------------
   * [VIEWONCE] AUTO-CAPTURE
   * --------------------------------------------------- */

  async captureViewOnce(chatId, envelope, senderJid, deleterJid = null, opts = {}) {
    if (!this.isConnected() || !this.sock) return false
    if (!chatId) return false

    const { fromRevoke = false } = opts

    const isGroup = String(chatId).endsWith('@g.us')

    let antiviewMode = 'public'
    let group = null

    if (isGroup) {
      group = getGroup(this.tenantId, chatId)
      if (!group) return false

      const settings = (() => {
        try { return JSON.parse(group.settings_json || '{}') }
        catch { return {} }
      })()

      antiviewMode = settings.antiviewMode || 'public'

      if (antiviewMode === 'off') return false
    }

    const inner = envelope?.message || envelope
    const unwrapped = unwrapViewOnce(inner)

    if (!unwrapped?.node) return false

    let buffer = null
    try {
      buffer = await downloadViewOnce(unwrapped.node, unwrapped.type)
    } catch (error) {
      if (this.antideleteDebug) {
        console.warn(
          '[X VIEWONCE] download failed:',
          error?.message || error
        )
      }
      return false
    }

    if (!buffer?.length) return false

    const sender = senderJid || envelope?.key?.participant || chatId
    const bareChat = safeFileName(chatId.split('@')[0])
    const bareSender = safeFileName(sender.split('@')[0])

    const bucket = isGroup
      ? `group_${safeFileName(group?.name || bareChat)}_${bareChat}`
      : `dm_${bareSender}`

    const bucketDir = path.join(VIEWONCE_ROOT, bucket)
    fs.mkdirSync(bucketDir, { recursive: true })

    const mime = unwrapped.node?.mimetype || 'application/octet-stream'
    const ext = extFromMime(mime)
    const hash = crypto
      .createHash('sha256')
      .update(buffer)
      .digest('hex')
      .slice(0, 16)

    const fileName = `${Date.now()}_${hash}.${ext}`
    const filePath = path.join(bucketDir, fileName)
    fs.writeFileSync(filePath, buffer)

    if (!fromRevoke && envelope?.key) {
      try {
        await this.sock.readMessages([envelope.key])
      } catch {}
    }

    const senderName = this.getMemberDisplayName(
      chatId,
      sender,
      'Member'
    )

    const deleterName = deleterJid
      ? this.getMemberDisplayName(chatId, deleterJid, 'Unknown')
      : null

    const kind =
      unwrapped.type === 'image' ? 'image'
      : unwrapped.type === 'video' ? 'video'
      : unwrapped.type === 'audio' ? 'audio'
      : 'document'

    const header = [
      fromRevoke
        ? '👁️ *VIEW-ONCE RECOVERED*'
        : '👁️ *VIEW-ONCE CAPTURED*',
      '',
      `👤 Sender: *${senderName}*`,
      deleterName && deleterName !== senderName
        ? `🗑️ Deleted by: *${deleterName}*`
        : null,
      unwrapped.node?.caption
        ? `📝 ${unwrapped.node.caption}`
        : null,
      '',
      `_saved: ${bucket}/${fileName}_`
    ]
      .filter(Boolean)
      .join('\n')

    try {
      if (isGroup && antiviewMode === 'admins' && !fromRevoke) {
        const admins = this.listAdmins(chatId)
        const targets = admins.map((a) => a.jid).filter(Boolean)

        if (!targets.length) {
          await this.deliverViewOnceMedia(
            chatId, kind, buffer, mime, header, unwrapped.node
          )
        } else {
          for (const jid of targets) {
            try {
              await this.deliverViewOnceMedia(
                jid, kind, buffer, mime, header, unwrapped.node
              )
            } catch (err) {
              console.warn(
                '[X VIEWONCE] admin DM failed:',
                err?.message || err
              )
            }
          }
        }
      } else {
        await this.deliverViewOnceMedia(
          chatId, kind, buffer, mime, header, unwrapped.node
        )
      }

      try {
        addAudit(
          this.tenantId,
          isGroup ? chatId : null,
          sender,
          fromRevoke ? 'viewonce.recovered' : 'viewonce.captured',
          sender,
          { filePath, kind, antiviewMode }
        )
      } catch {}

      return true
    } catch (error) {
      console.warn(
        '[X VIEWONCE] relay failed:',
        error?.message || error
      )
      return false
    }
  }


  async deliverViewOnceMedia(targetJid, kind, buffer, mime, caption, node) {
    if (kind === 'audio') {
      await this.safeSendMessage(
        targetJid,
        {
          audio: buffer,
          mimetype: mime || 'audio/mpeg',
          ptt: !!node?.ptt
        },
        { label: 'viewonce audio' }
      )
      await this.safeSendMessage(
        targetJid,
        { text: caption },
        { label: 'viewonce audio caption' }
      )
      return
    }

    if (kind === 'image') {
      await this.sendImage(targetJid, buffer, caption, [])
      return
    }

    if (kind === 'video') {
      await this.sendVideo(
        targetJid,
        buffer,
        caption,
        [],
        {
          mimetype: mime || 'video/mp4',
          fileName: 'viewonce.mp4',
          gifPlayback: false
        }
      )
      return
    }

    await this.safeSendMessage(
      targetJid,
      {
        document: buffer,
        mimetype: mime || 'application/octet-stream',
        fileName: node?.fileName || 'viewonce.bin',
        caption
      },
      { label: 'viewonce document' }
    )
  }


  async recoverViewOnce(chatId, envelope, senderName = 'Member', deleterName = null) {
    const sender =
      envelope?.key?.participant ||
      envelope?.key?.remoteJid ||
      null

    return this.captureViewOnce(
      chatId,
      envelope,
      sender,
      null,
      { fromRevoke: true }
    )
  }


  extractTextFromStored(envelope) {
    const m = envelope?.message || envelope || {}
    return (
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      m.documentMessage?.caption ||
      ''
    ).trim()
  }


  getStoredMessage(chatId, messageId) {
    if (!chatId || !messageId) return null
    try {
      return this.messageStore.getMessage(chatId, messageId) || null
    } catch {
      return null
    }
  }


  getStoredKind(chatId, messageId) {
    if (!chatId || !messageId) return null
    try {
      return this.messageStore.getKind(chatId, messageId) || null
    } catch {
      return null
    }
  }


  findRecentViewOnce(chatId, senderJid = null) {
    if (!chatId) return null
    try {
      return this.messageStore.findRecentViewOnce(chatId, senderJid) || null
    } catch {
      return null
    }
  }


  cacheViewOnceFromReply(chatId, messageId, senderJid, quotedMessage) {
    if (!chatId || !messageId || !quotedMessage) return false
    try {
      return this.messageStore.cacheFromReply(
        chatId, messageId, senderJid, quotedMessage
      )
    } catch {
      return false
    }
  }


  /* -----------------------------------------------------
   * Group synchronization
   * --------------------------------------------------- */

  async syncGroups() {
    if (!this.isConnected()) {
      throw new Error('WhatsApp socket is not connected.')
    }

    if (this.syncingGroups) return this.groupCount

    this.syncingGroups = true

    try {
      const groups = await this.sock.groupFetchAllParticipating()
      if (!this.isConnected()) return this.groupCount

      for (const group of Object.values(groups || {})) {
        try {
          await this.syncGroup(group.id, group)
        } catch (error) {
          console.error(`[X WHATSAPP] Failed syncing group ${group.id}:`, error)
        }
      }

      this.groupCount = Object.keys(groups || {}).length
      return this.groupCount
    } catch (error) {
      const code = error?.output?.statusCode || error?.statusCode

      if ([428, 408, 503, 500].includes(code)) {
        this.markDisconnected(error)
        this.scheduleReconnect(2500)
        return this.groupCount
      }

      throw error
    } finally {
      this.syncingGroups = false
    }
  }


  resolveContactName(jid, groupId = null) {
    if (!jid) return null
    const sock = this.sock

    try {
      const contact = sock?.store?.contacts?.[jid]
      const name =
        cleanDisplayIdentity(contact?.name) ||
        cleanDisplayIdentity(contact?.notify) ||
        cleanDisplayIdentity(contact?.verifiedName)
      if (name) return name
    } catch {}

    try {
      const bucket = sock?.store?.messages?.[jid]
      if (bucket) {
        const list = Object.values(bucket)
        for (let i = list.length - 1; i >= 0; i--) {
          const name = cleanDisplayIdentity(list[i]?.pushName)
          if (name) return name
        }
      }
    } catch {}

    try {
      const meta = sock?.store?.groupMetadata?.[groupId]
      const participant = meta?.participants?.find((p) => p.id === jid)
      const name =
        cleanDisplayIdentity(participant?.notify) ||
        cleanDisplayIdentity(participant?.name)
      if (name) return name
    } catch {}

    if (groupId) {
      try {
        const member = findMemberByIdentity(this.tenantId, groupId, { jid })
        const name =
          cleanDisplayIdentity(member?.display_name) ||
          cleanDisplayIdentity(member?.username)
        if (name) return name
      } catch {}
    }

    return null
  }


  resolveHumanIdentity(participant, previous = null, groupId = null) {
    const participantJid =
      typeof participant?.id === 'string'
        ? participant.id
        : participant?.jid ||
          participant?.lid ||
          participant?.phoneNumber ||
          null

    const liveName = participantJid
      ? this.resolveContactName(participantJid, groupId)
      : null

    const username =
      cleanDisplayIdentity(participant?.username) ||
      cleanDisplayIdentity(participant?.user?.username) ||
      cleanDisplayIdentity(participant?.profile?.username) ||
      cleanDisplayIdentity(previous?.username) ||
      null

    const displayName =
      liveName ||
      cleanDisplayIdentity(participant?.notify) ||
      cleanDisplayIdentity(participant?.name) ||
      cleanDisplayIdentity(participant?.pushName) ||
      cleanDisplayIdentity(participant?.displayName) ||
      cleanDisplayIdentity(participant?.user?.name) ||
      cleanDisplayIdentity(previous?.display_name) ||
      cleanDisplayIdentity(previous?.username) ||
      username ||
      null

    return { username, displayName }
  }


  async syncGroup(groupId, supplied) {
    if (!this.isConnected() || !groupId?.endsWith('@g.us')) {
      return null
    }

    let metadata = supplied?.participants ? supplied : null

    if (!metadata) {
      try {
        metadata = await this.sock.groupMetadata(groupId)
      } catch (error) {
        const code = error?.output?.statusCode || error?.statusCode
        if ([428, 408, 503, 500].includes(code)) {
          this.markDisconnected(error)
          this.scheduleReconnect(2500)
          return null
        }
        throw error
      }
    }

    if (!metadata) return null

    const participants = metadata.participants || []

    let picture = null
    try {
      if (this.isConnected()) {
        picture = await this.sock.profilePictureUrl(groupId, 'image')
      }
    } catch {
      picture = null
    }

    const current = getGroup(this.tenantId, groupId)

    let previousSettings = {}
    try {
      previousSettings = current?.settings_json
        ? JSON.parse(current.settings_json)
        : {}
    } catch {
      previousSettings = {}
    }

    const settings = {
      ...previousSettings,
      announce: !!metadata.announce,
      restrict: !!metadata.restrict
    }

    const admins = participants.filter((p) => p.admin)

    upsertGroup(this.tenantId, {
      groupId,
      name: metadata.subject || current?.name,
      description: metadata.desc ?? current?.description,
      profilePictureUrl: picture || current?.profile_picture_url,
      memberCount: participants.length,
      adminsCount: admins.length,
      rules: current?.rules || metadata.desc || null,
      prefix: current?.prefix || '.',
      theme: current?.theme || 'X Dark',
      antiLink: !!current?.anti_link,
      antiSpam: !!current?.anti_spam,
      welcomeEnabled: current?.welcome_enabled !== 0,
      goodbyeEnabled: current?.goodbye_enabled !== 0,
      antideleteMode: current?.antidelete_mode || 'off',
      welcomeTemplate: current?.welcome_template,
      goodbyeTemplate: current?.goodbye_template,
      connectionState: 'synced',
      settings
    })

    const members = []

    for (const participant of participants) {
      const participantJid =
        typeof participant?.id === 'string'
          ? participant.id
          : participant?.jid ||
            participant?.lid ||
            participant?.phoneNumber ||
            null

      if (!participantJid) continue

      let avatarUrl = null
      try {
        if (this.isConnected()) {
          avatarUrl = await this.sock.profilePictureUrl(participantJid, 'image')
        }
      } catch {
        avatarUrl = null
      }

      const old = findMemberByIdentity(this.tenantId, groupId, {
        jid: participantJid,
        lid: participant?.lid,
        phone: participant?.phoneNumber,
        username: participant?.username,
        displayName:
          participant?.notify ||
          participant?.name ||
          participant?.pushName
      })

      const identity = this.resolveHumanIdentity(participant, old, groupId)

      members.push({
        jid: participantJid,
        lid: participant?.lid || old?.lid || null,
        phone: participant?.phoneNumber || old?.phone || null,
        username: identity.username,
        displayName: identity.displayName,
        role:
          participant?.admin === 'superadmin'
            ? 'superadmin'
            : participant?.admin
            ? 'admin'
            : 'member',
        avatarUrl,
        xp: old?.xp,
        level: old?.level,
        coins: old?.coins,
        bank: old?.bank,
        messages: old?.messages,
        wins: old?.wins,
        losses: old?.losses,
        reputation: old?.reputation,
        streak: old?.streak,
        lastDaily: old?.last_daily,
        lastWeekly: old?.last_weekly,
        lastMonthly: old?.last_monthly
      })
    }

    replaceMembers(this.tenantId, groupId, members)

    return getGroup(this.tenantId, groupId)
  }


  /* -----------------------------------------------------
   * Safe WhatsApp send — with OWN throttle
   * --------------------------------------------------- */

  async safeSendMessage(jid, content, options = {}) {
    const { retry = false, label = 'message', quoted = null } = options

    if (!this.isConnected() || !this.sock) {
      const error = new Error('WHATSAPP_DISCONNECTED')
      error.code = 'WHATSAPP_DISCONNECTED'
      throw error
    }

    /*
     * [OWN ANTIBAN] — human-like delay + per-minute cap.
     * Runs BEFORE the socket call, so it covers every path
     * that sends anything: text, media, reactions, deletes.
     */
    await this.throttleSend(jid)

    const activeSocket = this.sock

    const payload = quoted
      ? { ...content, quoted }
      : content

    try {
      return await activeSocket.sendMessage(jid, payload)
    } catch (error) {
      const code =
        error?.output?.statusCode ||
        error?.statusCode ||
        error?.data?.statusCode

      const message = String(error?.message || '')

      const mediaFailure =
        /upload timeout|media upload failed|mmg.*\.whatsapp.*\.net/i.test(message)

      const connectionFailure =
        [428, 408, 503, 500, 1006].includes(code) ||
        /connection closed|connection lost|socket closed/i.test(message)

      if (mediaFailure || connectionFailure) {
        console.warn(
          `[X WHATSAPP] ${label} failed because WhatsApp connection/media upload failed:`,
          message
        )

        if (this.sock === activeSocket) {
          this.sock = null
          this.markDisconnected(error)
          this.scheduleReconnect(2500)
        }

        if (retry && !mediaFailure && this.isConnected()) {
          return this.safeSendMessage(jid, content, { retry: false, label, quoted })
        }

        const wrapped = new Error(
          mediaFailure ? 'MEDIA_UPLOAD_FAILED' : 'WHATSAPP_DISCONNECTED'
        )

        wrapped.code = mediaFailure ? 'MEDIA_UPLOAD_FAILED' : 'WHATSAPP_DISCONNECTED'
        wrapped.cause = error

        throw wrapped
      }

      throw error
    }
  }


  /*
   * [OWN ANTIBAN] — enforces a human-like send rhythm.
   *
   *   1. Waits 1.5–4s between sends to the same chat (jittered).
   *   2. Caps at 10 sends/minute per chat; excess waits out the window.
   *
   * Cheap, no external deps, no library bugs.
   */
  async throttleSend(jid) {
    const now = Date.now()
    const bucket = (this._sendTimestamps.get(jid) || [])
      .filter((t) => now - t < 60 * 1000)

    /* Hard cap — wait out the oldest if we hit 10/min */
    if (bucket.length >= SEND_PER_CHAT_PER_MIN) {
      const oldest = bucket[0]
      const wait = 60 * 1000 - (now - oldest) + 500
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait))
      }
      /* Recompute after wait */
      const refreshed = (this._sendTimestamps.get(jid) || [])
        .filter((t) => Date.now() - t < 60 * 1000)
      this._sendTimestamps.set(jid, refreshed)
    }

    /* Human jitter between consecutive sends to the same jid */
    const currentBucket = this._sendTimestamps.get(jid) || []
    const lastSend = currentBucket[currentBucket.length - 1] || 0
    const sinceLast = Date.now() - lastSend

    if (sinceLast < SEND_MIN_DELAY_MS) {
      const jitter = Math.random() * SEND_MAX_JITTER_MS
      const delay = SEND_MIN_DELAY_MS + jitter - sinceLast
      if (delay > 0) {
        await new Promise((r) => setTimeout(r, delay))
      }
    }

    currentBucket.push(Date.now())
    this._sendTimestamps.set(jid, currentBucket)
  }


  /* -----------------------------------------------------
   * Senders
   * --------------------------------------------------- */

  async sendAudio(jid, buffer, options = {}) {
    const {
      mimetype = 'audio/mpeg',
      fileName = 'audio.mp3',
      ptt = false,
      quoted = null
    } = options

    return this.safeSendMessage(
      jid,
      { audio: buffer, mimetype, fileName, ptt },
      { label: 'audio upload', quoted }
    )
  }


  async sendImage(jid, buffer, caption = '', mentions = [], quoted = null) {
    return this.safeSendMessage(
      jid,
      { image: buffer, caption, mentions },
      { label: 'image upload', quoted }
    )
  }


  async sendVideo(jid, buffer, caption = '', mentions = [], options = {}) {
    const {
      mimetype = 'video/mp4',
      fileName = 'clip.mp4',
      gifPlayback = true,
      quoted = null
    } = options

    return this.safeSendMessage(
      jid,
      { video: buffer, mimetype, fileName, caption, mentions, gifPlayback },
      { label: 'video upload', quoted }
    )
  }


  async gifToMp4Buffer(gifBuffer) {
    if (!Buffer.isBuffer(gifBuffer) || !gifBuffer.length) return null

    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const inputPath = `${tmpdir()}/x-gif-${stamp}.gif`
    const outputPath = `${tmpdir()}/x-gif-${stamp}.mp4`

    try {
      await fsp.writeFile(inputPath, gifBuffer)

      const exitCode = await this.runFfmpeg([
        '-y', '-i', inputPath,
        '-vf', 'scale=480:-2:flags=lanczos,fps=24',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'veryfast',
        '-crf', '28',
        '-movflags', '+faststart',
        '-an',
        outputPath
      ])

      if (exitCode !== 0) {
        console.warn('[X GIF→MP4] ffmpeg exited with code', exitCode)
        return null
      }

      const buffer = await fsp.readFile(outputPath)
      return buffer.length ? buffer : null
    } catch (error) {
      console.warn('[X GIF→MP4] conversion failed:', error?.message || error)
      return null
    } finally {
      await fsp.unlink(inputPath).catch(() => {})
      await fsp.unlink(outputPath).catch(() => {})
    }
  }


  runFfmpeg(args) {
    return new Promise((resolve) => {
      const child = spawn('ffmpeg', args, {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe']
      })

      let stderr = ''
      child.stderr.on('data', (chunk) => {
        stderr = (stderr + chunk.toString()).slice(-512)
      })

      child.on('error', (error) => {
        console.warn('[X FFMPEG] spawn failed:', error?.message || error)
        resolve(-1)
      })

      child.on('close', (code) => {
        if (code !== 0 && stderr) {
          console.warn('[X FFMPEG] stderr tail:', stderr)
        }
        resolve(code ?? -1)
      })
    })
  }


  /* -----------------------------------------------------
   * Warning enforcement
   * --------------------------------------------------- */

  async enforceWarning({
    group,
    targetJid,
    reason,
    sourceLabel,
    offendingMessageKey = null
  }) {
    if (!group?.group_id || !targetJid) {
      return { warned: false, kicked: false }
    }

    const target = getMember(this.tenantId, group.group_id, targetJid)

    if (target && (target.role === 'admin' || target.role === 'superadmin')) {
      return { warned: false, kicked: false, exempt: true }
    }

    const MAX_WARNINGS = Number(process.env.X_MAX_WARNINGS || 3)

    if (offendingMessageKey && this.isConnected()) {
      try {
        await this.safeSendMessage(
          group.group_id,
          { delete: offendingMessageKey },
          { label: `${sourceLabel} delete` }
        )
      } catch (error) {
        console.warn(
          `[X ENFORCE] Could not delete ${sourceLabel} message:`,
          error?.message || error
        )
      }
    }

    let total = 0
    try {
      warning(this.tenantId, group.group_id, targetJid, reason)
      total = warningCount(this.tenantId, group.group_id, targetJid)
    } catch (error) {
      console.warn('[X ENFORCE] Could not record warning:', error?.message || error)
      return { warned: false, kicked: false }
    }

    const displayName = this.getMemberDisplayName(
      group.group_id,
      targetJid,
      'Member'
    )

    const mention = createMention(targetJid)
    const shouldKick = total >= MAX_WARNINGS

    try {
      const lines = [
        `⚠️ *WARNING ${total}/${MAX_WARNINGS}*`,
        '',
        `${mention.text} — *${displayName}*`,
        `Reason: ${reason}`,
        `Source: ${sourceLabel}`
      ]

      if (shouldKick) {
        lines.push(
          '',
          `🚫 *FINAL WARNING REACHED*`,
          `${displayName} is being removed from the group.`
        )
      }

      await this.safeSendMessage(
        group.group_id,
        {
          text: lines.join('\n'),
          mentions: mention.jid ? [mention.jid] : []
        },
        { label: `${sourceLabel} warning` }
      )
    } catch (error) {
      console.warn('[X ENFORCE] Could not post warning:', error?.message || error)
    }

    if (!shouldKick) {
      return { warned: true, kicked: false, total }
    }

    let kicked = false
    try {
      await this.groupParticipantAction(group.group_id, [targetJid], 'kick')
      kicked = true
    } catch (error) {
      console.warn('[X ENFORCE] Kick failed:', error?.message || error)
    }

    if (kicked) {
      try {
        const farewell = createMention(targetJid)
        await this.safeSendMessage(
          group.group_id,
          {
            text: [
              '━━━━━━━━━━━━━━━━━━━━━━',
              '👋 *FAREWELL*',
              '━━━━━━━━━━━━━━━━━━━━━━',
              '',
              `${farewell.text} — *${displayName}*`,
              '',
              `Strikes: ${total}/${MAX_WARNINGS}`,
              `Reason: ${reason}`,
              `Source: ${sourceLabel}`,
              '',
              'The rule is the rule. 🚪',
              '━━━━━━━━━━━━━━━━━━━━━━'
            ].join('\n'),
            mentions: farewell.jid ? [farewell.jid] : []
          },
          { label: 'farewell notice' }
        )
      } catch (error) {
        console.warn('[X ENFORCE] Farewell send failed:', error?.message || error)
      }

      try {
        clearWarnings(this.tenantId, group.group_id, targetJid)
      } catch {}
    }

    try {
      addAudit(
        this.tenantId,
        group.group_id,
        this.sock?.user?.id || 'X',
        'autokick',
        targetJid,
        { total, reason, source: sourceLabel }
      )
    } catch {}

    return { warned: true, kicked, total }
  }


  /* -----------------------------------------------------
   * Join request handling
   * --------------------------------------------------- */

  async listJoinRequests(groupId) {
    if (!this.isConnected()) {
      throw new Error('WhatsApp is disconnected.')
    }

    if (!String(groupId || '').endsWith('@g.us')) {
      throw new Error('This command can only be used inside a group.')
    }

    try {
      const rows = await this.sock.groupRequestParticipantsList(groupId)
      return Array.isArray(rows) ? rows : []
    } catch (error) {
      const code = error?.output?.statusCode || error?.statusCode
      if ([428, 408, 503, 500].includes(code)) {
        this.markDisconnected(error)
        this.scheduleReconnect(2500)
      }
      throw error
    }
  }

  async updateJoinRequests(groupId, jids, action) {
    if (!this.isConnected()) {
      throw new Error('WhatsApp is disconnected.')
    }

    if (!['approve', 'reject'].includes(action)) {
      throw new Error('Unsupported request action.')
    }

    const list = Array.isArray(jids) ? jids.filter(Boolean) : []
    if (!list.length) return []

    try {
      return await this.sock.groupRequestParticipantsUpdate(groupId, list, action)
    } catch (error) {
      const code = error?.output?.statusCode || error?.statusCode
      if ([428, 408, 503, 500].includes(code)) {
        this.markDisconnected(error)
        this.scheduleReconnect(2500)
      }
      throw error
    }
  }

  async addParticipant(groupId, jid) {
    if (!this.isConnected()) {
      throw new Error('WhatsApp is disconnected.')
    }

    if (!String(groupId || '').endsWith('@g.us')) {
      throw new Error('This command can only be used inside a group.')
    }

    try {
      return await this.sock.groupParticipantsUpdate(groupId, [jid], 'add')
    } catch (error) {
      const code = error?.output?.statusCode || error?.statusCode
      if ([428, 408, 503, 500].includes(code)) {
        this.markDisconnected(error)
        this.scheduleReconnect(2500)
      }
      throw error
    }
  }


  /* -----------------------------------------------------
   * Participant events
   * --------------------------------------------------- */

  async handleParticipantEvent(event) {
    if (!this.isConnected()) return

    const group = getGroup(this.tenantId, event?.id)
    if (!group) return

    const isJoin = event.action === 'add'
    const isLeave = ['remove', 'delete'].includes(event.action)

    for (const participant of event.participants || []) {
      const jid =
        typeof participant === 'string'
          ? participant
          : participant?.id ||
            participant?.jid ||
            participant?.lid ||
            participant?.phoneNumber ||
            null

      if (!jid) continue

      if (typeof participant === 'object') {
        try {
          const identity = this.resolveHumanIdentity(participant, null, event.id)

          const existing = findMemberByIdentity(this.tenantId, event.id, {
            jid,
            lid: participant?.lid,
            phone: participant?.phoneNumber,
            username: identity.username,
            displayName: identity.displayName
          })

          if (existing) {
            updateMemberIdentity(this.tenantId, event.id, existing.jid, {
              username: identity.username || existing.username,
              displayName: identity.displayName || existing.display_name,
              lid: participant?.lid || existing.lid,
              phone: participant?.phoneNumber || existing.phone
            })
          }
        } catch (identityError) {
          console.warn(
            '[X PARTICIPANT] Could not learn participant identity:',
            identityError?.message || identityError
          )
        }
      }

      try {
        if (isJoin && group.welcome_enabled) {
          await this.sendPersonalizedEvent(
            event.id, jid, group, group.welcome_template, true
          )
        }

        if (isLeave && group.goodbye_enabled) {
          await this.sendPersonalizedEvent(
            event.id, jid, group, group.goodbye_template, false
          )
        }
      } catch (error) {
        if (
          error?.code === 'WHATSAPP_DISCONNECTED' ||
          error?.code === 'MEDIA_UPLOAD_FAILED'
        ) {
          return
        }
        console.error('[X PARTICIPANT] Personalized event failed:', error)
      }

    }

    if (this.isConnected()) {
      try {
        await this.syncGroup(event.id)
      } catch (error) {
        console.error('[X PARTICIPANT] Post-event group sync failed:', error)
      }
    }
  }


  selectMemberEventStyle(groupId, participantJid, styles, eventType) {
    const key = `${groupId}:${participantJid}`

    let hash = 0
    for (const character of key) {
      hash = (hash * 31 + character.charCodeAt(0)) % styles.length
    }

    const previous = this.lastWelcomeStyles.get(`${eventType}:${groupId}`)

    let index =
      (hash +
        (this.lastWelcomeStyles.get(`${eventType}:${groupId}:count`) || 0)) %
      styles.length

    if (styles[index] === previous) {
      index = (index + 1) % styles.length
    }

    this.lastWelcomeStyles.set(`${eventType}:${groupId}`, styles[index])
    this.lastWelcomeStyles.set(
      `${eventType}:${groupId}:count`,
      (this.lastWelcomeStyles.get(`${eventType}:${groupId}:count`) || 0) + 1
    )

    return styles[index]
  }


  selectWelcomeStyle(groupId, participantJid) {
    return this.selectMemberEventStyle(
      groupId, participantJid, welcomeStyles, 'welcome'
    )
  }


  selectGoodbyeStyle(groupId, participantJid) {
    return this.selectMemberEventStyle(
      groupId, participantJid, goodbyeStyles, 'goodbye'
    )
  }


  async getMemberAvatarUrl(jid, existingUrl = null) {
    if (existingUrl) return existingUrl

    const cached = this.memberAvatarCache.get(jid)
    if (cached && cached.expiresAt > Date.now()) return cached.url

    try {
      const url = await this.sock.profilePictureUrl(jid, 'image')
      this.memberAvatarCache.set(jid, {
        url,
        expiresAt: Date.now() + 10 * 60 * 1000
      })
      return url
    } catch {
      this.memberAvatarCache.set(jid, {
        url: null,
        expiresAt: Date.now() + 60 * 1000
      })
      return null
    }
  }


  /* -----------------------------------------------------
   * Personalized welcome/goodbye
   * --------------------------------------------------- */

  async sendPersonalizedEvent(groupId, jid, group, template, join) {
    const participantJid =
      typeof jid === 'string'
        ? jid
        : jid?.id || jid?.jid || jid?.lid || jid?.phoneNumber || null

    if (!participantJid) {
      console.warn(
        '[X PARTICIPANT] Ignoring participant with no usable JID:',
        jid
      )
      return
    }

    const memberCount = Math.max(
      0,
      Number(group?.member_count || 0) + (join ? 1 : -1)
    )

    let displayName = 'New member'
    let username = null
    let member = null

    try {
      member = findMemberByIdentity(this.tenantId, groupId, { jid: participantJid })
      displayName = this.getMemberDisplayName(
        groupId,
        participantJid,
        join ? 'New member' : 'Former Member'
      )
      username = member?.username || null
    } catch (error) {
      console.warn('[X PARTICIPANT] Member lookup failed:', error?.message || error)
    }

    const templateUsername = username || displayName.replace(/\s+/g, '')
    const memberMention = createMention(participantJid)

    const context = {
      groupName: group?.name || 'Group',
      memberCount,
      username: templateUsername,
      displayName,
      userMention: memberMention.text,
      jid: participantJid
    }

    const defaultTemplatePattern = join
      ? /^Welcome\s+\{user\}\s+to\s+\*?\{group\}/i
      : /^Goodbye\s+\{user\}\./i

    const hasCustomEventTemplate = Boolean(
      template && !defaultTemplatePattern.test(String(template).trim())
    )

    const text = !hasCustomEventTemplate
      ? join
        ? renderWelcomeStyle(
            this.selectWelcomeStyle(groupId, participantJid),
            context
          )
        : renderGoodbyeStyle(
            this.selectGoodbyeStyle(groupId, participantJid),
            context
          )
      : renderTemplate(template, context)

    const mentionJids = memberMention.jid ? [memberMention.jid] : []

    try {
      const imageUrl = join
        ? (await this.getMemberAvatarUrl(
            participantJid,
            member?.avatar_url
          )) || group?.profile_picture_url
        : member?.avatar_url || group?.profile_picture_url

      if (imageUrl && this.isConnected()) {
        const response = await fetch(imageUrl)
        if (response.ok) {
          const image = Buffer.from(await response.arrayBuffer())
          await this.sendImage(groupId, image, text, mentionJids)
          return
        }
      }
    } catch (error) {
      if (
        error?.code === 'WHATSAPP_DISCONNECTED' ||
        error?.code === 'MEDIA_UPLOAD_FAILED'
      ) {
        throw error
      }
      console.warn('[X PARTICIPANT] Profile image failed:', error?.message || error)
    }

    await this.safeSendMessage(
      groupId,
      { text, mentions: mentionJids },
      { label: 'personalized event' }
    )
  }


  /* -----------------------------------------------------
   * Message handling
   * --------------------------------------------------- */

  async handleMessage(message) {
    if (!this.isConnected()) return

    const jid = message?.key?.remoteJid
    if (!jid || !message.message || message.key.fromMe) return

    const text = (
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      message.message.imageMessage?.caption ||
      ''
    ).trim()

    const sender = message.key.participant || message.key.remoteJid

    /* ---- ANTI-BAN GATE ---- */
    const ban = isBanned(sender)
    if (ban) return

    const group = jid.endsWith('@g.us') ? getGroup(this.tenantId, jid) : null

    /* ====================================================================== */
    /* [X DM AGENT] — inbound DMs only                                        */
    /* ====================================================================== */

    if (!group) {
      const prefix = process.env.X_DEFAULT_PREFIX || '.'

      if (text.startsWith(prefix)) {
        const [dmCommandName, ...dmArgs] = text.slice(prefix.length).trim().split(/\s+/)
        const lower = String(dmCommandName || '').toLowerCase()

        if (['fav', 'beef'].includes(lower)) {
          try {
            const { executeCommand: executeDMCommand } = await import('./commands.mjs')
            const response = await executeDMCommand(
              { runtime: this, group: null, sender, args: dmArgs, mentions: [], message },
              dmCommandName,
              dmArgs
            )

            if (response) {
              await this.safeSendMessage(
                jid,
                { text: typeof response === 'string' ? response : response.text },
                { label: `.${dmCommandName} DM response`, quoted: message }
              )
            }
          } catch (error) {
            console.warn('[X DM] command failed:', error?.message || error)
          }
          return
        }
      }

      if (text) {
        logDM({
          tenantId: this.tenantId,
          jid: sender,
          direction: 'inbound',
          messageId: message.key.id,
          text
        })

        learnFromMessage({
          tenantId: this.tenantId,
          groupId: `dm:${sender}`,
          senderJid: sender,
          senderName: message.pushName || 'someone',
          text
        })

        if (isAgentEnabled(this.tenantId, `dm:${sender}`)) {
          const verdict = shouldReplyToDM(this.tenantId, sender, text)

          if (verdict.reply) {
            ;(async () => {
              try {
                const delay = 800 + Math.floor(Math.random() * 2200)
                await new Promise((r) => setTimeout(r, delay))

                try {
                  if (this.sock?.sendPresenceUpdate) {
                    await this.sock.sendPresenceUpdate('composing', jid)
                  }
                } catch {}

                const result =
                  verdict.reason === 'spam-warning'
                    ? { text: 'bro chill 💀', mentions: [] }
                    : await generateReply({
                        tenantId: this.tenantId,
                        groupId: `dm:${sender}`,
                        groupName: null,
                        senderJid: sender,
                        senderName: message.pushName || 'someone',
                        text,
                        repliedTo: null,
                        isReplyToXDirectly: false,
                        isDirectMention: false,
                        isDM: true
                      })

                if (result?.text) {
                  await this.safeSendMessage(
                    jid,
                    { text: filterDMResponse(result.text) },
                    { label: 'agent DM reply', quoted: message }
                  )
                }

                try {
                  if (this.sock?.sendPresenceUpdate) {
                    await this.sock.sendPresenceUpdate('paused', jid)
                  }
                } catch {}
              } catch (error) {
                console.warn('[X AGENT] DM reply failed:', error?.message || error)
              }
            })()
          }
        }
      }

      return
    }

    /* ====================================================================== */
    /* Group-only from here on                                                */
    /* ====================================================================== */

    const quietMinutesBeforeMessage = this.getQuietMinutes(group.group_id)

    if (
      sender &&
      text &&
      !text.startsWith(group?.prefix || process.env.X_DEFAULT_PREFIX || '.')
    ) {
      try {
        learnFromMessage({
          tenantId: this.tenantId,
          groupId: group.group_id,
          senderJid: sender,
          senderName: this.getMemberDisplayName(group.group_id, sender, 'someone'),
          text
        })
      } catch (error) {
        console.warn('[X AGENT] learn failed:', error?.message || error)
      }

      if (isAgentEnabled(this.tenantId, group.group_id)) {
        const xJid = this.sock?.user?.id || null

        const mentionInfo = detectMentionOfX(
          message,
          xJid ? [xJid] : [],
          currentName(this.tenantId, group.group_id),
          chatCountSince(this.tenantId, group.group_id, 60 * 60 * 1000)
        )

        const replyInfo = detectReplyToX(message, xJid)
        const isDirectMention = mentionInfo.isMentioned
        const isReplyToX = replyInfo.isReplyToX
        const ctx = replyInfo.contextInfo || mentionInfo.contextInfo

        const verdict = shouldReply({
          tenantId: this.tenantId,
          groupId: group.group_id,
          senderJid: sender,
          text,
          isDirectMention,
          isReplyToX
        })

        if (verdict.reply) {
          ;(async () => {
            try {
              const delay = 800 + Math.floor(Math.random() * 2200)
              await new Promise((r) => setTimeout(r, delay))

              try {
                if (this.sock?.sendPresenceUpdate) {
                  await this.sock.sendPresenceUpdate('composing', group.group_id)
                }
              } catch {}

              const senderName = this.getMemberDisplayName(group.group_id, sender, 'someone')

              const repliedTo =
                ctx?.quotedMessage?.conversation ||
                ctx?.quotedMessage?.extendedTextMessage?.text ||
                null

               const result = await generateReply({
                tenantId: this.tenantId,
                groupId: group.group_id,
                groupName: group.name,
                senderJid: sender,
                senderName,
                text,
                repliedTo,
                isReplyToXDirectly: isReplyToX,
                isDirectMention,
                isDM: false
              })

                   /* -----------------------------------------------------
               * Image intent — render instead of replying.
               * --------------------------------------------------- */
              if (result?.imageIntent) {
                try {
                  const prompt = String(result.imageIntent).slice(0, 400)
                  const encoded = encodeURIComponent(prompt)

                  const url =
                    `https://image.pollinations.ai/prompt/${encoded}` +
                    `?width=1024&height=1024&nologo=true&model=flux`

                  const imgRes = await fetch(url, {
                    signal: AbortSignal.timeout(90000)
                  })

                  if (!imgRes.ok) {
                    throw new Error(`image gen returned ${imgRes.status}`)
                  }

                  const buf = Buffer.from(await imgRes.arrayBuffer())

                  await this.sendImage(
                    group.group_id,
                    buf,
                    `🎨 *${prompt}*`,
                    [],
                    message
                  )

                  markReplied(this.tenantId, group.group_id)

                  try {
                    if (this.sock?.sendPresenceUpdate) {
                      await this.sock.sendPresenceUpdate('paused', group.group_id)
                    }
                  } catch {}
                } catch (imgError) {
                  console.warn(
                    '[X IMAGE] generation failed:',
                    imgError?.message || imgError
                  )

                  await this.safeSendMessage(
                    group.group_id,
                    {
                      text: `ei the image generator dey vex 😭 try again small`,
                      mentions: []
                    },
                    { label: 'image fail', quoted: message }
                  )
                }
                return
              }

      if (!result?.text) {
        try {
          if (this.sock?.sendPresenceUpdate) {
            await this.sock.sendPresenceUpdate('paused', group.group_id)
          }
        } catch {}
        return
      }

      await this.safeSendMessage(
        group.group_id,
        { text: result.text, mentions: result.mentions || [] },
        { label: 'agent reply', quoted: message }
      )

              markReplied(this.tenantId, group.group_id)

              try {
                if (this.sock?.sendPresenceUpdate) {
                  await this.sock.sendPresenceUpdate('paused', group.group_id)
                }
              } catch {}
            } catch (error) {
              console.warn('[X AGENT] reply failed:', error?.message || error)
            }
          })()
        }
      }
    }

    /* ---- Unprompted take (group only) ---- */
    if (
      text &&
      isAgentEnabled(this.tenantId, group.group_id) &&
      Math.random() < 0.15
    ) {
      const lastDrop = this._lastUnprompted.get(group.group_id) || 0
      if (Date.now() - lastDrop >= 10 * 60 * 1000 && quietMinutesBeforeMessage >= 20) {
        this._lastUnprompted.set(group.group_id, Date.now())
        generateReply({
          tenantId: this.tenantId,
          groupId: group.group_id,
          groupName: group.name,
          senderJid: sender,
          senderName: this.getMemberDisplayName(group.group_id, sender, 'someone'),
          text: '[system: the group has been quiet. drop one short take or start a topic. do not reply to the last message]',
          repliedTo: null,
          isReplyToXDirectly: false,
          isDirectMention: false,
          isDM: false
        }).then((result) => result?.text && this.safeSendMessage(
          group.group_id,
          { text: result.text, mentions: result.mentions || [] },
          { label: 'unprompted take', quoted: message }
        ).then(() => markReplied(this.tenantId, group.group_id)))
        .catch((error) => console.warn('[X AGENT] unprompted take failed:', error?.message || error))
      }
    }

    /* ====================================================================== */
    /* END [X AGENT]                                                          */
    /* ====================================================================== */

    /* ---- AUTO VIEW-ONCE CAPTURE ---- */
    try {
      await this.captureViewOnce(jid, message, sender, null)
    } catch (error) {
      if (this.antideleteDebug) {
        console.warn(
          '[X VIEWONCE] handleMessage capture failed:',
          error?.message || error
        )
      }
    }

    if (sender && message.pushName) {
      try {
        if (!this.sock.store) this.sock.store = {}
        if (!this.sock.store.contacts) this.sock.store.contacts = {}
        const existing = this.sock.store.contacts[sender] || {}
        this.sock.store.contacts[sender] = {
          ...existing,
          id: sender,
          notify: message.pushName,
          name: existing.name || message.pushName
        }
      } catch {}
    }

    if (group && sender) {
      const pushName = cleanDisplayIdentity(message?.pushName)

      const messageUsername =
        cleanDisplayIdentity(message?.username) ||
        cleanDisplayIdentity(message?.key?.username) ||
        cleanDisplayIdentity(message?.key?.participantUsername) ||
        cleanDisplayIdentity(message?.user?.username)

      const participantAlt =
        message?.key?.participantAlt ||
        message?.key?.remoteJidAlt ||
        null

      const existing = findMemberByIdentity(this.tenantId, group.group_id, {
        jid: sender,
        lid: participantAlt,
        username: messageUsername
      })

      if (existing || pushName || messageUsername) {
        const resolvedName =
          pushName || this.resolveContactName(sender, group.group_id)

        updateMemberIdentity(this.tenantId, group.group_id, existing?.jid || sender, {
          displayName:
            resolvedName ||
            existing?.display_name ||
            existing?.username ||
            null,
          username: messageUsername || existing?.username || null,
          lid: participantAlt || existing?.lid || null,
          phone: existing?.phone || null
        })
      }
    }

    if (group) {
      this.recordMessage(group, sender)

      const senderMember = getMember(this.tenantId, group.group_id, sender)

      try {
        const hunt = await huntIfRival({
          runtime: this,
          group,
          sender,
          senderJid: sender,
          text,
          message,
          senderMember
        })
        if (hunt?.handled) return
      } catch (error) {
        console.warn('[X HUNTER] hunt failed:', error?.message || error)
      }

      const isAdmin = await this.isGroupAdmin(group.group_id, sender)
      const isOwnerSender = this.isOwner({ jid: sender })
      const exempt = isAdmin || isOwnerSender

      if (
        !exempt &&
        group.anti_link &&
        /(https?:\/\/|chat\.whatsapp\.com|wa\.me)/i.test(text)
      ) {
        await this.enforceWarning({
          group,
          targetJid: sender,
          reason: 'Posting unauthorized links',
          sourceLabel: 'AntiLink',
          offendingMessageKey: message.key
        })
        return
      }

      if (
        !exempt &&
        group.anti_spam &&
        this.isSpam(group.group_id, sender)
      ) {
        this.spamBuckets.delete(`${group.group_id}:${sender}`)
        await this.enforceWarning({
          group,
          targetJid: sender,
          reason: 'Spamming the group',
          sourceLabel: 'AntiSpam',
          offendingMessageKey: message.key
        })
        return
      }
    }

    if (!text) return

    const prefix = group?.prefix || process.env.X_DEFAULT_PREFIX || '.'

    if (!text.startsWith(prefix)) return

    const body = text.slice(prefix.length).trim()
    const [name, ...args] = body.split(/\s+/)

    if (!name) return

    const mentions =
      message.message.extendedTextMessage?.contextInfo?.mentionedJid ||
      message.message.imageMessage?.contextInfo?.mentionedJid ||
      []

    if (name.toLowerCase() === 'ai') {
      if (!group) {
        try {
          await this.safeSendMessage(
            jid,
            { text: 'AI group intelligence is available inside groups so X can keep context isolated.' },
            { label: 'AI availability' }
          )
        } catch (error) {
          console.warn('[X AI] Could not send response:', error?.message || error)
        }
        return
      }

      try {
        await this.reactTo(jid, message.key, '🧠')
        const answer = await answerWithConfiguredProvider(
          jid,
          body.slice(name.length).trim()
        )
        await this.safeSendMessage(
          jid,
          { text: answer.text },
          { label: 'AI response' }
        )
      } catch (error) {
        console.error('[X AI] Error:', error)
      }
      return
    }

    const command = await import('./commands.mjs').then((module) =>
      module.getCommand(name)
    )

    if (!command) return

    const identity = identityFromMessage(message)
    identity.jid = sender

    // --- DEBUG LOGS ---
    console.log('🚨 SENDER:', sender)
    console.log('🚨 IDENTITY:', JSON.stringify(identity, null, 2))
    console.log('🚨 ENV OWNER JID:', process.env.X_OWNER_JID)
    console.log('🚨 ENV OWNER LID:', process.env.X_OWNER_LID)
    console.log('🚨 ENV OWNER NUMBER:', process.env.X_OWNER_NUMBER)
    console.log('🚨 IS_OWNER?', this.isOwner(identity))
    // ------------------

    const role = roleFor({
      identity,
      member: group ? getMember(this.tenantId, group.group_id, sender) : null
    })
    if (getBotMode() === 'private' && role !== 'owner') return

    if (command.owner && !can(role, 'owner')) {
      try {
        await this.reactTo(jid, message.key, '⛔')
        await this.safeSendMessage(
          jid,
          { text: '👑 Owner permission required.' },
          { label: 'owner permission' }
        )
      } catch {}
      return
    }

    if (command.admin && group && !can(role, 'moderator')) {
      try {
        await this.reactTo(jid, message.key, '⛔')
        await this.safeSendMessage(
          jid,
          { text: '🛡️ Admin permission required.' },
          { label: 'admin permission' }
        )
      } catch {}
      return
    }

    const ackEmoji = reactionFor(command)
    this.reactTo(jid, message.key, ackEmoji).catch(() => {})

    try {
      const rawInput = args.join(' ').trim().toLowerCase()

      const isMangaSelection =
        /^ch\s+\d+(\s*-\s*\d+)?$/i.test(rawInput) ||
        rawInput === 'cancel'

      if (isMangaSelection) {
        const selectionResult = await handleMangaSelection({
          runtime: this,
          group,
          sender,
          args
        })

        if (selectionResult !== null) {
          if (selectionResult) {
            await this.safeSendMessage(
              group.group_id,
              { text: selectionResult },
              { label: 'manga selection' }
            )
          }
          return
        }
      }

      try {
        logTenantActivity(
          this.tenantId,
          group?.group_id || null,
          sender,
          name,
          body
        )
      } catch (error) {
        console.warn('[X ACTIVITY] log failed:', error?.message || error)
      }

      const response = await executeCommand(
        {
          runtime: this,
          group,
          sender,
          args,
          mentions,
          message
        },
        name,
        args
      )

      this.reactTo(jid, message.key, '✅').catch(() => {})

      if (response && this.isConnected()) {
        const responseText =
          typeof response === 'string'
            ? response
            : response.text

        const responseMentions =
          typeof response === 'string'
            ? mentions
            : response.mentions || []

        let cardBuffer = null

        try {
          const asset = getCommandAsset(this.tenantId, command.name)

          if (asset?.url) {
            const res = await fetch(asset.url, {
              signal: AbortSignal.timeout(8000)
            })
            if (res.ok) {
              cardBuffer = Buffer.from(await res.arrayBuffer())
            }
          }
        } catch (error) {
          console.warn(
            `[X CARD] custom asset fetch failed for ${command.name}:`,
            error?.message || error
          )
        }

        const cardsEnabled = false // Disabled globally

        if (!cardBuffer && responseText && cardsEnabled) {
          try {
            const senderName = this.getMemberDisplayName(
              group?.group_id || jid,
              sender,
              'User'
            )

            cardBuffer = await commandCard({
              command: command.name,
              category: command.category,
              description: command.description,
              usage: command.usage,
              reaction: command.reaction,
              admin: command.admin,
              owner: command.owner,
              responseText,
              senderName
            })
          } catch (error) {
            console.warn(
              `[X CARD] generation failed for ${command.name}:`,
              error?.message || error
            )
          }
        }

        if (
          typeof response === 'object' &&
          response !== null &&
          response.__board
        ) {
          await this.dispatchBoardResponse(jid, response, group, sender)
          return
        }

        if (cardBuffer) {
          await this.sendImage(jid, cardBuffer, responseText, responseMentions)
        } else {
          await this.safeSendMessage(
            jid,
            { text: responseText, mentions: responseMentions },
            { label: `${prefix}${name} response` }
          )
        }
      }
    } catch (error) {
      this.lastError = error?.message || String(error)
      console.error(`[X COMMAND] .${name} failed:`, error)

      this.reactTo(jid, message.key, '❌').catch(() => {})

      if (
        error?.code === 'MEDIA_UPLOAD_FAILED' ||
        error?.code === 'WHATSAPP_DISCONNECTED'
      ) {
        return
      }

      if (!this.isConnected()) return

      try {
        await this.safeSendMessage(
          jid,
          { text: `❌ ${error?.message || 'Command failed.'}` },
          { label: `${prefix}${name} error` }
        )
      } catch (sendError) {
        console.warn(
          `[X COMMAND] Failed to send .${name} error response:`,
          sendError?.message || sendError
        )
      }
    }
  }


  /* -----------------------------------------------------
   * Reaction handling
   * --------------------------------------------------- */

  async handleReaction(message) {
    if (!this.isConnected()) return

    const reaction = message.message.reactionMessage

    const targetId = reaction?.key?.id
    const targetRemote = reaction?.key?.remoteJid

    if (!targetId || !targetRemote?.endsWith('@g.us')) return

    const sender =
      message.key.participant ||
      message.key.remoteJid

    const emoji = String(reaction?.text || '').trim()
    if (!emoji) return
    if (isBanned(sender)) return

    const game = getGameByBoardMessageId(this.tenantId, targetId)
    if (!game) return

    const moveMap = {
      '1️⃣': '1', '2️⃣': '2', '3️⃣': '3',
      '4️⃣': '4', '5️⃣': '5', '6️⃣': '6',
      '7️⃣': '7', '8️⃣': '8', '9️⃣': '9'
    }

    const move = moveMap[emoji]
    if (!move) return

    const state = JSON.parse(game.state_json)

    if (
      Array.isArray(state.players) &&
      !state.players.includes(sender)
    ) {
      return
    }

    const group = getGroup(this.tenantId, targetRemote)
    if (!group) return

    try {
      await this.reactTo(targetRemote, message.key, '✅')
    } catch {}

    try {
      await this.safeSendMessage(
        targetRemote,
        {
          delete: {
            remoteJid: targetRemote,
            fromMe: true,
            id: targetId
          }
        },
        { label: 'board delete' }
      )
    } catch (error) {
      console.warn(
        '[X REACTION] Could not delete old board:',
        error?.message || error
      )
    }

    try {
      const commandsModule = await import('./commands.mjs')

      const command = commandsModule.getCommand(game.type)
      if (!command) return

      const response = await commandsModule.executeCommand(
        {
          runtime: this,
          group,
          sender,
          args: [move],
          mentions: [],
          message: {
            key: message.key,
            message: { conversation: '' },
            pushName: message.pushName
          }
        },
        game.type,
        [move]
      )

      if (response && this.isConnected()) {
        await this.dispatchBoardResponse(
          targetRemote,
          response,
          group,
          sender
        )
      }
    } catch (error) {
      console.error(
        '[X REACTION] Re-dispatch failed:',
        error?.message || error
      )
    }
  }


  async dispatchBoardResponse(jid, response, group, sender) {
    if (typeof response !== 'object' || !response.__board) {
      if (response && this.isConnected()) {
        const text =
          typeof response === 'string'
            ? response
            : response.text

        if (text) {
          await this.safeSendMessage(
            jid,
            { text, mentions: response.mentions || [] },
            { label: 'board text fallback' }
          )
        }
      }
      return
    }

    if (response.spinningImage) {
      try {
        await this.sendImage(
          jid,
          response.spinningImage,
          'Spinning…',
          []
        )
        await new Promise((r) => setTimeout(r, 1200))
      } catch {}
    }

    try {
      const sent = await this.sendImage(
        jid,
        response.image,
        response.text || '',
        response.mentions || []
      )

      const messageId = sent?.key?.id

      if (messageId && response.result?.id) {
        setBoardMessageId(
          this.tenantId,
          response.result.id,
          messageId
        )
      }

      if (response.reactions?.length) {
        const hint = response.reactions.join(' ')

        try {
          await this.safeSendMessage(
            jid,
            {
              text: `React with a number to play.\n${hint}`
            },
            { label: 'board reaction hint' }
          )
        } catch {}
      }
    } catch (error) {
      console.error(
        '[X BOARD] Failed to send board:',
        error?.message || error
      )
    }
  }


  /* -----------------------------------------------------
   * Anti-spam
   * --------------------------------------------------- */

  isSpam(groupId, sender) {
    const key = `${groupId}:${sender}`
    const now = Date.now()

    const bucket = this.spamBuckets.get(key) || []
    const next = bucket.filter((timestamp) => now - timestamp < 8000)

    next.push(now)
    this.spamBuckets.set(key, next)

    return next.length >= 7
  }


  /* -----------------------------------------------------
   * Member identity
   * --------------------------------------------------- */

  resolveMember(groupId, identity = {}) {
    return findMemberByIdentity(this.tenantId, groupId, identity)
  }


  getMemberDisplayName(groupId, jid, fallback = 'Member') {
    return resolveStoredMemberDisplayName(
      this.tenantId,
      groupId,
      jid,
      fallback === 'Member' ? 'New member' : fallback
    )
  }


  rememberMemberIdentity(groupId, jid, identity = {}) {
    if (!groupId || !jid) return null
    return updateMemberIdentity(this.tenantId, groupId, jid, identity)
  }


  /* -----------------------------------------------------
   * Message statistics
   * --------------------------------------------------- */

  recordMessage(group, sender) {
    const key = `${group.group_id}:${sender}`
    const last = this.cooldowns.get(key) || 0

    if (Date.now() - last < 12000) return

    this.cooldowns.set(key, Date.now())

    touchMember(this.tenantId, group.group_id, sender, { messages: 1 })
    awardXP(this.tenantId, group.group_id, sender, 5)
  }


  getQuietMinutes(groupId) {
    const row = db.prepare(`
      SELECT ts FROM x_agent_chatlog
      WHERE tenant_id = ? AND group_id = ?
      ORDER BY ts DESC LIMIT 1
    `).get(this.tenantId, groupId)
    return row?.ts ? Math.floor((Date.now() - row.ts) / 60000) : 999
  }


  /* -----------------------------------------------------
   * Group admin check
   * --------------------------------------------------- */

  async isGroupAdmin(groupId, jid) {
    const member = getMember(this.tenantId, groupId, jid)
    return Boolean(
      member && (member.role === 'admin' || member.role === 'superadmin')
    )
  }


  /* -----------------------------------------------------
   * Group Mute/Unmute
   * --------------------------------------------------- */

  async setGroupMuted(groupId) {
    if (!this.isConnected()) throw new Error('WhatsApp is disconnected.')
    if (!String(groupId || '').endsWith('@g.us')) {
      throw new Error('This command can only be used inside a group.')
    }

    try {
      const result = await this.sock.groupSettingUpdate(groupId, 'announcement')

      updateGroupSettings(this.tenantId, groupId, { settings: { announce: true } })

      try {
        await this.syncGroup(groupId)
      } catch (syncError) {
        console.warn(
          '[X GROUP] Mute succeeded but sync failed:',
          syncError?.message || syncError
        )
      }

      return result
    } catch (error) {
      const code = error?.output?.statusCode || error?.statusCode
      if ([428, 408, 503, 500].includes(code)) {
        this.markDisconnected(error)
        this.scheduleReconnect(2500)
      }

      const message = String(error?.message || '')
      if (/not authorized|forbidden|admin/i.test(message)) {
        throw new Error('X must be a group admin to mute this group.')
      }

      throw error
    }
  }


  async setGroupUnmuted(groupId) {
    if (!this.isConnected()) throw new Error('WhatsApp is disconnected.')
    if (!String(groupId || '').endsWith('@g.us')) {
      throw new Error('This command can only be used inside a group.')
    }

    try {
      const result = await this.sock.groupSettingUpdate(groupId, 'not_announcement')

      updateGroupSettings(this.tenantId, groupId, { settings: { announce: false } })

      try {
        await this.syncGroup(groupId)
      } catch (syncError) {
        console.warn(
          '[X GROUP] Unmute succeeded but sync failed:',
          syncError?.message || syncError
        )
      }

      return result
    } catch (error) {
      const code = error?.output?.statusCode || error?.statusCode
      if ([428, 408, 503, 500].includes(code)) {
        this.markDisconnected(error)
        this.scheduleReconnect(2500)
      }

      const message = String(error?.message || '')
      if (/not authorized|forbidden|admin/i.test(message)) {
        throw new Error('X must be a group admin to unmute this group.')
      }

      throw error
    }
  }


  /* -----------------------------------------------------
   * Group participant actions
   * --------------------------------------------------- */

  async groupParticipantAction(groupId, participants, action) {
    if (!this.isConnected()) throw new Error('WhatsApp is disconnected.')

    if (!['kick', 'promote', 'demote'].includes(action)) {
      throw new Error('Unsupported participant action.')
    }

    const mapped = action === 'kick' ? 'remove' : action

    try {
      return await this.sock.groupParticipantsUpdate(groupId, participants, mapped)
    } catch (error) {
      const code = error?.output?.statusCode || error?.statusCode
      if ([428, 408, 503].includes(code)) {
        this.markDisconnected(error)
        this.scheduleReconnect(2500)
      }
      throw error
    }
  }


  /* -----------------------------------------------------
   * Member formatting
   * --------------------------------------------------- */

  formatMembers(groupId, page = 1) {
    const size = 15
    const currentPage = Math.max(1, Number(page) || 1)

    const rows = listMembers(this.tenantId, groupId, size, (currentPage - 1) * size)

    if (!rows.length) return 'No synchronized members found.'

    const mentions = []
    const lines = rows.map((member, index) => {
      const number = index + 1 + (currentPage - 1) * size
      const memberMention = createMention(member.jid)

      if (memberMention.jid) mentions.push(memberMention.jid)

      const role =
        member.role === 'superadmin'
          ? ' 👑'
          : member.role === 'admin'
          ? ' 🛡️'
          : ''

      return `${number}. ${memberMention.text || 'Member'}${role}`
    })

    return {
      text: [`👥 *GROUP MEMBERS — PAGE ${currentPage}*`, '', ...lines].join('\n'),
      mentions
    }
  }


  formatAdmins(groupId) {
    const rows = listMembers(this.tenantId, groupId, 100, 0).filter(
      (member) => member.role === 'admin' || member.role === 'superadmin'
    )

    if (!rows.length) return 'No admins synchronized.'

    const mentions = []
    const lines = rows.map((member, index) => {
      const memberMention = createMention(member.jid)
      if (memberMention.jid) mentions.push(memberMention.jid)

      const role = member.role === 'superadmin' ? ' 👑' : ''
      return `${index + 1}. ${memberMention.text || 'Member'}${role}`
    })

    return {
      text: ['🛡️ *ADMINS*', '', ...lines].join('\n'),
      mentions
    }
  }


  formatStats(groupId) {
    const stats = groupStats(this.tenantId, groupId)
    return (
      `📊 *GROUP STATS*\n` +
      `Members: ${stats.members}\n` +
      `Messages: ${stats.messages}\n` +
      `XP: ${stats.xp}\n` +
      `KC: ${stats.coins}`
    )
  }


  formatRank(groupId, jid) {
    const rows = leaderboard(this.tenantId, groupId, 'xp', 500)
    const index = rows.findIndex((row) => row.jid === jid)

    if (index < 0) return 'Member not synchronized.'

    const member = rows[index]
    const name = this.getMemberDisplayName(groupId, member.jid, 'New member')

    return `🏆 ${name} is *#${index + 1}* with ${member.xp} XP.`
  }


  async pairingCode(number) {
    if (!this.sock) throw new Error('WhatsApp socket is not initialized.')
    if (this.registered) throw new Error('This session is already registered.')

    const normalized = String(number).replace(/\D/g, '')
    if (!normalized) {
      throw new Error('Enter a WhatsApp number with country code.')
    }

    return this.sock.requestPairingCode(normalized)
  }


  /* -----------------------------------------------------
   * Owner identity
   * --------------------------------------------------- */

  isOwner(identity) {
    return rbacIsOwner(identity)
  }


  async logout() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.intentionalShutdown = true

    if (this.sock) {
      try {
        await this.sock.logout()
      } catch (error) {
        console.warn('[X WHATSAPP] Logout error:', error?.message || error)
      }

      this.sock = null
    }

    this.status = 'logged_out'
    this.qr = null

    return this.getStatus()
  }


  ownerSummary(identity = null) {
    const configured = configuredOwnerIdentifiers()
    if (!configured.size) {
      return '⚠️ No trusted owner identifier is configured.'
    }

    const categories = []
    if (process.env.X_OWNER_JID) categories.push('JID')
    if (process.env.X_OWNER_LID) categories.push('LID')
    if (process.env.X_OWNER_USERNAME) categories.push('username')
    if (process.env.X_OWNER_NUMBER) categories.push('number')

    const summary =
      `👑 Owner identity is configured with ${configured.size} trusted identifier(s)` +
      (categories.length ? ` (${categories.join(', ')})` : '') +
      `. Display names and profile pictures are never used as proof.`

    if (!identity) return summary

    const matched = this.isOwner(identity)

    return matched
      ? `${summary}\n\n✅ Your current sender identity matches the owner.`
      : `${summary}\n\n❌ Your current sender identity does NOT match any trusted identifier. If you believe this is wrong, check that X_OWNER_NUMBER contains your number in international format without + or spaces.`
  }


  async backfillMemberNames() {
    if (!this.isConnected()) return 0

    let updated = 0

    try {
      const groups = listGroups(this.tenantId)

      for (const group of groups) {
        try {
          const members = listMembers(this.tenantId, group.group_id, 500, 0)
          const unnamed = members.filter((m) => !m.display_name && !m.username)

          for (const member of unnamed) {
            const name = this.resolveContactName(member.jid, group.group_id)
            if (!name) continue

            try {
              updateMemberIdentity(this.tenantId, group.group_id, member.jid, {
                displayName: name,
                lid: member.lid,
                phone: member.phone
              })
              updated++
            } catch (err) {
              console.warn('[X BACKFILL] update failed:', err?.message || err)
            }
          }
        } catch (err) {
          console.warn('[X BACKFILL] group failed:', err?.message || err)
        }
      }
    } catch (err) {
      console.warn('[X BACKFILL] fatal:', err?.message || err)
    }

    if (updated > 0) {
      console.log(`[X BACKFILL] Repaired ${updated} member name(s).`)
    }

    return updated
  }


  getStatus() {
    return {
      tenantId: this.tenantId,
      status: this.status,
      qr: this.qr,
      lastError: this.lastError,
      connectedJid: this.sock?.user?.id || null,
      registered: this.registered,
      groupCount: this.groupCount,
      warmode: this.warmode,
      ownerConfigured: !!(
        process.env.X_OWNER_JID ||
        process.env.X_OWNER_USERNAME ||
        process.env.X_OWNER_NUMBER
      )
    }
  }
}


/* -------------------------------------------------------
 * Human identity helper
 * ----------------------------------------------------- */

function cleanDisplayIdentity(value) {
  const text = String(value ?? '').trim()
  if (!text) return null

  if (
    text.includes('@s.whatsapp.net') ||
    text.includes('@g.us') ||
    text.includes('@lid') ||
    text.includes('@broadcast')
  ) {
    return null
  }

  if (/^\+?\d[\d\s().-]*$/.test(text)) {
    return null
  }

  return text
}