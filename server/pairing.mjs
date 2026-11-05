/* -------------------------------------------------------------------------- */
/* X: PAIRING                                                                 */
/*                                                                            */
/* Public pairing flow. Creates tenants on demand and exposes their QR.       */
/* -------------------------------------------------------------------------- */

import { botManager } from './bot-manager-singleton.mjs'
import {
  createTenant,
  getTenant,
  getTenantByOwner,
  markTenantConnected,
  listTenants
} from './db.mjs'
import { randomBytes } from 'node:crypto'

/*
 * Short-lived pairing sessions. Not persisted — if the server
 * restarts, any in-flight pairing aborts and the user re-scans.
 */
const sessions = new Map()

const SESSION_TTL_MS = 10 * 60 * 1000

function sweepExpired() {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (session.expiresAt < now) {
      sessions.delete(id)
    }
  }
}

export function createPairSession(displayName = null) {
  sweepExpired()

  const id = randomBytes(8).toString('hex')

  const tenantId = `t_${Date.now()}_${randomBytes(3).toString('hex')}`

  const authFolder = `./auth/x-${tenantId}`

  const tenant = createTenant({
    id: tenantId,
    ownerJid: `pending_${id}@pair`,
    displayName,
    authFolder,
    notes: 'Pending public pairing'
  })

  sessions.set(id, {
    id,
    tenantId,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
    status: 'starting',
    qr: null,
    qrUpdatedAt: null,
    error: null
  })

  startRuntimeForSession(id)

  return { sessionId: id, tenantId }
}

async function startRuntimeForSession(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return

  try {
    const runtime = await botManager.start(session.tenantId)

    session.status = 'waiting_qr'
    session.runtime = runtime
  } catch (error) {
    session.status = 'error'
    session.error = error?.message || String(error)
  }
}

export function getPairSession(sessionId) {
  sweepExpired()

  const session = sessions.get(sessionId)
  if (!session) return null

  /*
   * Pull current state from the runtime on each poll.
   * This avoids needing event callbacks inside whatsapp.mjs.
   */
  if (session.runtime && typeof session.runtime.getStatus === 'function') {
    try {
      const status = session.runtime.getStatus()

      if (status.qr) {
        session.qr = status.qr
        session.qrUpdatedAt = Date.now()
        session.status = 'waiting_qr'
      }

      if (status.status === 'connected') {
        session.status = 'connected'
        markTenantConnected(session.tenantId)
      }

      if (status.lastError) {
        session.error = status.lastError
      }
    } catch (error) {
      session.error = error?.message || String(error)
    }
  }

  /*
   * Strip the runtime reference before returning — the API
   * caller doesn't need it and it can't be serialized.
   */
  return {
    id: session.id,
    tenantId: session.tenantId,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    status: session.status,
    qr: session.qr,
    qrUpdatedAt: session.qrUpdatedAt,
    error: session.error
  }
}

export function cancelPairSession(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return false

  botManager.stop(session.tenantId).catch(() => {})

  sessions.delete(sessionId)
  return true
}

export async function finalizePairing(sessionId, ownerJid) {
  const session = sessions.get(sessionId)
  if (!session) return null

  if (session.status !== 'connected') return null

  const tenant = getTenant(session.tenantId)
  if (!tenant) return null

  /* Bind owner JID now that we know it */
  db.prepare(`
    UPDATE tenants
    SET owner_jid = ?, updated_at = ?
    WHERE id = ?
  `).run(ownerJid, new Date().toISOString(), session.tenantId)

  sessions.delete(sessionId)

  return getTenant(session.tenantId)
}

export function listActiveSessions() {
  sweepExpired()
  return [...sessions.values()].map((s) => ({
    sessionId: s.id,
    tenantId: s.tenantId,
    status: s.status,
    hasQr: !!s.qr,
    expiresAt: new Date(s.expiresAt).toISOString()
  }))
}