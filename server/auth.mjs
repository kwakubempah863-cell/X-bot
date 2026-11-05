import crypto from 'node:crypto'
import {
  getDashboardUser,
  getDashboardUserByTenant,
  createDashboardUser,
  updateDashboardPassword,
  touchDashboardLogin,
  deleteDashboardUser
} from './db.mjs'

const sessions = new Map()

const SESSION_TTL_MS = Number(
  process.env.X_SESSION_TTL_MS || 8 * 60 * 60 * 1000
)

const USERNAME = String(process.env.X_ADMIN_USERNAME || '').trim()
const PASSWORD_HASH = String(process.env.X_ADMIN_PASSWORD_HASH || '').trim()
const SESSION_SECRET = String(process.env.X_SESSION_SECRET || '').trim()

function base64url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      64,
      {
        N: 16384,
        r: 8,
        p: 1,
      },
      (error, derivedKey) => {
        if (error) reject(error)
        else resolve(derivedKey.toString('hex'))
      }
    )
  })
}

export function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString('hex')

  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      64,
      {
        N: 16384,
        r: 8,
        p: 1,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error)
          return
        }

        resolve(`scrypt$${salt}$${derivedKey.toString('hex')}`)
      }
    )
  })
}

async function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split('$')

  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false
  }

  const [, salt, expectedHex] = parts

  const actualHex = await hashPassword(password, salt)

  const actual = Buffer.from(actualHex, 'hex')
  const expected = Buffer.from(expectedHex, 'hex')

  return (
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  )
}

export function generatePassword(length = 12) {
  const charset =
    'ABCDEFGHJKLMNPQRSTUVWXYZ' +
    'abcdefghijkmnpqrstuvwxyz' +
    '23456789'

  const bytes = crypto.randomBytes(length)
  let output = ''

  for (let i = 0; i < length; i++) {
    output += charset.charAt(bytes[i] % charset.length)
  }

  return output
}

function generateSessionId() {
  const random = crypto.randomBytes(32).toString('hex')

  if (!SESSION_SECRET) {
    return random
  }

  return base64url(
    crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(`${random}:${Date.now()}`)
      .digest()
  )
}

export async function login(username, password) {
  if (
    typeof username !== 'string' ||
    typeof password !== 'string'
  ) {
    return null
  }

  const trimmedUser = username.trim()
  const lowerUser = trimmedUser.toLowerCase()

  if (USERNAME && PASSWORD_HASH && trimmedUser === USERNAME) {
    const valid = await verifyPassword(password, PASSWORD_HASH)

    if (!valid) return null

    const sessionId = generateSessionId()
    const expiresAt = Date.now() + SESSION_TTL_MS

    sessions.set(sessionId, {
      username: USERNAME,
      role: 'super_admin',
      tenantId: null,
      createdAt: Date.now(),
      expiresAt
    })

    return {
      sessionId,
      username: USERNAME,
      role: 'super_admin',
      tenantId: null,
      expiresAt
    }
  }

  try {
    const user = getDashboardUser(lowerUser)
    if (!user) return null

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) return null

    const sessionId = generateSessionId()
    const expiresAt = Date.now() + SESSION_TTL_MS

    sessions.set(sessionId, {
      username: user.username,
      role: 'tenant_owner',
      tenantId: user.tenant_id,
      createdAt: Date.now(),
      expiresAt
    })

    try {
      touchDashboardLogin(user.username)
    } catch {}

    return {
      sessionId,
      username: user.username,
      role: 'tenant_owner',
      tenantId: user.tenant_id,
      expiresAt
    }
  } catch (error) {
    console.warn('[X AUTH] tenant login failed:', error?.message || error)
    return null
  }
}

export async function provisionTenantDashboardUser(tenantId) {
  if (!tenantId) return null

  const existing = getDashboardUserByTenant(tenantId)

  if (existing) {
    const plainPassword = generatePassword()
    const passwordHash = await createPasswordHash(plainPassword)
    updateDashboardPassword(existing.username, passwordHash)

    return {
      username: existing.username,
      plainPassword,
      regenerated: true
    }
  }

  const username = String(tenantId).toLowerCase()
  const plainPassword = generatePassword()
  const passwordHash = await createPasswordHash(plainPassword)

  createDashboardUser({ tenantId, username, passwordHash })

  return {
    username,
    plainPassword,
    regenerated: false
  }
}

export async function resetTenantDashboardPassword(tenantId) {
  if (!tenantId) return null

  const existing = getDashboardUserByTenant(tenantId)
  if (!existing) return null

  const plainPassword = generatePassword()
  const passwordHash = await createPasswordHash(plainPassword)
  updateDashboardPassword(existing.username, passwordHash)

  return {
    username: existing.username,
    plainPassword
  }
}

export async function changeTenantPassword(username, oldPassword, newPassword) {
  if (!username || !oldPassword || !newPassword) {
    return { ok: false, reason: 'Missing fields' }
  }

  const user = getDashboardUser(username)
  if (!user) return { ok: false, reason: 'User not found' }

  const valid = await verifyPassword(oldPassword, user.password_hash)
  if (!valid) return { ok: false, reason: 'Current password is wrong' }

  const passwordHash = await createPasswordHash(newPassword)
  updateDashboardPassword(username, passwordHash)

  return { ok: true }
}

export function removeTenantDashboardUser(tenantId) {
  try {
    deleteDashboardUser(tenantId)
  } catch {}
}

export function getSession(sessionId) {
  if (!sessionId) return null

  const session = sessions.get(sessionId)

  if (!session) return null

  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId)
    return null
  }

  return session
}

export function destroySession(sessionId) {
  if (sessionId) {
    sessions.delete(sessionId)
  }
}

export function clearExpiredSessions() {
  const now = Date.now()

  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(id)
    }
  }
}

export function parseCookies(header = '') {
  const cookies = {}

  for (const part of String(header).split(';')) {
    const index = part.indexOf('=')

    if (index === -1) continue

    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()

    if (key) {
      cookies[key] = decodeURIComponent(value)
    }
  }

  return cookies
}

export function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '')
  return getSession(cookies.x_session)
}

// X_COOKIE_SECURE accepts: 'true', 'false', or unset (auto-detect: Secure only in production).
function cookieSecureSuffix() {
  const flag = String(process.env.X_COOKIE_SECURE || '').trim().toLowerCase()

  if (flag === 'true' || flag === '1') return '; Secure'
  if (flag === 'false' || flag === '0') return ''

  return process.env.NODE_ENV === 'production' ? '; Secure' : ''
}

export function setSessionCookie(reply, sessionId) {
  reply.header(
    'Set-Cookie',
    `x_session=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax${cookieSecureSuffix()}; Max-Age=${Math.floor(
      SESSION_TTL_MS / 1000
    )}`
  )
}

export function clearSessionCookie(reply) {
  reply.header(
    'Set-Cookie',
    `x_session=; Path=/; HttpOnly; SameSite=Lax${cookieSecureSuffix()}; Max-Age=0`
  )
}

export function requireDashboardAuth(req, reply) {
  const session = getSessionFromRequest(req)

  if (!session) {
    reply.code(401).send({
      error: 'Authentication required',
    })

    return false
  }

  return session
}

export function authStatus() {
  return {
    configured: Boolean(
      USERNAME &&
        PASSWORD_HASH &&
        SESSION_SECRET
    ),
    username: USERNAME || null,
    sessionTtlMs: SESSION_TTL_MS,
  }
}

setInterval(clearExpiredSessions, 60_000).unref()