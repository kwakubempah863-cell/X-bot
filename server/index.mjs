import 'node:process'
import { promises as fs } from 'node:fs'
import { promises as stat_fsp } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import cors from '@fastify/cors'
import { WhatsAppRuntime } from './whatsapp.mjs'
import { botManager } from './bot-manager-singleton.mjs'
import {
  listGroups,
  getGroup,
  listMembers,
  updateGroupSettings,
  groupStats,
  leaderboard,
  activeGames,
  recentAudit,
  countMembers,
  listMenuAssets,
  addMenuAsset,
  listCommandAssets,
  setCommandAsset,
  clearCommandAsset,
  getTenant,
  getTenantDetail,
  listTenantActivity,
  getTenantCommandStats,
  listConnectionEvents
} from './db.mjs'
import { playGame } from './games.mjs'
import { answerWithConfiguredProvider } from './ai-context.mjs'
import { commandList } from './commands.mjs'
import {
  rateLimit,
  clientKey,
  requireApiKey,
  securityHeaders
} from './security.mjs'
import {
  login,
  getSessionFromRequest,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  requireDashboardAuth,
  authStatus,
  changeTenantPassword,
  resetTenantDashboardPassword,
  provisionTenantDashboardUser
} from './auth.mjs'
import {
  animeSearch,
  mangaSearch,
  animeQuote,
  giphySearch
} from './providers.mjs'
import { validateAgentConfig } from './agent.mjs'

/*
 * Tenant for the HTTP API.
 * Until we wire session-based tenant routing, every API call
 * operates against the default tenant.
 */
const API_TENANT = 'default'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public')
const DIST_DIR = path.resolve(__dirname, '..', 'dist')

const app = Fastify({
  logger: true,
  bodyLimit: Number(process.env.X_BODY_LIMIT || 26214400)
})

const origins = process.env.X_CORS_ORIGIN
  ? process.env.X_CORS_ORIGIN.split(',').map((v) => v.trim()).filter(Boolean)
  : true

await app.register(cors, { origin: origins, credentials: true })

app.addHook('onRequest', async (req, reply) => {
  securityHeaders(reply)
  const rl = rateLimit(clientKey(req))
  reply.header('X-RateLimit-Remaining', rl.remaining)
  if (!rl.allowed) {
    return reply
      .code(429)
      .header('Retry-After', rl.retryAfter)
      .send({ error: 'Rate limit exceeded', retryAfter: rl.retryAfter })
  }
})

/*
 * Legacy alias — most existing routes use `runtime`.
 * It points to the default tenant so nothing breaks.
 */
let runtime = null
const port = Number(process.env.PORT || 8787)

const menuAssetDir = path.resolve(
  process.env.X_DATA_DIR || './data',
  'menu-assets'
)

const commandAssetDir = path.resolve(
  process.env.X_DATA_DIR || './data',
  'command-assets'
)

await fs.mkdir(menuAssetDir, { recursive: true })
await fs.mkdir(commandAssetDir, { recursive: true })

const safeJson = (v, f = {}) => {
  try {
    return v ? JSON.parse(v) : f
  } catch {
    return f
  }
}

const publicGroup = (g) => ({
  id: g.group_id,
  groupId: g.group_id,
  name: g.name,
  description: g.description,
  memberCount: g.member_count,
  adminsCount: g.admins_count,
  profilePictureUrl: g.profile_picture_url,
  prefix: g.prefix,
  rules: g.rules,
  theme: g.theme,
  antiLink: !!g.anti_link,
  antiSpam: !!g.anti_spam,
  welcomeEnabled: !!g.welcome_enabled,
  goodbyeEnabled: !!g.goodbye_enabled,
  cardsEnabled: !!g.cards_enabled,
    antideleteMode: g.antidelete_mode || 'off',
  antideleteEnabled: (g.antidelete_mode || 'off') !== 'off',
  welcomeTemplate: g.welcome_template,
  goodbyeTemplate: g.goodbye_template,
  settings: safeJson(g.settings_json, {}),
  connectionState: g.connection_state,
  createdAt: g.created_at,
  updatedAt: g.updated_at
})

function isSuperAdmin(req) {
  return req.userRole === 'super_admin'
}

function canAccessTenant(req, tenantId) {
  if (isSuperAdmin(req)) return true

  return (
    req.userRole === 'tenant_owner' &&
    req.userTenantId &&
    req.userTenantId === tenantId
  )
}

app.get('/health', async () => ({
  ok: true,
  service: 'x-whatsapp-bot',
  timestamp: new Date().toISOString()
}))

app.get('/api/health', async () => ({
  ok: true,
  service: 'x-runtime',
  time: new Date().toISOString()
}))

app.get('/api/auth/status', async () => authStatus())

app.post('/api/auth/login', async (req, reply) => {
  try {
    const result = await login(
      String(req.body?.username || ''),
      String(req.body?.password || '')
    )

    if (!result) {
      return reply.code(401).send({ error: 'Invalid username or password' })
    }

    setSessionCookie(reply, result.sessionId)

    return {
      ok: true,
      user: { username: result.username },
      expiresAt: result.expiresAt
    }
  } catch (e) {
    app.log.error(e)
    return reply
      .code(500)
      .send({ error: e instanceof Error ? e.message : String(e) })
  }
})

app.get('/api/auth/me', async (req, reply) => {
  const session = getSessionFromRequest(req)
  if (!session) return reply.code(401).send({ error: 'Not authenticated' })

  return {
    authenticated: true,
    user: {
      username: session.username,
      role: session.role || 'super_admin',
      tenantId: session.tenantId || null
    },
    expiresAt: session.expiresAt
  }
})

app.get('/api/auth/whoami', async (req, reply) => {
  if (!req.dashboardUser) {
    return reply.code(401).send({ error: 'Not authenticated' })
  }

  return {
    username: req.dashboardUser.username,
    role: req.userRole,
    tenantId: req.userTenantId,
    isSuperAdmin: isSuperAdmin(req)
  }
})

app.post('/api/auth/logout', async (req, reply) => {
  const session = getSessionFromRequest(req)

  if (session) {
    const cookies = String(req.headers.cookie || '')
      .split(';')
      .map((v) => v.trim())

    const item = cookies.find((v) => v.startsWith('x_session='))

    if (item) destroySession(decodeURIComponent(item.slice(10)))
  }

  clearSessionCookie(reply)
  return { ok: true }
})

app.post('/api/auth/change-password', async (req, reply) => {
  const session = getSessionFromRequest(req)
  if (!session) return reply.code(401).send({ error: 'Not authenticated' })

  const oldPassword = String(req.body?.oldPassword || '')
  const newPassword = String(req.body?.newPassword || '')

  if (!oldPassword || !newPassword) {
    return reply.code(400).send({ error: 'Missing password fields' })
  }

  if (newPassword.length < 8) {
    return reply.code(400).send({ error: 'Password must be at least 8 characters' })
  }

  if (session.role === 'super_admin') {
    return reply.code(400).send({ error: 'Super admin password is managed by environment configuration' })
  }

  const result = await changeTenantPassword(
    session.username,
    oldPassword,
    newPassword
  )

  if (!result.ok) {
    return reply.code(400).send({ error: result.reason })
  }

  return { ok: true }
})

app.addHook('preHandler', async (req, reply) => {
  const pathName = String(req.url).split('?')[0]

  const publicPaths = new Set([
    '/api/health',
    '/api/auth/status',
    '/api/auth/login',
    '/api/auth/me',
    '/api/auth/logout'
  ])

  if (
  publicPaths.has(pathName) ||
  pathName.startsWith('/api/pairing') ||
  pathName.startsWith('/api/menu-assets/file/') ||
  pathName.startsWith('/api/command-assets/file/') ||
  !pathName.startsWith('/api/')
) {
  return
}

  const session = getSessionFromRequest(req)
  if (session) {
    req.dashboardUser = session
    req.userRole = session.role || 'super_admin'
    req.userTenantId = session.tenantId || null
    return
  }

  if (process.env.X_API_KEY) {
    if (requireApiKey(req, reply)) {
      req.apiClient = true
      return
    }
    return
  }

  return requireDashboardAuth(req, reply)
})

/* -------------------------------------------------------------------------- */
/* Runtime                                                                    */
/* -------------------------------------------------------------------------- */

app.get('/api/runtime/status', async () => runtime?.getStatus() || { status: 'offline' })

app.post('/api/runtime/connect', async (_r, reply) => {
  try {
    runtime = await botManager.start('default')
    return runtime.getStatus()
  } catch (e) {
    return reply.code(500).send({ error: e.message })
  }
})

app.post('/api/runtime/pairing', async (req, reply) => {
  try {
    return { code: await runtime.pairingCode(req.body?.number) }
  } catch (e) {
    return reply.code(400).send({ error: e.message })
  }
})

app.post('/api/runtime/logout', async (_r, reply) => {
  try {
    return await runtime.logout()
  } catch (e) {
    return reply.code(500).send({ error: e.message })
  }
})

app.post('/api/runtime/sync', async (_r, reply) => {
  try {
    return {
      ok: true,
      count: await runtime.syncGroups(),
      groups: listGroups(API_TENANT).map(publicGroup)
    }
  } catch (e) {
    return reply.code(500).send({ error: e.message })
  }
})

/* -------------------------------------------------------------------------- */
/* Multi-tenant runtime routes                                                */
/* -------------------------------------------------------------------------- */

app.get('/api/tenants', async (req) => {
  const all = botManager.list().map(({ tenantId, status }) => ({
    tenantId,
    ...status
  }))

  if (isSuperAdmin(req)) return all

  return all.filter((tenant) => tenant.tenantId === req.userTenantId)
})

app.get('/api/tenants/:tenantId/runtime/status', async (req, reply) => {
  if (!canAccessTenant(req, req.params.tenantId)) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  const tenantId = req.params.tenantId
  const rt = botManager.get(tenantId)

  if (!rt) {
    return reply.code(404).send({ error: 'Tenant not running' })
  }

  return rt.getStatus()
})

app.post('/api/tenants/:tenantId/runtime/connect', async (req, reply) => {
  if (!canAccessTenant(req, req.params.tenantId)) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  const tenantId = req.params.tenantId

  try {
    const rt = await botManager.start(tenantId)
    return rt.getStatus()
  } catch (error) {
    return reply.code(500).send({ error: error.message })
  }
})

app.post('/api/tenants/:tenantId/runtime/logout', async (req, reply) => {
  if (!canAccessTenant(req, req.params.tenantId)) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  const tenantId = req.params.tenantId

  try {
    const ok = await botManager.stop(tenantId)
    return { ok }
  } catch (error) {
    return reply.code(500).send({ error: error.message })
  }
})

app.delete('/api/tenants/:tenantId', async (req, reply) => {
  if (!canAccessTenant(req, req.params.tenantId)) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  const tenantId = req.params.tenantId

  try {
    await botManager.deprovisionTenant(tenantId)
    return { ok: true }
  } catch (error) {
    return reply.code(500).send({ error: error.message })
  }
})

import {
  createPairSession,
  getPairSession,
  cancelPairSession,
  finalizePairing
} from './pairing.mjs'

import {
  isBanned,
  banUser,
  unbanUser,
  listBans
} from './db.mjs'

/* -------------------------------------------------------------------------- */
/* Tenant detail                                                              */
/* -------------------------------------------------------------------------- */

app.get('/api/tenants/:tenantId/detail', async (req, reply) => {
  if (!canAccessTenant(req, req.params.tenantId)) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  const tenantId = req.params.tenantId

  const tenant = getTenant(tenantId)
  if (!tenant) {
    return reply.code(404).send({ error: 'Tenant not found' })
  }

  const detail = getTenantDetail(tenantId)
  if (!detail) {
    return reply.code(404).send({ error: 'Tenant not found' })
  }

  /*
   * Merge live runtime status with the DB snapshot.
   */
  const runtime = botManager.get(tenantId)
  const live = runtime?.getStatus() || null

  return {
    ...detail,
    live
  }
})

app.get('/api/tenants/:tenantId/activity', async (req, reply) => {
  if (!canAccessTenant(req, req.params.tenantId)) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  const tenantId = req.params.tenantId

  if (!getTenant(tenantId)) {
    return reply.code(404).send({ error: 'Tenant not found' })
  }

  const limit = Number(req.query?.limit) || 50

  return {
    rows: listTenantActivity(tenantId, limit)
  }
})

app.get('/api/tenants/:tenantId/commands', async (req, reply) => {
  if (!canAccessTenant(req, req.params.tenantId)) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  const tenantId = req.params.tenantId

  if (!getTenant(tenantId)) {
    return reply.code(404).send({ error: 'Tenant not found' })
  }

  return {
    stats: getTenantCommandStats(tenantId, 10)
  }
})

app.get('/api/tenants/:tenantId/connections', async (req, reply) => {
  if (!canAccessTenant(req, req.params.tenantId)) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  const tenantId = req.params.tenantId

  if (!getTenant(tenantId)) {
    return reply.code(404).send({ error: 'Tenant not found' })
  }

  return {
    rows: listConnectionEvents(tenantId, 50)
  }
})

/* -------------------------------------------------------------------------- */
/* Public pairing                                                             */
/* -------------------------------------------------------------------------- */

app.post('/api/pairing/start', async (req, reply) => {
  try {
    const displayName = String(req.body?.name || '').trim().slice(0, 80) || null
    const result = createPairSession(displayName)
    return result
  } catch (error) {
    app.log.error(error)
    return reply.code(500).send({ error: error.message })
  }
})

app.get('/api/pairing/:sessionId', async (req, reply) => {
  const session = getPairSession(req.params.sessionId)
  if (!session) return reply.code(404).send({ error: 'Session expired or not found' })

  return {
    sessionId: session.id,
    status: session.status,
    qr: session.qr,
    error: session.error,
    expiresAt: new Date(session.expiresAt).toISOString()
  }
})

app.post('/api/pairing/:sessionId/finalize', async (req, reply) => {
  try {
    const session = getPairSession(req.params.sessionId)
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' })
    }

    /*
     * Derive the JID from the runtime's own connection.
     */
    const runtime = botManager.get(session.tenantId)
    const status = runtime?.getStatus()
    const ownerJid = status?.connectedJid

    if (!ownerJid) {
      return reply
        .code(400)
        .send({ error: 'Runtime has not connected yet' })
    }

    const tenant = await finalizePairing(req.params.sessionId, ownerJid)
    if (!tenant) {
      return reply.code(400).send({ error: 'Session not ready' })
    }

    return { ok: true, tenantId: tenant.id }
  } catch (error) {
    app.log.error(error)
    return reply.code(500).send({ error: error.message })
  }
})

app.delete('/api/pairing/:sessionId', async (req, reply) => {
  const ok = cancelPairSession(req.params.sessionId)
  return { ok }
})

/* -------------------------------------------------------------------------- */
/* Ban management (admin only)                                                */
/* -------------------------------------------------------------------------- */

app.get('/api/bans', async (req, reply) => {
  if (!isSuperAdmin(req)) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  return listBans()
})

app.post('/api/bans', async (req, reply) => {
  if (!isSuperAdmin(req)) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  const jid = String(req.body?.jid || '').trim()
  const reason = String(req.body?.reason || '').trim() || null
  const durationMs = Number(req.body?.durationMs) || null

  if (!jid) return reply.code(400).send({ error: 'jid required' })

  const row = banUser(jid, {
    reason,
    durationMs,
    bannedBy: req.dashboardUser?.username || 'admin'
  })

  return row
})

app.delete('/api/bans/:jid', async (req, reply) => {
  if (!isSuperAdmin(req)) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  const ok = unbanUser(req.params.jid)
  return { ok }
})

/* -------------------------------------------------------------------------- */
/* Commands                                                                   */
/* -------------------------------------------------------------------------- */

app.get('/api/commands', async () => commandList())

/* -------------------------------------------------------------------------- */
/* Menu assets                                                                */
/* -------------------------------------------------------------------------- */

app.get('/api/menu-assets/file/:filename', async (req, reply) => {
  try {
    const filename = String(req.params.filename || '')

    if (!/^menu_[a-f0-9-]+\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
      return reply.code(404).send({ error: 'Menu asset not found' })
    }

    const filePath = path.join(menuAssetDir, filename)
    const data = await fs.readFile(filePath)

    const ext = filename.split('.').pop()?.toLowerCase() || 'png'

    const contentType =
      {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif'
      }[ext] || 'application/octet-stream'

    return reply
      .header('Content-Type', contentType)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(data)
  } catch {
    return reply.code(404).send({ error: 'Menu asset not found' })
  }
})

app.get('/api/menu-assets', async () => listMenuAssets(API_TENANT))

app.post('/api/menu-assets/upload', async (req, reply) => {
  try {
    const body = req.body || {}
    const category =
      String(body.category || 'X branding').trim().slice(0, 80) ||
      'X branding'

    const dataUrl = String(body.dataUrl || '')

    const match = dataUrl.match(
      /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/i
    )

    if (!match) {
      return reply
        .code(400)
        .send({ error: 'Upload must be a JPG, PNG, WEBP, or GIF image.' })
    }

    const mime = match[1].toLowerCase()
    const base64 = match[2]
    const buffer = Buffer.from(base64, 'base64')

    const maxBytes = Number(
      process.env.X_MENU_ASSET_MAX_BYTES || 15728640
    )

    if (!buffer.length || buffer.length > maxBytes) {
      return reply.code(413).send({
        error: `Image is too large. Maximum size is ${Math.round(
          maxBytes / 1048576
        )} MB.`
      })
    }

    const signatures = {
      'image/jpeg': (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8,
      'image/png': (b) =>
        b.length > 8 && b.toString('hex', 0, 8) === '89504e470d0a1a0a',
      'image/gif': (b) =>
        b.length > 6 &&
        (b.toString('ascii', 0, 6) === 'GIF87a' ||
          b.toString('ascii', 0, 6) === 'GIF89a'),
      'image/webp': (b) =>
        b.length > 12 &&
        b.toString('ascii', 0, 4) === 'RIFF' &&
        b.toString('ascii', 8, 12) === 'WEBP'
    }

    if (!signatures[mime]?.(buffer)) {
      return reply
        .code(400)
        .send({ error: 'The uploaded file does not match its image type.' })
    }

    const ext =
      { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[
        mime
      ]

    const filename = `menu_${crypto.randomUUID()}.${ext}`

    await fs.writeFile(path.join(menuAssetDir, filename), buffer, {
      flag: 'wx'
    })

    const url = `http://127.0.0.1:${port}/api/menu-assets/file/${filename}`

    return addMenuAsset(API_TENANT, url, category)
  } catch (e) {
    app.log.error(e)
    return reply.code(500).send({ error: 'Could not save the menu image.' })
  }
})

app.delete('/api/menu-assets/:id', async (req, reply) => {
  const id = String(req.params.id || '').trim()

  if (!id) {
    return reply.code(400).send({ error: 'Menu asset ID is required.' })
  }

  const row = deleteMenuAsset(API_TENANT, id)

  if (!row) {
    return reply.code(404).send({ error: 'Menu asset not found.' })
  }

  return { ok: true, id: row.id }
})

app.delete('/api/menu-assets', async (req, reply) => {
  const tenantId = req.userTenantId || API_TENANT

  if (!tenantId) {
    return reply.code(401).send({ error: 'Not authenticated.' })
  }

  const count = clearMenuAssets(tenantId)

  return { ok: true, deleted: count }
})

/* -------------------------------------------------------------------------- */
/* Command assets                                                             */
/* -------------------------------------------------------------------------- */

app.get('/api/command-assets/file/:filename', async (req, reply) => {
  try {
    const filename = String(req.params.filename || '')

    if (!/^cmd_[a-f0-9-]+\.(jpg|jpeg|png|webp|gif)$/i.test(filename)) {
      return reply.code(404).send({ error: 'Command asset not found' })
    }

    const filePath = path.join(commandAssetDir, filename)
    const data = await fs.readFile(filePath)

    const ext = filename.split('.').pop()?.toLowerCase() || 'png'

    const contentType =
      {
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        webp: 'image/webp',
        gif: 'image/gif'
      }[ext] || 'application/octet-stream'

    return reply
      .header('Content-Type', contentType)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(data)
  } catch {
    return reply.code(404).send({ error: 'Command asset not found' })
  }
})

app.get('/api/command-assets', async () => listCommandAssets(API_TENANT))

app.post('/api/command-assets/upload', async (req, reply) => {
  try {
    const body = req.body || {}

    const command = String(body.command || '')
      .replace(/^\./, '')
      .trim()
      .toLowerCase()

    if (!command) {
      return reply.code(400).send({ error: 'Command name is required.' })
    }

    const dataUrl = String(body.dataUrl || '')

    const match = dataUrl.match(
      /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/i
    )

    if (!match) {
      return reply
        .code(400)
        .send({ error: 'Upload must be a JPG, PNG, WEBP, or GIF image.' })
    }

    const mime = match[1].toLowerCase()
    const base64 = match[2]
    const buffer = Buffer.from(base64, 'base64')

    const maxBytes = Number(
      process.env.X_COMMAND_ASSET_MAX_BYTES || 15728640
    )

    if (!buffer.length || buffer.length > maxBytes) {
      return reply.code(413).send({
        error: `Image is too large. Maximum size is ${Math.round(
          maxBytes / 1048576
        )} MB.`
      })
    }

    const signatures = {
      'image/jpeg': (b) => b.length > 2 && b[0] === 0xff && b[1] === 0xd8,
      'image/png': (b) =>
        b.length > 8 && b.toString('hex', 0, 8) === '89504e470d0a1a0a',
      'image/gif': (b) =>
        b.length > 6 &&
        (b.toString('ascii', 0, 6) === 'GIF87a' ||
          b.toString('ascii', 0, 6) === 'GIF89a'),
      'image/webp': (b) =>
        b.length > 12 &&
        b.toString('ascii', 0, 4) === 'RIFF' &&
        b.toString('ascii', 8, 12) === 'WEBP'
    }

    if (!signatures[mime]?.(buffer)) {
      return reply
        .code(400)
        .send({ error: 'The uploaded file does not match its image type.' })
    }

    const ext =
      { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[
        mime
      ]

    const filename = `cmd_${crypto.randomUUID()}.${ext}`

    await fs.writeFile(path.join(commandAssetDir, filename), buffer, {
      flag: 'wx'
    })

    const url = `http://127.0.0.1:${port}/api/command-assets/file/${filename}`

    return setCommandAsset(API_TENANT, command, url, 'upload')
  } catch (e) {
    app.log.error(e)
    return reply
      .code(500)
      .send({ error: 'Could not save the command image.' })
  }
})

app.post('/api/command-assets', async (req, reply) => {
  const command = String(req.body?.command || '')
    .replace(/^\./, '')
    .trim()
    .toLowerCase()

  const url = String(req.body?.url || '').trim()

  if (!command) {
    return reply.code(400).send({ error: 'Command name is required.' })
  }

  if (!/^https?:\/\//i.test(url)) {
    return reply
      .code(400)
      .send({ error: 'Command asset URL must be a valid HTTP(S) URL.' })
  }

  return setCommandAsset(API_TENANT, command, url, 'external')
})

app.delete('/api/command-assets/:command', async (req, reply) => {
  const command = String(req.params.command || '')
    .replace(/^\./, '')
    .trim()
    .toLowerCase()

  if (!command) {
    return reply.code(400).send({ error: 'Command name is required.' })
  }

  clearCommandAsset(API_TENANT, command)
  return { ok: true, command }
})

/* -------------------------------------------------------------------------- */
/* Groups                                                                     */
/* -------------------------------------------------------------------------- */

app.get('/api/groups', async (req) => {
  const tenantId = isSuperAdmin(req) ? API_TENANT : req.userTenantId
  if (!tenantId) return []

  return listGroups(tenantId).map(publicGroup)
})

app.get('/api/groups/:groupId', async (req, reply) => {
  const group = getGroup(API_TENANT, req.params.groupId)
  if (!group) {
    return reply.code(404).send({ error: 'Group not found' })
  }
  if (!isSuperAdmin(req) && group.tenant_id !== req.userTenantId) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  const g = group

  const limit = Number(req.query?.limit) || 50
  const offset = Number(req.query?.offset) || 0

  return {
    group: publicGroup(g),
    members: listMembers(API_TENANT, g.group_id, limit, offset),
    stats: groupStats(API_TENANT, g.group_id)
  }
})

app.get('/api/groups/:groupId/members', async (req, reply) => {
  const group = getGroup(API_TENANT, req.params.groupId)
  if (!group) {
    return reply.code(404).send({ error: 'Group not found' })
  }
  if (!isSuperAdmin(req) && group.tenant_id !== req.userTenantId) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  const limit = Math.min(
    100,
    Math.max(1, Number(req.query?.limit) || 25)
  )

  const offset = Math.max(0, Number(req.query?.offset) || 0)

  return {
    members: listMembers(API_TENANT, req.params.groupId, limit, offset),
    total: countMembers(API_TENANT, req.params.groupId),
    limit,
    offset
  }
})

app.get('/api/groups/:groupId/games', async (req, reply) => {
  const group = getGroup(API_TENANT, req.params.groupId)
  if (!group) {
    return reply.code(404).send({ error: 'Group not found' })
  }
  if (!isSuperAdmin(req) && group.tenant_id !== req.userTenantId) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  return {
    games: activeGames(API_TENANT, req.params.groupId).map((g) => ({
      ...g,
      state: safeJson(g.state_json, {})
    }))
  }
})

app.get('/api/groups/:groupId/audit', async (req, reply) => {
  const group = getGroup(API_TENANT, req.params.groupId)
  if (!group) {
    return reply.code(404).send({ error: 'Group not found' })
  }
  if (!isSuperAdmin(req) && group.tenant_id !== req.userTenantId) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  return {
    rows: recentAudit(
      API_TENANT,
      req.params.groupId,
      Number(req.query?.limit) || 25
    )
  }
})

app.get('/api/groups/:groupId/leaderboard', async (req, reply) => {
  const group = getGroup(API_TENANT, req.params.groupId)
  if (!group) {
    return reply.code(404).send({ error: 'Group not found' })
  }
  if (!isSuperAdmin(req) && group.tenant_id !== req.userTenantId) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  return {
    field: req.query?.field || 'xp',
    rows: leaderboard(
      API_TENANT,
      req.params.groupId,
      req.query?.field || 'xp',
      Number(req.query?.limit) || 10
    )
  }
})

app.patch('/api/groups/:groupId/settings', async (req, reply) => {
  const group = getGroup(API_TENANT, req.params.groupId)
  if (!group) {
    return reply.code(404).send({ error: 'Group not found' })
  }
  if (!isSuperAdmin(req) && group.tenant_id !== req.userTenantId) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  const g = updateGroupSettings(
    API_TENANT,
    req.params.groupId,
    req.body || {}
  )
  if (!g) return reply.code(404).send({ error: 'Group not found' })
  return publicGroup(g)
})

app.post('/api/groups/:groupId/games/:type', async (req, reply) => {
  const group = getGroup(API_TENANT, req.params.groupId)
  if (!group) {
    return reply.code(404).send({ error: 'Group not found' })
  }
  if (!isSuperAdmin(req) && group.tenant_id !== req.userTenantId) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  try {
    return playGame({
      tenantId: API_TENANT,
      groupId: req.params.groupId,
      type: req.params.type,
      playerJid: req.body?.playerJid,
      choice: req.body?.choice
    })
  } catch (e) {
    return reply.code(400).send({ error: e.message })
  }
})

app.post('/api/groups/:groupId/ai', async (req, reply) => {
  const group = getGroup(API_TENANT, req.params.groupId)
  if (!group) {
    return reply.code(404).send({ error: 'Group not found' })
  }
  if (!isSuperAdmin(req) && group.tenant_id !== req.userTenantId) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  try {
    return await answerWithConfiguredProvider(
      req.params.groupId,
      String(req.body?.prompt || '')
    )
  } catch (e) {
    return reply.code(500).send({ error: e.message })
  }
})

app.get('/api/groups/:groupId/context', async (req, reply) => {
  const g = getGroup(API_TENANT, req.params.groupId)
  if (!g) return reply.code(404).send({ error: 'Group not found' })
  if (!isSuperAdmin(req) && g.tenant_id !== req.userTenantId) {
    return reply.code(403).send({ error: 'Forbidden' })
  }

  return {
    group: publicGroup(g),
    members: listMembers(API_TENANT, g.group_id, 50, 0),
    stats: groupStats(API_TENANT, g.group_id),
    leaderboard: leaderboard(API_TENANT, g.group_id, 'xp', 10),
    games: activeGames(API_TENANT, g.group_id).map((x) => ({
      ...x,
      state: safeJson(x.state_json, {})
    }))
  }
})

/* -------------------------------------------------------------------------- */
/* Providers                                                                  */
/* -------------------------------------------------------------------------- */

app.get('/api/providers/anime', async (req, reply) => {
  try {
    return { results: await animeSearch(req.query?.q) }
  } catch (e) {
    return reply.code(502).send({ error: e.message })
  }
})

app.get('/api/providers/manga', async (req, reply) => {
  try {
    return { results: await mangaSearch(req.query?.q) }
  } catch (e) {
    return reply.code(502).send({ error: e.message })
  }
})

app.get('/api/providers/anime-quote', async (_req, reply) => {
  try {
    return { quote: await animeQuote() }
  } catch (e) {
    return reply.code(502).send({ error: e.message })
  }
})

app.get('/api/providers/giphy', async (req, reply) => {
  try {
    return { results: await giphySearch(req.query?.q) }
  } catch (e) {
    return reply.code(502).send({ error: e.message })
  }
})

let serveSpa = false
try {
  const stat = await stat_fsp.stat(path.join(DIST_DIR, 'index.html'))
  serveSpa = stat.isFile()
} catch {
  serveSpa = false
}

await app.register(fastifyStatic, {
  root: PUBLIC_DIR,
  prefix: '/public/',
  decorateReply: false
})

if (serveSpa) {
  await app.register(fastifyStatic, {
    root: DIST_DIR,
    prefix: '/',
    wildcard: false,
    decorateReply: true
  })

  app.setNotFoundHandler((request, reply) => {
    const url = String(request.raw?.url || request.url || '')
    if (url.startsWith('/api/') || url.startsWith('/health')) {
      return reply.code(404).send({ error: 'Not found' })
    }
    return reply.sendFile('index.html')
  })

  app.log.info('[X BOOT][SPA] serving dashboard from ' + DIST_DIR)
} else {
  app.log.warn(
    '[X BOOT][SPA] dist/ not found — run `npm run build` to serve the dashboard. ' +
    'API is still available at /api/*'
  )
}

/* -------------------------------------------------------------------------- */
/* Boot                                                                       */
/* -------------------------------------------------------------------------- */

const agentConfig = validateAgentConfig()
if (!agentConfig.ok) {
  for (const error of agentConfig.errors) {
    console.error(`[X BOOT][AGENT] ${error}`)
  }
} else {
  console.log(`[X BOOT][AGENT] provider=${agentConfig.provider} config OK`)
}

try {
  await app.listen({ port, host: process.env.HOST || '0.0.0.0' })

  if (process.env.X_AUTOSTART_WHATSAPP !== 'false') {
    try {
      runtime = await botManager.start('default')
      console.log('[X BOOT] Default tenant connected.')
    } catch (error) {
      console.error('[X BOOT] Default tenant failed:', error?.message || error)
    }

    const count = await botManager.startAll()
    console.log(`[X BOOT] ${count} tenant runtime(s) running.`)
  }
} catch (e) {
  app.log.error(e)
  process.exit(1)
}