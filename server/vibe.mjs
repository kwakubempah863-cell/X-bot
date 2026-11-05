// server/vibe.mjs

import { classifyVibe } from './persona.mjs'
import { chatCountSince } from './memory.mjs'
import db from './db.mjs'

const COOLDOWNS = new Map()
const HOURLY_BUCKETS = new Map()
const AGENT_DISABLED_GROUPS = new Set()

export function setAgentDisabled(tenantId, groupId, disabled) {
  const key = `${tenantId}:${groupId}`
  if (disabled) AGENT_DISABLED_GROUPS.add(key)
  else AGENT_DISABLED_GROUPS.delete(key)
}

export function isAgentDisabledInMemory(tenantId, groupId) {
  return AGENT_DISABLED_GROUPS.has(`${tenantId}:${groupId}`)
}

/* Mention-only mode — per group. Mirrors Meta AI's behavior. */
const MENTION_ONLY_GROUPS = new Set()

export function setMentionOnly(tenantId, groupId, enabled) {
  const key = `${tenantId}:${groupId}`
  if (enabled) MENTION_ONLY_GROUPS.add(key)
  else MENTION_ONLY_GROUPS.delete(key)
}

export function isMentionOnly(tenantId, groupId) {
  return MENTION_ONLY_GROUPS.has(`${tenantId}:${groupId}`)
}

const MIN_COOLDOWN_MS = 20 * 1000
const MAX_PER_HOUR = 25

const ACTIVE_THREADS = new Map()

export function markThread(tenantId, groupId) {
  const key = `${tenantId}:${groupId}`
  ACTIVE_THREADS.set(key, Date.now() + 5 * 60 * 1000)
}

function isActiveThread(tenantId, groupId) {
  const key = `${tenantId}:${groupId}`
  const exp = ACTIVE_THREADS.get(key)
  if (!exp) return false
  if (Date.now() > exp) {
    ACTIVE_THREADS.delete(key)
    return false
  }
  return true
}

export function shouldReply({
  tenantId = 'default',
  groupId,
  senderJid,
  text,
  isDirectMention = false,
  isReplyToX = false
}) {
  const key = `${tenantId}:${groupId}`
  const now = Date.now()

  /* -------------------------------------------------------
   * Mention-only mode — X stays silent unless summoned.
   * ----------------------------------------------------- */
  if (
    isMentionOnly(tenantId, groupId) &&
    !isDirectMention &&
    !isReplyToX
  ) {
    return { reply: false, reason: 'mention-only' }
  }

  if (isDirectMention || isReplyToX) {
    return { reply: true, reason: isReplyToX ? 'reply-to-x' : 'mention' }
  }

  const inThread = isActiveThread(tenantId, groupId)

  const last = COOLDOWNS.get(key) || 0
  const cd = inThread ? 5000 : MIN_COOLDOWN_MS
  if (now - last < cd) {
    return { reply: false, reason: 'cooldown' }
  }

  const bucket = (HOURLY_BUCKETS.get(key) || []).filter(
    (t) => now - t < 60 * 60 * 1000
  )
  HOURLY_BUCKETS.set(key, bucket)

  if (bucket.length >= MAX_PER_HOUR) {
    return { reply: false, reason: 'hourly-cap' }
  }

  const recentCount = chatCountSince(tenantId, groupId, 60 * 1000)

  const verdict = classifyVibe({
    text,
    sender: senderJid,
    recentCount
  })

  return {
    reply: verdict.reply,
    reason: verdict.reason,
    weight: verdict.weight
  }
}

export function markReplied(tenantId, groupId) {
  const key = `${tenantId}:${groupId}`
  COOLDOWNS.set(key, Date.now())

  const bucket = HOURLY_BUCKETS.get(key) || []
  bucket.push(Date.now())
  HOURLY_BUCKETS.set(key, bucket)

  markThread(tenantId, groupId)
}

export function isAgentEnabled(tenantId, groupId) {
  if (!groupId) return false

  if (String(groupId).startsWith('dm:')) return true

  /* In-memory kill switch wins over DB */
  if (isAgentDisabledInMemory(tenantId, groupId)) return false

  try {
    const row = db.prepare(`
      SELECT settings_json FROM groups
      WHERE tenant_id = ? AND group_id = ?
    `).get(tenantId, groupId)

    if (!row) return false

    const settings = JSON.parse(row.settings_json || '{}')
    return settings.agentEnabled !== false
  } catch {
    return false
  }
}

export function detectMentionOfX(message, xJids = [], currentName = null, recentCount = 0) {
  const contextInfo =
    message?.message?.extendedTextMessage?.contextInfo ||
    message?.message?.imageMessage?.contextInfo ||
    message?.message?.videoMessage?.contextInfo ||
    null

  const text = String(
    message?.message?.conversation ||
    message?.message?.extendedTextMessage?.text ||
    message?.message?.imageMessage?.caption ||
    message?.message?.videoMessage?.caption || ''
  )

  const bareJids = xJids.filter(Boolean).map((jid) => String(jid).split('@')[0])
  const tagged = (contextInfo?.mentionedJid || []).some((jid) => bareJids.includes(String(jid).split('@')[0]))
  const numberMentioned = bareJids.some((bare) => new RegExp(`@${bare}\\b`).test(text))
  const named = currentName && new RegExp(`\\b${String(currentName).replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i').test(text)
  const xToken = recentCount < 200 && /(?:^|\s)@?x(?:$|\s|[?!.,])/i.test(text)

  return {
    isMentioned: Boolean(numberMentioned || tagged || named || xToken),
    contextInfo
  }
}

export function detectReplyToX(message, xJid) {
  const contextInfo =
    message?.message?.extendedTextMessage?.contextInfo ||
    message?.message?.imageMessage?.contextInfo ||
    message?.message?.videoMessage?.contextInfo ||
    null

  const expected = String(xJid || '').split('@')[0]
  const participant = contextInfo?.participant || contextInfo?.participantAlt

  return {
    isReplyToX: Boolean(
      expected &&
      participant &&
      String(participant).split('@')[0] === expected
    ),
    contextInfo
  }
}

const DM_SPAM = new Map()

export function shouldReplyToDM(tenantId, jid, text) {
  const key = `${tenantId}:${jid}`
  const now = Date.now()
  const state = DM_SPAM.get(key) || {
    timestamps: [],
    cooldownUntil: 0,
    lastReply: 0,
    replies: []
  }

  state.timestamps = state.timestamps.filter((ts) => now - ts < 60 * 1000)
  state.replies = state.replies.filter((ts) => now - ts < 60 * 60 * 1000)
  state.timestamps.push(now)

  if (state.cooldownUntil > now) {
    DM_SPAM.set(key, state)
    return { reply: false, reason: 'spam-cooldown' }
  }

  if (state.timestamps.length > 20) {
    state.cooldownUntil = now + 5 * 60 * 1000
    state.lastReply = now
    DM_SPAM.set(key, state)
    return { reply: true, reason: 'spam-warning' }
  }

  if (now - state.lastReply < 3000) {
    return { reply: false, reason: 'cooldown' }
  }

  if (state.replies.length >= 60) {
    return { reply: false, reason: 'hourly-cap' }
  }

  state.lastReply = now
  state.replies.push(now)
  DM_SPAM.set(key, state)

  return { reply: true, reason: 'dm' }
}