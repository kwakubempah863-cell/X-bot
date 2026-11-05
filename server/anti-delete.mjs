// server/anti-delete.mjs
// Anti-Delete cache + view-once reveal.
//
// Persistence: SQLite table `antidelete_cache`. Survives
// bot restarts. TTL and per-chat cap keep the table bounded;
// a periodic sweep evicts old rows.
//
// View-once reality on baileys 7.0.0-rc14:
//   - Inbound view-once arrives with the wrapper stripped.
//   - The bot cannot tell it is a view-once at send time.
//   - When someone REPLIES to a view-once, the reply's
//     contextInfo.quotedMessage still carries the wrapper.
//   - cacheFromReply() captures that wrapper and stores it
//     under the original message ID, enabling auto-recovery
//     from that point forward.

import {
  downloadContentFromMessage
} from '@whiskeysockets/baileys'

import db from './db.mjs'

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

db.exec(`
CREATE TABLE IF NOT EXISTS antidelete_cache (
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  chat_id     TEXT NOT NULL,
  message_id  TEXT NOT NULL,
  envelope    TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'text',
  stored_at   INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, chat_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_antidelete_chat
  ON antidelete_cache(tenant_id, chat_id, stored_at DESC);
CREATE INDEX IF NOT EXISTS idx_antidelete_age
  ON antidelete_cache(stored_at);
CREATE INDEX IF NOT EXISTS idx_antidelete_kind
  ON antidelete_cache(tenant_id, chat_id, kind, stored_at DESC);
`)

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const KIND_TEXT = 'text'
const KIND_VIEWONCE = 'viewonce'
const REVOKE_TYPE = 0

/* -------------------------------------------------------------------------- */
/* MessageStore                                                               */
/* -------------------------------------------------------------------------- */

export class MessageStore {
  constructor({
    tenantId = 'default',
    maxMessagesPerChat = 1000,
    ttl = 24 * 60 * 60 * 1000,
    cleanupInterval = 60 * 60 * 1000,
    debug = false
  } = {}) {
    this.tenantId = tenantId
    this.maxMessagesPerChat = maxMessagesPerChat
    this.ttl = ttl
    this.debug = debug

    this.insertStmt = db.prepare(`
      INSERT INTO antidelete_cache (
        tenant_id, chat_id, message_id, envelope, kind, stored_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, chat_id, message_id)
      DO UPDATE SET
        envelope = excluded.envelope,
        kind = excluded.kind,
        stored_at = excluded.stored_at
    `)

    this.getStmt = db.prepare(`
      SELECT envelope, kind, stored_at FROM antidelete_cache
      WHERE tenant_id = ? AND chat_id = ? AND message_id = ?
      LIMIT 1
    `)

    this.pruneChatStmt = db.prepare(`
      DELETE FROM antidelete_cache
      WHERE tenant_id = ?
        AND chat_id = ?
        AND message_id NOT IN (
          SELECT message_id FROM antidelete_cache
          WHERE tenant_id = ? AND chat_id = ?
          ORDER BY stored_at DESC
          LIMIT ?
        )
    `)

    this.pruneAgeStmt = db.prepare(`
      DELETE FROM antidelete_cache
      WHERE stored_at < ?
    `)

    this.cleanupTimer = setInterval(
      () => this.cleanup(),
      cleanupInterval
    )
    this.cleanupTimer.unref?.()

    this._log('store initialised', {
      tenantId,
      maxMessagesPerChat,
      ttl
    })
  }

  _log(...args) {
    if (!this.debug) return
    console.log('[X ANTIDELETE]', ...args)
  }

  /**
   * Cache a baileys message envelope.
   *
   * Caches under:
   *   - the outer `message.key.id`
   *   - `<id>:vo` alias for view-once (kept for parity)
   *   - any `messageContextInfo.stanzaId` inside the wrapper
   *
   * View-once that arrives with a stripped wrapper is stored
   * as `text` — that is unavoidable. cacheFromReply() is what
   * upgrades it to `viewonce` later.
   */
    storeMessage(message) {
    if (!message?.key?.remoteJid || !message?.key?.id) return

    /*
     * Do NOT bail on a missing body. Baileys sometimes delivers
     * a stub first and the real body second, and we want both
     * cached so a REVOKE on either ID finds *something*.
     *
     * If the body is empty we still write the row, mark it as
     * text, and cacheFromReply() will later upgrade it to
     * viewonce if the wrapper becomes available.
     */
    const chatId = message.key.remoteJid
    const id = message.key.id

    const inner = message.message || null
    const kind = inner ? detectKind(inner) : KIND_TEXT
    const now = Date.now()
    const envelope = JSON.stringify(message)

    this._insert(chatId, id, envelope, kind, now)

    if (inner) {
      const stanzaIds = extractStanzaIds(inner)
      for (const stanzaId of stanzaIds) {
        if (!stanzaId || stanzaId === id) continue
        this._insert(chatId, stanzaId, envelope, kind, now)
      }

      if (kind === KIND_VIEWONCE) {
        this._insert(chatId, `${id}:vo`, envelope, kind, now)
      }
    }

    try {
      this.pruneChatStmt.run(
        this.tenantId, chatId, this.tenantId, chatId,
        this.maxMessagesPerChat
      )
    } catch {}
  }

  /**
   * [ANTIDELETE] Cache a view-once wrapper extracted from a
   * reply's contextInfo.quotedMessage.
   *
   * This is the mechanism that makes Option 2 work. Baileys
   * strips the wrapper from live messages before they reach
   * messages.upsert, so we never see the original view-once
   * with its `viewOnceMessageV2` wrapper. But when someone
   * REPLIES to a view-once, the reply's contextInfo carries
   * the original message verbatim — wrapper included.
   *
   * We cache it under the original message ID so auto-recovery
   * works if the view-once is later deleted.
   *
   * Returns true if the wrapper was present and cached.
   */
  cacheFromReply(chatId, messageId, senderJid, quotedMessage) {
    if (!chatId || !messageId || !quotedMessage) return false

    const wrapperPresent =
      quotedMessage.viewOnceMessage ||
      quotedMessage.viewOnceMessageV2 ||
      quotedMessage.viewOnceMessageV2Extension

    if (!wrapperPresent) return false

    const envelope = {
      key: {
        remoteJid: chatId,
        id: messageId,
        participant: senderJid || null,
        fromMe: false
      },
      message: quotedMessage,
      messageTimestamp: Math.floor(Date.now() / 1000)
    }

    const now = Date.now()
    const serialized = JSON.stringify(envelope)

    this._insert(chatId, messageId, serialized, KIND_VIEWONCE, now)
    this._insert(chatId, `${messageId}:vo`, serialized, KIND_VIEWONCE, now)

    const stanzaIds = extractStanzaIds(quotedMessage)
    for (const stanzaId of stanzaIds) {
      if (!stanzaId || stanzaId === messageId) continue
      this._insert(chatId, stanzaId, serialized, KIND_VIEWONCE, now)
    }

    this._log('cacheFromReply stored', {
      chatId, messageId, senderJid
    })

    return true
  }

  _insert(chatId, messageId, envelope, kind, now) {
    try {
      this.insertStmt.run(
        this.tenantId, chatId, messageId, envelope, kind, now
      )
    } catch (error) {
      this._log('insert failed:', messageId, error?.message || error)
    }
  }

  /**
   * Fetch a cached envelope by chat + message id.
   * Tries the plain ID, then the `:vo` alias.
   */
  getMessage(chatId, messageId) {
    if (!chatId || !messageId) return null

    const candidates = [messageId, `${messageId}:vo`]

    for (const key of candidates) {
      try {
        const row = this.getStmt.get(
          this.tenantId, chatId, key
        )
        if (!row) continue

        if (Date.now() - row.stored_at > this.ttl) continue

        try {
          return JSON.parse(row.envelope)
        } catch {
          return null
        }
      } catch (error) {
        this._log('get failed:', error?.message || error)
      }
    }

    return null
  }

  /**
   * Returns the kind of a cached message without deserialising
   * the full envelope.
   */
  getKind(chatId, messageId) {
    if (!chatId || !messageId) return null

    for (const key of [messageId, `${messageId}:vo`]) {
      try {
        const row = this.getStmt.get(
          this.tenantId, chatId, key
        )
        if (!row) continue
        if (Date.now() - row.stored_at > this.ttl) continue
        return row.kind
      } catch {}
    }

    return null
  }

  /**
   * Fallback lookup for .vv. Walks recent view-once entries in
   * the chat and returns the one whose sender matches, or the
   * newest one in the window.
   */
  findRecentViewOnce(chatId, senderJid = null, windowMs = 10 * 60 * 1000) {
    if (!chatId) return null

    const cutoff = Date.now() - windowMs

    let rows

    try {
      rows = db.prepare(`
        SELECT message_id, envelope, stored_at
        FROM antidelete_cache
        WHERE tenant_id = ?
          AND chat_id = ?
          AND kind = ?
          AND stored_at >= ?
        ORDER BY stored_at DESC
        LIMIT 20
      `).all(this.tenantId, chatId, KIND_VIEWONCE, cutoff)
    } catch (error) {
      this._log('findRecentViewOnce query failed:', error?.message || error)
      return null
    }

    if (!rows.length) return null

    if (senderJid) {
      const bare = String(senderJid).split('@')[0]

      for (const row of rows) {
        try {
          const envelope = JSON.parse(row.envelope)
          const participant =
            envelope?.key?.participant ||
            envelope?.key?.remoteJid ||
            ''

          if (participant.includes(bare)) {
            return envelope
          }
        } catch {}
      }
    }

    try {
      return JSON.parse(rows[0].envelope)
    } catch {
      return null
    }
  }

  cleanup() {
    const cutoff = Date.now() - this.ttl
    try {
      const res = this.pruneAgeStmt.run(cutoff)
      if (res.changes > 0) {
        this._log(`cleanup evicted ${res.changes} rows`)
      }
    } catch (error) {
      this._log('cleanup failed:', error?.message || error)
    }
  }

  markAsDeleted(chatId, messageId) {
    const original = this.getMessage(chatId, messageId)
    if (!original) return null
    return { original, deletedAt: Date.now() }
  }
}

/* -------------------------------------------------------------------------- */
/* Kind detection                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Determine whether a message is a view-once.
 *
 * On baileys 7.0.0-rc14 the wrapper is stripped before we see
 * it, so the only reliable signal is the inner media's own
 * `viewOnce: true` flag — and even that is often stripped.
 *
 * The wrapper branch is kept for the case where baileys or a
 * future version DOES preserve it.
 */
function detectKind(inner) {
  if (!inner) return KIND_TEXT

  if (
    inner.viewOnceMessage ||
    inner.viewOnceMessageV2 ||
    inner.viewOnceMessageV2Extension
  ) {
    return KIND_VIEWONCE
  }

  if (
    inner.imageMessage?.viewOnce === true ||
    inner.videoMessage?.viewOnce === true ||
    inner.audioMessage?.viewOnce === true
  ) {
    return KIND_VIEWONCE
  }

  return KIND_TEXT
}

/* -------------------------------------------------------------------------- */
/* Stanza ID extractor                                                        */
/* -------------------------------------------------------------------------- */

function extractStanzaIds(inner) {
  if (!inner) return []

  const ids = []

  const containers = [
    inner.viewOnceMessage?.message,
    inner.viewOnceMessageV2?.message,
    inner.viewOnceMessageV2Extension?.message
  ]

  for (const wrapped of containers) {
    if (!wrapped) continue

    const candidates = [
      wrapped.messageContextInfo?.stanzaId,
      wrapped.imageMessage?.messageContextInfo?.stanzaId,
      wrapped.videoMessage?.messageContextInfo?.stanzaId,
      wrapped.audioMessage?.messageContextInfo?.stanzaId
    ]

    for (const id of candidates) {
      if (typeof id === 'string' && id.length > 0) {
        ids.push(id)
      }
    }
  }

  return [...new Set(ids)]
}

/* -------------------------------------------------------------------------- */
/* REVOKE detection                                                           */
/* -------------------------------------------------------------------------- */

export function extractRevoke(update) {
  const proto = update?.update?.message?.protocolMessage

  if (proto && proto.type === REVOKE_TYPE && proto.key) {
    return {
      key: proto.key,
      protocolMessage: proto
    }
  }

  const stub = update?.update?.messageStubType

  if (stub === 1 && update?.key?.id && update?.key?.remoteJid) {
    return {
      key: update.key,
      protocolMessage: {
        type: REVOKE_TYPE,
        key: update.key,
        participant:
          update?.update?.participant ||
          update?.key?.participant ||
          null
      }
    }
  }

  return null
}

export function isDeleteMessage(update) {
  return Boolean(extractRevoke(update))
}

export function getDeletedMessageKey(update) {
  const r = extractRevoke(update)
  return r?.key || null
}

/* -------------------------------------------------------------------------- */
/* View-once unwrap                                                           */
/* -------------------------------------------------------------------------- */

const VIEW_ONCE_CONTAINERS = [
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension'
]

/**
 * Given a raw baileys message envelope, return `{ node, type }`
 * for the view-once media, or null.
 *
 * Handles wrapped, stripped-but-flagged, and stripped-flagged.
 */
export function unwrapViewOnce(message) {
  if (!message) return null

  const inner = message.message || message

  for (const key of VIEW_ONCE_CONTAINERS) {
    const wrapped = inner[key]?.message
    if (!wrapped) continue

    if (wrapped.imageMessage) {
      return { node: wrapped.imageMessage, type: 'image' }
    }
    if (wrapped.videoMessage) {
      return { node: wrapped.videoMessage, type: 'video' }
    }
    if (wrapped.audioMessage) {
      return { node: wrapped.audioMessage, type: 'audio' }
    }
  }

  if (inner.imageMessage?.viewOnce === true) {
    return { node: inner.imageMessage, type: 'image' }
  }
  if (inner.videoMessage?.viewOnce === true) {
    return { node: inner.videoMessage, type: 'video' }
  }
  if (inner.audioMessage?.viewOnce === true) {
    return { node: inner.audioMessage, type: 'audio' }
  }

  return null
}

export async function downloadViewOnce(node, type) {
  const stream = await downloadContentFromMessage(node, type)
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}