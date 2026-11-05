// server/memory.mjs
// Per-group, per-user memory for X.
// Stores: facts about users, running jokes, X's own notes,
// and a rolling recent-chat window for context.

import db from './db.mjs'

/* -------------------------------------------------------------------------- */
/* Schema                                                                     */
/* -------------------------------------------------------------------------- */

db.exec(`
CREATE TABLE IF NOT EXISTS x_agent_memory (
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  group_id    TEXT NOT NULL,
  scope       TEXT NOT NULL,
  scope_key   TEXT NOT NULL,
  kind        TEXT NOT NULL,
  content     TEXT NOT NULL,
  importance  INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (tenant_id, group_id, scope, scope_key, kind)
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_group
  ON x_agent_memory(tenant_id, group_id, scope, kind);

CREATE TABLE IF NOT EXISTS x_agent_chatlog (
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  group_id    TEXT NOT NULL,
  message_id  TEXT NOT NULL,
  sender_jid  TEXT NOT NULL,
  sender_name TEXT,
  text        TEXT NOT NULL,
  ts          INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, group_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_chatlog_recent
  ON x_agent_chatlog(tenant_id, group_id, ts DESC);

CREATE TABLE IF NOT EXISTS x_dm_log (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  jid TEXT NOT NULL,
  direction TEXT NOT NULL,
  message_id TEXT,
  text TEXT NOT NULL,
  ts INTEGER NOT NULL,
  PRIMARY KEY (tenant_id, jid, message_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_log_jid
  ON x_dm_log(tenant_id, jid, ts DESC);
`)

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const CHATLOG_CAP = 200          // per group
const CHATLOG_TTL_MS = 7 * 24 * 60 * 60 * 1000

const now = () => new Date().toISOString()

/* -------------------------------------------------------------------------- */
/* Chatlog                                                                    */
/* -------------------------------------------------------------------------- */

export function logChat({
  tenantId = 'default',
  groupId,
  messageId,
  senderJid,
  senderName,
  text
}) {
  if (!groupId || !messageId || !senderJid || !text) return

  const trimmed = String(text).slice(0, 1000)

  try {
    db.prepare(`
      INSERT INTO x_agent_chatlog (
        tenant_id, group_id, message_id, sender_jid,
        sender_name, text, ts
      ) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(tenant_id, group_id, message_id) DO NOTHING
    `).run(
      tenantId,
      groupId,
      messageId,
      senderJid,
      senderName || null,
      trimmed,
      Date.now()
    )

    /* Prune old rows for this group */
    db.prepare(`
      DELETE FROM x_agent_chatlog
      WHERE tenant_id = ? AND group_id = ?
        AND message_id NOT IN (
          SELECT message_id FROM x_agent_chatlog
          WHERE tenant_id = ? AND group_id = ?
          ORDER BY ts DESC
          LIMIT ?
        )
    `).run(tenantId, groupId, tenantId, groupId, CHATLOG_CAP)

    /* Global TTL prune */
    db.prepare(`
      DELETE FROM x_agent_chatlog WHERE ts < ?
    `).run(Date.now() - CHATLOG_TTL_MS)
  } catch (error) {
    console.warn('[X MEMORY] logChat failed:', error?.message || error)
  }
}

export function recentChat(tenantId, groupId, limit = 20) {
  return db.prepare(`
    SELECT sender_jid, sender_name, text, ts
    FROM x_agent_chatlog
    WHERE tenant_id = ? AND group_id = ?
    ORDER BY ts DESC
    LIMIT ?
  `).all(tenantId, groupId, Math.max(1, Math.min(100, limit)))
    .reverse()
}

export function chatCountSince(tenantId, groupId, msAgo) {
  const cutoff = Date.now() - msAgo

  return db.prepare(`
    SELECT COUNT(*) AS c FROM x_agent_chatlog
    WHERE tenant_id = ? AND group_id = ? AND ts >= ?
  `).get(tenantId, groupId, cutoff).c
}

/* -------------------------------------------------------------------------- */
/* Memory notes                                                               */
/* -------------------------------------------------------------------------- */

/*
 * scope: 'user' | 'group' | 'x'
 * kind: 'fact' | 'joke' | 'note' | 'nickname' | 'grudge'
 */

export function rememberNote({
  tenantId = 'default',
  groupId,
  scope,
  scopeKey,
  kind,
  content,
  importance = 1
}) {
  if (!groupId || !scope || !scopeKey || !kind || !content) return null

  const timestamp = now()

  try {
    db.prepare(`
      INSERT INTO x_agent_memory (
        tenant_id, group_id, scope, scope_key, kind,
        content, importance, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?)
      ON CONFLICT(tenant_id, group_id, scope, scope_key, kind)
      DO UPDATE SET
        content = excluded.content,
        importance = excluded.importance,
        updated_at = excluded.updated_at
    `).run(
      tenantId,
      groupId,
      scope,
      scopeKey,
      kind,
      String(content).slice(0, 500),
      Math.max(1, Math.min(10, importance)),
      timestamp,
      timestamp
    )

    return true
  } catch (error) {
    console.warn('[X MEMORY] rememberNote failed:', error?.message || error)
    return false
  }
}

export function forgetNote({
  tenantId = 'default',
  groupId,
  scope,
  scopeKey,
  kind
}) {
  try {
    const result = db.prepare(`
      DELETE FROM x_agent_memory
      WHERE tenant_id = ? AND group_id = ?
        AND scope = ? AND scope_key = ? AND kind = ?
    `).run(tenantId, groupId, scope, scopeKey, kind)

    return result.changes > 0
  } catch {
    return false
  }
}

export function forgetAll(tenantId, groupId) {
  try {
    db.prepare(`
      DELETE FROM x_agent_memory
      WHERE tenant_id = ? AND group_id = ?
    `).run(tenantId, groupId)

    db.prepare(`
      DELETE FROM x_agent_chatlog
      WHERE tenant_id = ? AND group_id = ?
    `).run(tenantId, groupId)

    return true
  } catch {
    return false
  }
}

/* -------------------------------------------------------------------------- */
/* Memory lookup — build the context block                                    */
/* -------------------------------------------------------------------------- */

export function buildMemoryBlock({
  tenantId = 'default',
  groupId,
  senderJid,
  limit = 30,
  isDM = false
}) {
  if (isDM) return buildDMMemoryBlock({ tenantId, jid: senderJid, limit })

  const userFacts = db.prepare(`
    SELECT kind, content FROM x_agent_memory
    WHERE tenant_id = ? AND group_id = ?
      AND scope = 'user' AND scope_key = ?
    ORDER BY importance DESC, updated_at DESC
    LIMIT ?
  `).all(tenantId, groupId, senderJid, limit)

  const groupFacts = db.prepare(`
    SELECT kind, content FROM x_agent_memory
    WHERE tenant_id = ? AND group_id = ?
      AND scope = 'group'
    ORDER BY importance DESC, updated_at DESC
    LIMIT ?
  `).all(tenantId, groupId, limit)

  const lines = []

  if (userFacts.length) {
    lines.push('What you remember about the sender:')
    for (const f of userFacts) {
      lines.push(`  (${f.kind}) ${f.content}`)
    }
    lines.push('')
  }

  if (groupFacts.length) {
    lines.push('What you remember about the group:')
    for (const f of groupFacts) {
      lines.push(`  (${f.kind}) ${f.content}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/** Store a DM-scoped memory note. */
export function rememberDM({ tenantId = 'default', jid, kind, content, importance = 1 }) {
  return rememberNote({ tenantId, groupId: `dm:${jid}`, scope: 'dm', scopeKey: jid, kind, content, importance })
}

/** Build the private memory block for one DM participant. */
export function buildDMMemoryBlock({ tenantId = 'default', jid, limit = 30 }) {
  const rows = db.prepare(`
    SELECT kind, content FROM x_agent_memory
    WHERE tenant_id = ? AND scope = 'dm' AND scope_key = ?
    ORDER BY importance DESC, updated_at DESC LIMIT ?
  `).all(tenantId, jid, Math.max(1, Math.min(100, limit)))
  if (!rows.length) return ''
  return ['What you remember about this private conversation:', ...rows.map((row) => `  (${row.kind}) ${row.content}`), ''].join('\n')
}

function seasonReady(tenantId, groupId) {
  const row = db.prepare(`
    SELECT content FROM x_agent_memory
    WHERE tenant_id = ? AND group_id = ? AND scope = 'group' AND scope_key = ? AND kind = 'season'
  `).get(tenantId, groupId, groupId)
  const startedAt = Number(row?.content || 0)
  if (startedAt && Date.now() - startedAt >= 14 * 24 * 60 * 60 * 1000) {
    db.prepare(`DELETE FROM x_agent_memory WHERE tenant_id = ? AND group_id = ? AND kind IN ('favorite', 'beef')`).run(tenantId, groupId)
  }
  if (!startedAt || Date.now() - startedAt >= 14 * 24 * 60 * 60 * 1000) {
    rememberNote({ tenantId, groupId, scope: 'group', scopeKey: groupId, kind: 'season', content: String(Date.now()), importance: 1 })
  }
}

/** Set the group's current favorite member. */
export function setFavorite(tenantId, groupId, jid, note = '') {
  seasonReady(tenantId, groupId)
  return rememberNote({ tenantId, groupId, scope: 'group', scopeKey: jid, kind: 'favorite', content: note || jid, importance: 10 })
}

/** Get the group's current favorite member. */
export function getFavorite(tenantId, groupId) {
  seasonReady(tenantId, groupId)
  return db.prepare(`SELECT scope_key AS jid, content, updated_at FROM x_agent_memory WHERE tenant_id = ? AND group_id = ? AND kind = 'favorite' ORDER BY updated_at DESC LIMIT 1`).get(tenantId, groupId) || null
}

/** Add or refresh a playful beef entry. */
export function addBeef(tenantId, groupId, jid, reason) {
  seasonReady(tenantId, groupId)
  return rememberNote({ tenantId, groupId, scope: 'group', scopeKey: jid, kind: 'beef', content: String(reason).slice(0, 300), importance: 6 })
}

/** Get active beef entries, excluding stale interactions. */
export function getBeefs(tenantId, groupId) {
  seasonReady(tenantId, groupId)
  const cutoff = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  return db.prepare(`SELECT scope_key AS jid, content AS reason, updated_at FROM x_agent_memory WHERE tenant_id = ? AND group_id = ? AND kind = 'beef' AND updated_at >= ? ORDER BY updated_at DESC`).all(tenantId, groupId, cutoff)
}

/** Clear one group's beef entry. */
export function clearBeef(tenantId, groupId, jid) {
  return forgetNote({ tenantId, groupId, scope: 'group', scopeKey: jid, kind: 'beef' })
}

export function memoryStats(tenantId, groupId) {
  const userNotes = db.prepare(`
    SELECT COUNT(*) AS c FROM x_agent_memory
    WHERE tenant_id = ? AND group_id = ? AND scope = 'user'
  `).get(tenantId, groupId).c

  const groupNotes = db.prepare(`
    SELECT COUNT(*) AS c FROM x_agent_memory
    WHERE tenant_id = ? AND group_id = ? AND scope = 'group'
  `).get(tenantId, groupId).c

  const xNotes = db.prepare(`
    SELECT COUNT(*) AS c FROM x_agent_memory
    WHERE tenant_id = ? AND group_id = ? AND scope = 'x'
  `).get(tenantId, groupId).c

  const chatRows = db.prepare(`
    SELECT COUNT(*) AS c FROM x_agent_chatlog
    WHERE tenant_id = ? AND group_id = ?
  `).get(tenantId, groupId).c

  return { userNotes, groupNotes, xNotes, chatRows }
}

/** Store an inbound or outbound DM event. */
export function logDM({ tenantId = 'default', jid, direction, messageId = null, text }) {
  if (!jid || !direction || !text) return
  db.prepare(`
    INSERT INTO x_dm_log (tenant_id, jid, direction, message_id, text, ts)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(tenant_id, jid, message_id) DO NOTHING
  `).run(tenantId, jid, direction, messageId || `dm_${Date.now()}`, String(text).slice(0, 1000), Date.now())
}

/** Return recent DM history in chronological order. */
export function recentDMs(tenantId, jid, limit = 20) {
  return db.prepare(`
    SELECT direction, text, ts FROM x_dm_log
    WHERE tenant_id = ? AND jid = ?
    ORDER BY ts DESC LIMIT ?
  `).all(tenantId, jid, Math.max(1, Math.min(100, limit))).reverse()
}

/** Check whether a DM conversation exists. */
export function hasAnyDM(tenantId, jid) {
  return Boolean(db.prepare(`SELECT 1 FROM x_dm_log WHERE tenant_id = ? AND jid = ? LIMIT 1`).get(tenantId, jid))
}

/** Pick a talkative member once the group has enough message history. */
export function maybePickFavorite(tenantId, groupId) {
  seasonReady(tenantId, groupId)
  if (getFavorite(tenantId, groupId)) return null
  const rows = db.prepare(`
    SELECT sender_jid AS jid, COUNT(*) AS weight
    FROM x_agent_chatlog WHERE tenant_id = ? AND group_id = ?
    GROUP BY sender_jid ORDER BY weight DESC
  `).all(tenantId, groupId)
  const total = rows.reduce((sum, row) => sum + row.weight, 0)
  if (total < 30 || !rows.length) return null
  let pick = Math.random() * total
  for (const row of rows) {
    pick -= row.weight
    if (pick <= 0) {
      setFavorite(tenantId, groupId, row.jid, `picked for talking ${row.weight} times`)
      return row.jid
    }
  }
  return null
}