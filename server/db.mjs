import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

const dataDir = path.resolve(
  process.env.X_DATA_DIR || './data'
)

fs.mkdirSync(dataDir, {
  recursive: true
})

const db = new Database(
  path.join(dataDir, 'x-runtime.sqlite')
)

db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')

/* -------------------------------------------------------------------------- */
/* Database schema                                                            */
/* -------------------------------------------------------------------------- */

db.exec(`
CREATE TABLE IF NOT EXISTS groups (
  group_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT,
  description TEXT,
  profile_picture_url TEXT,
  cards_enabled INTEGER NOT NULL DEFAULT 1,

  member_count INTEGER NOT NULL DEFAULT 0,
  admins_count INTEGER NOT NULL DEFAULT 0,

  rules TEXT,

  prefix TEXT NOT NULL DEFAULT '.',
  theme TEXT NOT NULL DEFAULT 'X Dark',

  anti_link INTEGER NOT NULL DEFAULT 0,
  anti_spam INTEGER NOT NULL DEFAULT 0,

  welcome_enabled INTEGER NOT NULL DEFAULT 1,
  goodbye_enabled INTEGER NOT NULL DEFAULT 1,

  antidelete_mode TEXT NOT NULL DEFAULT 'off',

  welcome_template TEXT NOT NULL DEFAULT 'Welcome {user} to *{group}*! You are member #{count}.',
  goodbye_template TEXT NOT NULL DEFAULT 'Goodbye {user}. {group} will miss you.',

  connection_state TEXT NOT NULL DEFAULT 'syncing',

  settings_json TEXT NOT NULL DEFAULT '{}',

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  PRIMARY KEY (tenant_id, group_id)
);

CREATE TABLE IF NOT EXISTS vice_war_participants (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  war_id TEXT NOT NULL,
  jid TEXT NOT NULL,
  faction_id TEXT NOT NULL,
  side TEXT NOT NULL,
  damage INTEGER NOT NULL DEFAULT 0,
  attacks INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, war_id, jid)
);

CREATE INDEX IF NOT EXISTS idx_vice_war_participants_war
  ON vice_war_participants(tenant_id, war_id, side);

CREATE TABLE IF NOT EXISTS vice_war_contracts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  war_id TEXT NOT NULL,
  faction_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  group_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  jid TEXT NOT NULL,

  lid TEXT,
  phone TEXT,

  username TEXT,
  display_name TEXT,

  role TEXT NOT NULL DEFAULT 'member',

  avatar_url TEXT,

  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,

  coins INTEGER NOT NULL DEFAULT 0,
  bank INTEGER NOT NULL DEFAULT 0,

  messages INTEGER NOT NULL DEFAULT 0,

  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,

  reputation INTEGER NOT NULL DEFAULT 0,

  streak INTEGER NOT NULL DEFAULT 0,

  last_daily TEXT,
  last_weekly TEXT,
  last_monthly TEXT,

  updated_at TEXT NOT NULL,

  PRIMARY KEY (tenant_id, group_id, jid)
);

CREATE TABLE IF NOT EXISTS game_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  group_id TEXT NOT NULL,

  type TEXT NOT NULL,
  status TEXT NOT NULL,

  created_by TEXT NOT NULL,

  state_json TEXT NOT NULL,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS warnings (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  group_id TEXT NOT NULL,
  jid TEXT NOT NULL,

  count INTEGER NOT NULL DEFAULT 0,
  last_reason TEXT,

  updated_at TEXT NOT NULL,

  PRIMARY KEY (tenant_id, group_id, jid)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',

  group_id TEXT,

  actor_jid TEXT,

  action TEXT NOT NULL,

  target_jid TEXT,

  details_json TEXT NOT NULL DEFAULT '{}',

  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS menu_assets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',

  url TEXT NOT NULL,

  category TEXT NOT NULL DEFAULT 'X branding',

  active INTEGER NOT NULL DEFAULT 1,

  usage_count INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bot_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dashboard_users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_login TEXT,
  password_changed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_dashboard_users_tenant
  ON dashboard_users(tenant_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_users_username
  ON dashboard_users(username);

CREATE TABLE IF NOT EXISTS bot_rivals (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  group_id TEXT NOT NULL,
  jid TEXT NOT NULL,

  display_name TEXT,
  owner_jid TEXT,

  score INTEGER NOT NULL DEFAULT 0,
  strikes INTEGER NOT NULL DEFAULT 0,

  detected_by TEXT,
  last_quote TEXT,

  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  surrendered_at TEXT,
  revoked_at TEXT,
  defeated_at TEXT,

  status TEXT NOT NULL DEFAULT 'hunted',

  PRIMARY KEY (tenant_id, group_id, jid)
);

CREATE TABLE IF NOT EXISTS vice_characters (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  group_id TEXT NOT NULL,
  jid TEXT NOT NULL,

  hp INTEGER NOT NULL DEFAULT 100,
  max_hp INTEGER NOT NULL DEFAULT 100,
  energy INTEGER NOT NULL DEFAULT 100,
  max_energy INTEGER NOT NULL DEFAULT 100,
  nerve INTEGER NOT NULL DEFAULT 20,
  max_nerve INTEGER NOT NULL DEFAULT 20,

  strength INTEGER NOT NULL DEFAULT 5,
  agility INTEGER NOT NULL DEFAULT 5,
  tech INTEGER NOT NULL DEFAULT 5,
  cool INTEGER NOT NULL DEFAULT 5,

  level INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0,

  career TEXT DEFAULT NULL,

  credits INTEGER NOT NULL DEFAULT 0,
  bank INTEGER NOT NULL DEFAULT 0,
  aura INTEGER NOT NULL DEFAULT 0,

  kills INTEGER NOT NULL DEFAULT 0,
  deaths INTEGER NOT NULL DEFAULT 0,
  robberies INTEGER NOT NULL DEFAULT 0,
  busted INTEGER NOT NULL DEFAULT 0,

  hospital_until TEXT DEFAULT NULL,
  jail_until TEXT DEFAULT NULL,

  last_energy_tick TEXT DEFAULT NULL,
  last_nerve_tick TEXT DEFAULT NULL,

  cooldowns_json TEXT NOT NULL DEFAULT '{}',

  pvp_enabled INTEGER NOT NULL DEFAULT 1,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  PRIMARY KEY (tenant_id, group_id, jid)
);

CREATE TABLE IF NOT EXISTS vice_gear (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  group_id TEXT NOT NULL,
  jid TEXT NOT NULL,

  item_id TEXT NOT NULL,
  slot TEXT NOT NULL,
  equipped INTEGER NOT NULL DEFAULT 0,

  acquired_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vice_gear_owner
  ON vice_gear(tenant_id, group_id, jid);

CREATE TABLE IF NOT EXISTS vice_factions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  group_id TEXT NOT NULL,
  name TEXT NOT NULL,

  leader_jid TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  reputation INTEGER NOT NULL DEFAULT 0,

  bank INTEGER NOT NULL DEFAULT 0,

  wars_won INTEGER NOT NULL DEFAULT 0,
  wars_lost INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  UNIQUE(tenant_id, group_id, name)
);

CREATE TABLE IF NOT EXISTS vice_faction_members (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  faction_id TEXT NOT NULL,
  jid TEXT NOT NULL,

  role TEXT NOT NULL DEFAULT 'member',

  joined_at TEXT NOT NULL,

  PRIMARY KEY (tenant_id, faction_id, jid)
);

CREATE INDEX IF NOT EXISTS idx_vice_faction_members_jid
  ON vice_faction_members(tenant_id, jid);

CREATE TABLE IF NOT EXISTS vice_territories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  bonus_type TEXT NOT NULL,
  bonus_value REAL NOT NULL,

  current_owner_faction_id TEXT DEFAULT NULL,
  season_score INTEGER NOT NULL DEFAULT 0,

  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vice_wars (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  group_id TEXT NOT NULL,

  attacker_faction_id TEXT NOT NULL,
  defender_faction_id TEXT NOT NULL,

  attacker_score INTEGER NOT NULL DEFAULT 0,
  defender_score INTEGER NOT NULL DEFAULT 0,

  territory_id TEXT DEFAULT NULL,

  status TEXT NOT NULL DEFAULT 'active',

  started_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  resolved_at TEXT DEFAULT NULL,

  winner_faction_id TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_vice_wars_group
  ON vice_wars(tenant_id, group_id, status);

CREATE TABLE IF NOT EXISTS vice_seasons (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  group_id TEXT NOT NULL,

  season_number INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,

  ended INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS command_assets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  command_name TEXT NOT NULL,
  url TEXT,
  type TEXT NOT NULL DEFAULT 'generated',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  UNIQUE(tenant_id, command_name)
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  owner_jid TEXT NOT NULL UNIQUE,
  display_name TEXT,
  auth_folder TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_at TEXT,
  connected_at TEXT,
  last_seen TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenants_owner
  ON tenants(owner_jid);

CREATE INDEX IF NOT EXISTS idx_tenants_status
  ON tenants(status);

CREATE TABLE IF NOT EXISTS pair_requests (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  jid TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  requested_at TEXT NOT NULL,
  reviewed_at TEXT,
  reviewed_by TEXT,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_pair_requests_code
  ON pair_requests(code);

CREATE INDEX IF NOT EXISTS idx_pair_requests_status
  ON pair_requests(status);

CREATE TABLE IF NOT EXISTS tenant_users (
  tenant_id TEXT NOT NULL,
  jid TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, jid)
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_jid
  ON tenant_users(jid);

CREATE INDEX IF NOT EXISTS idx_command_assets_name
  ON command_assets(tenant_id, command_name);

CREATE TABLE IF NOT EXISTS anonymous_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  group_id TEXT NOT NULL,
  sender_jid TEXT NOT NULL,
  target_jid TEXT,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_anon_group
  ON anonymous_queue(tenant_id, group_id, delivered);

CREATE TABLE IF NOT EXISTS game_stats (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  group_id TEXT NOT NULL,
  jid TEXT NOT NULL,
  game TEXT NOT NULL,
  played INTEGER NOT NULL DEFAULT 0,
  won INTEGER NOT NULL DEFAULT 0,
  lost INTEGER NOT NULL DEFAULT 0,
  drawn INTEGER NOT NULL DEFAULT 0,
  biggest_win INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, group_id, jid, game)
);

CREATE INDEX IF NOT EXISTS idx_members_group
  ON members(tenant_id, group_id);

CREATE INDEX IF NOT EXISTS idx_members_group_lid
  ON members(tenant_id, group_id, lid);

CREATE INDEX IF NOT EXISTS idx_members_group_phone
  ON members(tenant_id, group_id, phone);

CREATE INDEX IF NOT EXISTS idx_members_group_username
  ON members(tenant_id, group_id, username);

CREATE INDEX IF NOT EXISTS idx_members_group_display_name
  ON members(tenant_id, group_id, display_name);

CREATE INDEX IF NOT EXISTS idx_games_group_status
  ON game_sessions(tenant_id, group_id, status);

CREATE INDEX IF NOT EXISTS idx_audit_group
  ON audit_log(tenant_id, group_id, created_at);

CREATE INDEX IF NOT EXISTS idx_rivals_group
  ON bot_rivals(tenant_id, group_id);

CREATE TABLE IF NOT EXISTS bot_bans (
  jid TEXT PRIMARY KEY,
  reason TEXT,
  banned_at TEXT NOT NULL,
  banned_by TEXT,
  expires_at TEXT,
  permanent INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tenant_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  group_id TEXT,
  actor_jid TEXT,
  command TEXT NOT NULL,
  message_body TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_activity_tenant
  ON tenant_activity(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tenant_connection_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  event TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_conn_events
  ON tenant_connection_events(tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bot_bans_expires
  ON bot_bans(expires_at);
`)

/* -------------------------------------------------------------------------- */
/* Lightweight migrations                                                     */
/* -------------------------------------------------------------------------- */

const migrations = [
  'ALTER TABLE members ADD COLUMN bank INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE members ADD COLUMN wins INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE members ADD COLUMN losses INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE members ADD COLUMN reputation INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE members ADD COLUMN streak INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE members ADD COLUMN last_daily TEXT',
  'ALTER TABLE members ADD COLUMN last_weekly TEXT',
  'ALTER TABLE members ADD COLUMN last_monthly TEXT',
  'ALTER TABLE bot_rivals ADD COLUMN surrendered_at TEXT',
  'ALTER TABLE bot_rivals ADD COLUMN revoked_at TEXT',
  'ALTER TABLE bot_rivals ADD COLUMN defeated_at TEXT',
  'ALTER TABLE groups ADD COLUMN welcome_enabled INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE groups ADD COLUMN goodbye_enabled INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE groups ADD COLUMN welcome_template TEXT',
  'ALTER TABLE groups ADD COLUMN goodbye_template TEXT',
  'ALTER TABLE groups ADD COLUMN cards_enabled INTEGER NOT NULL DEFAULT 1',
  "ALTER TABLE groups ADD COLUMN antidelete_mode TEXT NOT NULL DEFAULT 'off'",
  "UPDATE groups SET antidelete_mode = CASE WHEN antidelete_enabled = 1 THEN 'public' ELSE 'off' END WHERE antidelete_mode = 'off' AND antidelete_enabled IS NOT NULL",
  'ALTER TABLE vice_characters ADD COLUMN cooldowns_json TEXT NOT NULL DEFAULT \'{}\'',
  'ALTER TABLE vice_characters ADD COLUMN pvp_enabled INTEGER NOT NULL DEFAULT 1',
  'ALTER TABLE vice_characters ADD COLUMN last_energy_tick TEXT',
  'ALTER TABLE vice_characters ADD COLUMN last_nerve_tick TEXT',
  'ALTER TABLE tenants ADD COLUMN disconnected_at TEXT',
  'ALTER TABLE tenants ADD COLUMN total_commands INTEGER NOT NULL DEFAULT 0',
  'ALTER TABLE game_sessions ADD COLUMN board_message_id TEXT'
]

for (const sql of migrations) {
  try {
    db.exec(sql)
  } catch {
    /* Column already exists. */
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const now = () =>
  new Date().toISOString()

/* -------------------------------------------------------------------------- */
/* Default tenant                                                             */
/* -------------------------------------------------------------------------- */

try {
  const ownerNumber = String(
    process.env.X_OWNER_NUMBER || ''
  ).replace(/\D/g, '')

  const ownerJid = ownerNumber
    ? `${ownerNumber}@s.whatsapp.net`
    : 'owner@default'

  const authFolder = path.resolve(
    process.env.WHATSAPP_AUTH_DIR || './auth/x'
  )

  db.prepare(`
    INSERT INTO tenants (
      id, owner_jid, display_name, auth_folder,
      status, approved_at, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 'approved', ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(
    'default',
    ownerJid,
    'Primary',
    authFolder,
    now(),
    now(),
    now()
  )
} catch (error) {
  console.warn('[db] Could not seed default tenant:', error?.message || error)
}

function cleanIdentityText(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  return text
}

function isMachineIdentifier(value) {
  const text = String(value ?? '').trim()
  if (!text) return true

  if (
    text.includes('@s.whatsapp.net') ||
    text.includes('@g.us') ||
    text.includes('@lid') ||
    text.includes('@c.us')
  ) {
    return true
  }

  if (/^[+]?\d[\d\s().-]*$/.test(text)) {
    return true
  }

  return false
}

function cleanHumanIdentity(value) {
  const text = cleanIdentityText(value)
  if (!text) return null
  if (isMachineIdentifier(text)) return null
  return text
}

function normalizeHumanName(value) {
  return String(value ?? '')
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase()
}

function normalizeIdentityValue(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''

  if (/^[+]?\d[\d\s().-]*$/.test(text)) {
    return text.replace(/\D/g, '')
  }

  return text.toLocaleLowerCase()
}

function normalizeJid(value) {
  const text = cleanIdentityText(value)
  return text || null
}

function safeJsonParse(value, fallback = {}) {
  if (typeof value !== 'string' || !value.trim()) {
    return fallback
  }

  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object'
      ? parsed
      : fallback
  } catch {
    return fallback
  }
}

function normalizeAntideleteMode(value) {
  const v = String(value ?? '').toLowerCase()
  if (v === 'admins') return 'admins'
  if (v === 'public') return 'public'
  if (v === 'on') return 'public'
  if (v === 'off') return 'off'
  return 'off'
}

function resolveBotOwner(tenantId, groupId, botJid) {
  const user = String(botJid || '').split('@')[0]
  if (!user) return null

  const row = db.prepare(`
    SELECT jid
    FROM members
    WHERE tenant_id=?
      AND group_id=?
      AND role IN ('admin', 'superadmin')
      AND (
        phone LIKE ?
        OR lid LIKE ?
        OR jid LIKE ?
      )
    LIMIT 1
  `).get(
    tenantId,
    groupId,
    `%${user}%`,
    `%${user}%`,
    `%${user}%`
  )

  return row?.jid || null
}

export function getMemberHumanName(
  member,
  fallback = 'New member'
) {
  const username = cleanHumanIdentity(member?.username)
  const displayName = cleanHumanIdentity(
    member?.display_name || member?.displayName
  )

  return (
    username ||
    displayName ||
    cleanHumanIdentity(fallback) ||
    'New member'
  )
}

/* -------------------------------------------------------------------------- */
/* VICE — territory seeding                                                   */
/* -------------------------------------------------------------------------- */

const TERRITORIES = [
  { id: 'downtown', name: '🏙️ Downtown', description: 'Corporate towers and neon towers', bonus_type: 'credits', bonus_value: 0.10 },
  { id: 'neon', name: '🌆 Neon District', description: 'Hacker dens and drone ports', bonus_type: 'tech', bonus_value: 0.05 },
  { id: 'docks', name: '🏭 Docks', description: 'Smuggling routes and warehouses', bonus_type: 'heist', bonus_value: 0.10 },
  { id: 'oldtown', name: '🌃 Old Town', description: 'Alley fights and underground rings', bonus_type: 'strength', bonus_value: 0.05 },
  { id: 'heights', name: '🏔️ Heights', description: 'Elite syndicate estates', bonus_type: 'aura', bonus_value: 1 },
  { id: 'casino', name: '🎰 Casino Strip', description: 'High-roller parlors and fixed tables', bonus_type: 'luck', bonus_value: 0.05 }
]

const seedTerritories = db.prepare(`
  INSERT INTO vice_territories (
    id, name, description, bonus_type, bonus_value, updated_at
  )
  VALUES (?,?,?,?,?,?)
  ON CONFLICT(id) DO NOTHING
`)

for (const t of TERRITORIES) {
  seedTerritories.run(
    t.id, t.name, t.description, t.bonus_type, t.bonus_value, now()
  )
}

/* -------------------------------------------------------------------------- */
/* Groups                                                                     */
/* -------------------------------------------------------------------------- */

export function upsertGroup(tenantId, group) {
  const timestamp = now()

  db.prepare(`
    INSERT INTO groups (
      tenant_id, group_id, name, description, profile_picture_url,
      cards_enabled, member_count, admins_count, rules, prefix, theme,
      anti_link, anti_spam, welcome_enabled, goodbye_enabled,
      antidelete_mode,
      welcome_template, goodbye_template, connection_state,
      settings_json, created_at, updated_at
    )
    VALUES (
      @tenantId, @groupId, @name, @description, @profilePictureUrl,
      @cardsEnabled, @memberCount, @adminsCount, @rules, @prefix, @theme,
      @antiLink, @antiSpam, @welcomeEnabled, @goodbyeEnabled,
      @antideleteMode,
      @welcomeTemplate, @goodbyeTemplate, @connectionState,
      @settingsJson, @createdAt, @updatedAt
    )
    ON CONFLICT(tenant_id, group_id)
    DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      profile_picture_url = excluded.profile_picture_url,
      cards_enabled = excluded.cards_enabled,
      member_count = excluded.member_count,
      admins_count = excluded.admins_count,
      rules = excluded.rules,
      prefix = excluded.prefix,
      theme = excluded.theme,
      anti_link = excluded.anti_link,
      anti_spam = excluded.anti_spam,
      welcome_enabled = excluded.welcome_enabled,
      goodbye_enabled = excluded.goodbye_enabled,
      antidelete_mode = excluded.antidelete_mode,
      welcome_template = excluded.welcome_template,
      goodbye_template = excluded.goodbye_template,
      connection_state = excluded.connection_state,
      settings_json = excluded.settings_json,
      updated_at = excluded.updated_at
  `).run({
    tenantId,
    groupId: group.groupId,
    name: group.name ?? null,
    description: group.description ?? null,
    profilePictureUrl: group.profilePictureUrl ?? null,
    cardsEnabled: group.cardsEnabled === false ? 0 : 1,
    memberCount: group.memberCount ?? 0,
    adminsCount: group.adminsCount ?? 0,
    rules: group.rules ?? null,
    prefix: group.prefix ?? '.',
    theme: group.theme ?? 'X Dark',
    antiLink: group.antiLink ? 1 : 0,
    antiSpam: group.antiSpam ? 1 : 0,
    welcomeEnabled: group.welcomeEnabled === false ? 0 : 1,
    goodbyeEnabled: group.goodbyeEnabled === false ? 0 : 1,
    antideleteMode: normalizeAntideleteMode(group.antideleteMode),
    welcomeTemplate: group.welcomeTemplate ?? 'Welcome {user} to *{group}*! You are member #{count}.',
    goodbyeTemplate: group.goodbyeTemplate ?? 'Goodbye {user}. {group} will miss you.',
    connectionState: group.connectionState ?? 'synced',
    settingsJson: JSON.stringify(group.settings ?? {}),
    createdAt: group.createdAt ?? timestamp,
    updatedAt: timestamp
  })

  return getGroup(tenantId, group.groupId)
}

export function setGroupState(tenantId, groupId, state) {
  db.prepare(`
    UPDATE groups
    SET connection_state=?, updated_at=?
    WHERE tenant_id=? AND group_id=?
  `).run(state, now(), tenantId, groupId)

  return getGroup(tenantId, groupId)
}

export function listGroups(tenantId) {
  return db.prepare(`
    SELECT * FROM groups
    WHERE tenant_id=?
    ORDER BY name COLLATE NOCASE
  `).all(tenantId)
}

export function getGroup(tenantId, groupId) {
  return db.prepare(`
    SELECT * FROM groups
    WHERE tenant_id=? AND group_id=?
  `).get(tenantId, groupId)
}

export function updateGroupSettings(tenantId, groupId, patch = {}) {
  const current = getGroup(tenantId, groupId)
  if (!current) return null

  const currentSettings = safeJsonParse(current.settings_json, {})

  const settings = {
    ...currentSettings,
    ...(patch.settings || {})
  }

  upsertGroup(tenantId, {
    groupId,
    name: current.name,
    description: current.description,
    profilePictureUrl: current.profile_picture_url,
    cardsEnabled: patch.cardsEnabled !== undefined ? !!patch.cardsEnabled : !!current.cards_enabled,
    memberCount: current.member_count,
    adminsCount: current.admins_count,
    rules: patch.rules ?? current.rules,
    prefix: patch.prefix ?? current.prefix,
    theme: patch.theme ?? current.theme,
    antiLink: patch.antiLink !== undefined ? !!patch.antiLink : !!current.anti_link,
    antiSpam: patch.antiSpam !== undefined ? !!patch.antiSpam : !!current.anti_spam,
    welcomeEnabled: patch.welcomeEnabled !== undefined ? !!patch.welcomeEnabled : !!current.welcome_enabled,
    goodbyeEnabled: patch.goodbyeEnabled !== undefined ? !!patch.goodbyeEnabled : !!current.goodbye_enabled,
    antideleteMode: patch.antideleteMode !== undefined
      ? normalizeAntideleteMode(patch.antideleteMode)
      : normalizeAntideleteMode(current.antidelete_mode),
    welcomeTemplate: patch.welcomeTemplate ?? current.welcome_template,
    goodbyeTemplate: patch.goodbyeTemplate ?? current.goodbye_template,
    connectionState: current.connection_state,
    settings,
    createdAt: current.created_at
  })

  return getGroup(tenantId, groupId)
}

/**
 * Get the current antidelete mode for a group.
 * Returns 'off' | 'admins' | 'public'.
 * Defaults to 'off' when the row does not exist.
 */
export function getAntideleteMode(tenantId, groupId) {
  if (!groupId) return 'off'

  const row = db.prepare(`
    SELECT antidelete_mode FROM groups
    WHERE tenant_id=? AND group_id=?
  `).get(tenantId, groupId)

  if (!row) return 'off'

  const mode = String(row.antidelete_mode || '').toLowerCase()

  if (mode === 'admins') return 'admins'
  if (mode === 'public') return 'public'
  return 'off'
}

/**
 * Backwards-compat shim. Some callers still ask "is it on".
 * Admins and public both count as "on".
 */
export function isAntideleteEnabled(tenantId, groupId) {
  return getAntideleteMode(tenantId, groupId) !== 'off'
}

/* -------------------------------------------------------------------------- */
/* Members                                                                    */
/* -------------------------------------------------------------------------- */

export function getMember(tenantId, groupId, jid) {
  if (!groupId || !jid) return null

  /*
   * Match against jid, lid, OR phone. WhatsApp hands out
   * three identifier formats, and depending on the group
   * sync, any one of them may end up as the "primary" ID.
   * Also strips the @lid / @s.whatsapp.net suffix and does
   * a numeric match as a last resort.
   */
  const bare = String(jid).split('@')[0]

  return db.prepare(`
    SELECT * FROM members
    WHERE tenant_id=?
      AND group_id=?
      AND (
        jid = ?
        OR lid = ?
        OR phone = ?
        OR jid LIKE ?
        OR lid LIKE ?
        OR phone LIKE ?
      )
    LIMIT 1
  `).get(
    tenantId,
    groupId,
    jid,
    jid,
    jid,
    `%${bare}%`,
    `%${bare}%`,
    `%${bare}%`
  )
}

export function findMemberByIdentity(tenantId, groupId, identity = {}) {
  if (!groupId) return null

  const jid = cleanIdentityText(identity.jid)
  const lid = cleanIdentityText(identity.lid)
  const phone = cleanIdentityText(identity.phone)
  const username = cleanHumanIdentity(identity.username)
  const displayName = cleanHumanIdentity(
    identity.displayName ?? identity.display_name
  )

  if (jid) {
    const member = getMember(tenantId, groupId, jid)
    if (member) return member
  }

  if (lid) {
    const normalized = normalizeIdentityValue(lid)
    const member = db.prepare(`
      SELECT * FROM members
      WHERE tenant_id=? AND group_id=?
        AND lid IS NOT NULL
        AND lower(trim(lid))=?
      LIMIT 1
    `).get(tenantId, groupId, normalized)

    if (member) return member
  }

  if (phone) {
    const normalized = normalizeIdentityValue(phone)
    const rows = db.prepare(`
      SELECT * FROM members
      WHERE tenant_id=? AND group_id=?
        AND phone IS NOT NULL
    `).all(tenantId, groupId)

    const member = rows.find(
      (row) => normalizeIdentityValue(row.phone) === normalized
    )
    if (member) return member
  }

  if (username) {
    const normalized = normalizeHumanName(username)
    const member = db.prepare(`
      SELECT * FROM members
      WHERE tenant_id=? AND group_id=?
        AND username IS NOT NULL
    `).all(tenantId, groupId).find(
      (row) => normalizeHumanName(row.username) === normalized
    )
    if (member) return member
  }

  if (displayName) {
    const normalized = normalizeHumanName(displayName)
    const member = db.prepare(`
      SELECT * FROM members
      WHERE tenant_id=? AND group_id=?
        AND display_name IS NOT NULL
    `).all(tenantId, groupId).find(
      (row) => normalizeHumanName(row.display_name) === normalized
    )
    if (member) return member
  }

  return null
}

export function updateMemberIdentity(tenantId, groupId, jid, identity = {}) {
  if (!groupId || !jid) return null

  const current = getMember(tenantId, groupId, jid)
  const existing = current || findMemberByIdentity(tenantId, groupId, identity)

  if (!existing) return null

  const finalJid = normalizeJid(jid) || existing.jid

  const username =
    cleanHumanIdentity(identity.username) ||
    cleanHumanIdentity(existing.username) ||
    null

  const displayName =
    cleanHumanIdentity(identity.displayName) ||
    cleanHumanIdentity(identity.display_name) ||
    cleanHumanIdentity(existing.display_name) ||
    username ||
    cleanHumanIdentity(existing.username) ||
    null

  const lid = cleanIdentityText(identity.lid) || cleanIdentityText(existing.lid) || null
  const phone = cleanIdentityText(identity.phone) || cleanIdentityText(existing.phone) || null
  const avatarUrl =
    cleanIdentityText(identity.avatarUrl) ||
    cleanIdentityText(identity.avatar_url) ||
    cleanIdentityText(existing.avatar_url) ||
    null

  if (existing.jid === finalJid) {
    db.prepare(`
      UPDATE members
      SET lid=?, phone=?, username=?, display_name=?, avatar_url=?, updated_at=?
      WHERE tenant_id=? AND group_id=? AND jid=?
    `).run(lid, phone, username, displayName, avatarUrl, now(), tenantId, groupId, existing.jid)

    return getMember(tenantId, groupId, existing.jid)
  }

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE members
      SET jid=?, lid=?, phone=?, username=?, display_name=?, avatar_url=?, updated_at=?
      WHERE tenant_id=? AND group_id=? AND jid=?
    `).run(finalJid, lid, phone, username, displayName, avatarUrl, now(), tenantId, groupId, existing.jid)
  })

  try {
    tx()
  } catch {
    db.prepare(`
      UPDATE members
      SET lid=?, phone=?, username=?, display_name=?, avatar_url=?, updated_at=?
      WHERE tenant_id=? AND group_id=? AND jid=?
    `).run(lid, phone, username, displayName, avatarUrl, now(), tenantId, groupId, finalJid)
  }

  return getMember(tenantId, groupId, finalJid)
}

export function replaceMembers(tenantId, groupId, members = []) {
  if (!groupId) return []

  const existingRows = db.prepare(`
    SELECT * FROM members
    WHERE tenant_id=? AND group_id=?
  `).all(tenantId, groupId)

  const byJid = new Map()
  const byLid = new Map()
  const byPhone = new Map()
  const byUsername = new Map()
  const byDisplayName = new Map()

  for (const member of existingRows) {
    if (member.jid) byJid.set(normalizeIdentityValue(member.jid), member)
    if (member.lid) byLid.set(normalizeIdentityValue(member.lid), member)
    if (member.phone) byPhone.set(normalizeIdentityValue(member.phone), member)
    if (member.username) byUsername.set(normalizeHumanName(member.username), member)
    if (member.display_name) {
      byDisplayName.set(normalizeHumanName(member.display_name), member)
    }
  }

  const resolveExisting = (member) => {
    const jid = cleanIdentityText(member.jid)
    const lid = cleanIdentityText(member.lid)
    const phone = cleanIdentityText(member.phone)
    const username = cleanHumanIdentity(member.username)
    const displayName = cleanHumanIdentity(member.displayName ?? member.display_name)

    if (jid) { const m = byJid.get(normalizeIdentityValue(jid)); if (m) return m }
    if (lid) { const m = byLid.get(normalizeIdentityValue(lid)); if (m) return m }
    if (phone) { const m = byPhone.get(normalizeIdentityValue(phone)); if (m) return m }
    if (username) { const m = byUsername.get(normalizeHumanName(username)); if (m) return m }
    if (displayName) { const m = byDisplayName.get(normalizeHumanName(displayName)); if (m) return m }

    return null
  }

  const tx = db.transaction(() => {
    const upsert = db.prepare(`
      INSERT INTO members (
        tenant_id, group_id, jid, lid, phone, username, display_name,
        role, avatar_url, xp, level, coins, bank, messages,
        wins, losses, reputation, streak,
        last_daily, last_weekly, last_monthly, updated_at
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(tenant_id, group_id, jid)
      DO UPDATE SET
        lid = COALESCE(excluded.lid, members.lid),
        phone = COALESCE(excluded.phone, members.phone),
        username = COALESCE(excluded.username, members.username),
        display_name = COALESCE(
          excluded.display_name, members.display_name,
          excluded.username, members.username
        ),
        role = excluded.role,
        avatar_url = COALESCE(excluded.avatar_url, members.avatar_url),
        xp = members.xp,
        level = members.level,
        coins = members.coins,
        bank = members.bank,
        messages = members.messages,
        wins = members.wins,
        losses = members.losses,
        reputation = members.reputation,
        streak = members.streak,
        last_daily = members.last_daily,
        last_weekly = members.last_weekly,
        last_monthly = members.last_monthly,
        updated_at = excluded.updated_at
    `)

    const seen = new Set()

    for (const input of members) {
      const member = input || {}
      const jid = cleanIdentityText(member.jid)
      if (!jid) continue

      const old = resolveExisting(member)

      const username = cleanHumanIdentity(member.username) || cleanHumanIdentity(old?.username) || null
      const displayName =
        cleanHumanIdentity(member.displayName ?? member.display_name) ||
        cleanHumanIdentity(member.notify) ||
        cleanHumanIdentity(member.name) ||
        cleanHumanIdentity(old?.display_name) ||
        cleanHumanIdentity(old?.username) ||
        username ||
        null
      const lid = cleanIdentityText(member.lid) || cleanIdentityText(old?.lid) || null
      const phone = cleanIdentityText(member.phone) || cleanIdentityText(old?.phone) || null
      const avatarUrl = cleanIdentityText(member.avatarUrl ?? member.avatar_url) || cleanIdentityText(old?.avatar_url) || null
      const role = member.role ?? old?.role ?? 'member'

      upsert.run(
        tenantId, groupId, jid, lid, phone, username, displayName,
        role, avatarUrl,
        old?.xp ?? member.xp ?? 0,
        old?.level ?? member.level ?? 1,
        old?.coins ?? member.coins ?? 0,
        old?.bank ?? member.bank ?? 0,
        old?.messages ?? member.messages ?? 0,
        old?.wins ?? member.wins ?? 0,
        old?.losses ?? member.losses ?? 0,
        old?.reputation ?? member.reputation ?? 0,
        old?.streak ?? member.streak ?? 0,
        old?.last_daily ?? member.lastDaily ?? null,
        old?.last_weekly ?? member.lastWeekly ?? null,
        old?.last_monthly ?? member.lastMonthly ?? null,
        now()
      )

      seen.add(jid)
    }

    const currentRows = db.prepare(`
      SELECT jid FROM members
      WHERE tenant_id=? AND group_id=?
    `).all(tenantId, groupId)

    const remove = db.prepare(`
      DELETE FROM members
      WHERE tenant_id=? AND group_id=? AND jid=?
    `)

    for (const row of currentRows) {
      if (!seen.has(row.jid)) remove.run(tenantId, groupId, row.jid)
    }
  })

  tx()

  return listMembers(tenantId, groupId, 500, 0)
}

export function listMembers(tenantId, groupId, limit = 100, offset = 0) {
  const safeLimit = Math.max(1, Math.min(1000, Number(limit) || 100))
  const safeOffset = Math.max(0, Number(offset) || 0)

  return db.prepare(`
    SELECT * FROM members
    WHERE tenant_id=? AND group_id=?
    ORDER BY
      CASE role
        WHEN 'superadmin' THEN 0
        WHEN 'admin' THEN 1
        ELSE 2
      END,
      CASE
        WHEN (display_name IS NULL OR TRIM(display_name)='')
        AND (username IS NULL OR TRIM(username)='')
        THEN 1
        ELSE 0
      END,
      COALESCE(
        NULLIF(TRIM(display_name), ''),
        NULLIF(TRIM(username), ''),
        'New member'
      ) COLLATE NOCASE
    LIMIT ? OFFSET ?
  `).all(tenantId, groupId, safeLimit, safeOffset)
}

export function countMembers(tenantId, groupId) {
  return db.prepare(`
    SELECT COUNT(*) AS count FROM members
    WHERE tenant_id=? AND group_id=?
  `).get(tenantId, groupId).count
}

export function getMemberDisplayName(tenantId, groupId, jid, fallback = 'New member') {
  const member = findMemberByIdentity(tenantId, groupId, { jid })
  return getMemberHumanName(member, fallback)
}

/* -------------------------------------------------------------------------- */
/* Member stats / economy                                                     */
/* -------------------------------------------------------------------------- */

export function touchMember(tenantId, groupId, jid, delta = {}) {
  const member = getMember(tenantId, groupId, jid)
  if (!member) return null

  db.prepare(`
    UPDATE members
    SET xp=xp+?, coins=coins+?, bank=bank+?,
        messages=messages+?, wins=wins+?,
        losses=losses+?, reputation=reputation+?,
        updated_at=?
    WHERE tenant_id=? AND group_id=? AND jid=?
  `).run(
    delta.xp ?? 0, delta.coins ?? 0, delta.bank ?? 0,
    delta.messages ?? 0, delta.wins ?? 0,
    delta.losses ?? 0, delta.reputation ?? 0,
    now(), tenantId, groupId, jid
  )

  return getMember(tenantId, groupId, jid)
}

export function setMemberEconomy(tenantId, groupId, jid, coins, bank) {
  db.prepare(`
    UPDATE members
    SET coins=?, bank=?, updated_at=?
    WHERE tenant_id=? AND group_id=? AND jid=?
  `).run(coins, bank, now(), tenantId, groupId, jid)

  return getMember(tenantId, groupId, jid)
}

export function awardXP(tenantId, groupId, jid, amount) {
  const member = touchMember(tenantId, groupId, jid, { xp: amount })
  if (!member) return null

  const level = Math.max(
    1,
    Math.floor(Math.sqrt(Math.max(0, member.xp) / 100)) + 1
  )

  if (level !== member.level) {
    db.prepare(`
      UPDATE members SET level=?, updated_at=?
      WHERE tenant_id=? AND group_id=? AND jid=?
    `).run(level, now(), tenantId, groupId, jid)
  }

  return getMember(tenantId, groupId, jid)
}

export function dailyClaim(tenantId, groupId, jid) {
  const member = getMember(tenantId, groupId, jid)

  if (!member) {
    return { error: 'Member is not synchronized yet.' }
  }

  const today = new Date().toISOString().slice(0, 10)

  if (member.last_daily === today) {
    return { error: 'Daily reward already claimed today.', member }
  }

  const reward = 100 + member.streak * 10

  db.prepare(`
    UPDATE members
    SET coins=coins+?, xp=xp+25, streak=streak+1, last_daily=?, updated_at=?
    WHERE tenant_id=? AND group_id=? AND jid=?
  `).run(reward, today, now(), tenantId, groupId, jid)

  return {
    reward,
    member: getMember(tenantId, groupId, jid)
  }
}

export function leaderboard(tenantId, groupId, field = 'xp', limit = 10) {
  const allowed = {
    xp: 'xp',
    coins: '(coins+bank)',
    wins: 'wins',
    messages: 'messages',
    reputation: 'reputation',
    streak: 'streak',
    level: 'level'
  }

  const column = allowed[field] || 'xp'

  return db.prepare(`
    SELECT jid, username, display_name, avatar_url,
           xp, level, coins, bank, messages,
           wins, losses, reputation, streak
    FROM members
    WHERE tenant_id=? AND group_id=?
    ORDER BY ${column} DESC,
      COALESCE(
        NULLIF(display_name, ''),
        NULLIF(username, ''),
        'New member'
      ) COLLATE NOCASE
    LIMIT ?
  `).all(
    tenantId, groupId,
    Math.max(1, Math.min(50, Number(limit) || 10))
  )
}

/* -------------------------------------------------------------------------- */
/* Games                                                                      */
/* -------------------------------------------------------------------------- */

export function createGame(tenantId, { groupId, type, createdBy, state }) {
  const id = `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const timestamp = now()

  db.prepare(`
    INSERT INTO game_sessions (
      id, tenant_id, group_id, type, status, created_by,
      state_json, created_at, updated_at
    )
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    id, tenantId, groupId, type, 'active', createdBy,
    JSON.stringify(state ?? {}), timestamp, timestamp
  )

  return getGame(tenantId, id)
}

export function getGame(tenantId, id) {
  return db.prepare(`
    SELECT * FROM game_sessions
    WHERE tenant_id=? AND id=?
  `).get(tenantId, id)
}

export function activeGame(tenantId, groupId, type) {
  return db.prepare(`
    SELECT * FROM game_sessions
    WHERE tenant_id=? AND group_id=? AND type=? AND status='active'
    ORDER BY created_at DESC LIMIT 1
  `).get(tenantId, groupId, type)
}

export function activeGames(tenantId, groupId) {
  return db.prepare(`
    SELECT id, type, status, created_by,
           created_at, updated_at, state_json
    FROM game_sessions
    WHERE tenant_id=? AND group_id=? AND status='active'
    ORDER BY created_at DESC
  `).all(tenantId, groupId)
}

export function updateGame(tenantId, id, state, status = 'active') {
  db.prepare(`
    UPDATE game_sessions
    SET state_json=?, status=?, updated_at=?
    WHERE tenant_id=? AND id=?
  `).run(JSON.stringify(state ?? {}), status, now(), tenantId, id)

  return getGame(tenantId, id)
}

export function closeGames(tenantId, groupId) {
  db.prepare(`
    UPDATE game_sessions
    SET status='closed', updated_at=?
    WHERE tenant_id=? AND group_id=? AND status='active'
  `).run(now(), tenantId, groupId)
}

/* -------------------------------------------------------------------------- */
/* Warnings                                                                   */
/* -------------------------------------------------------------------------- */

export function warning(tenantId, groupId, jid, reason) {
  const existing = db.prepare(`
    SELECT * FROM warnings
    WHERE tenant_id=? AND group_id=? AND jid=?
  `).get(tenantId, groupId, jid)

  const count = (existing?.count || 0) + 1

  db.prepare(`
    INSERT INTO warnings (
      tenant_id, group_id, jid, count, last_reason, updated_at
    )
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(tenant_id, group_id, jid)
    DO UPDATE SET
      count=excluded.count,
      last_reason=excluded.last_reason,
      updated_at=excluded.updated_at
  `).run(tenantId, groupId, jid, count, reason || null, now())

  return db.prepare(`
    SELECT * FROM warnings
    WHERE tenant_id=? AND group_id=? AND jid=?
  `).get(tenantId, groupId, jid)
}

export function getWarnings(tenantId, groupId, jid) {
  return (
    db.prepare(`
      SELECT * FROM warnings
      WHERE tenant_id=? AND group_id=? AND jid=?
    `).get(tenantId, groupId, jid) || {
      group_id: groupId,
      jid,
      count: 0
    }
  )
}

export function warningCount(tenantId, groupId, jid) {
  const row = db.prepare(`
    SELECT count FROM warnings
    WHERE tenant_id=? AND group_id=? AND jid=?
  `).get(tenantId, groupId, jid)

  return row?.count || 0
}

export function clearWarnings(tenantId, groupId, jid) {
  db.prepare(`
    DELETE FROM warnings
    WHERE tenant_id=? AND group_id=? AND jid=?
  `).run(tenantId, groupId, jid)
}

/* -------------------------------------------------------------------------- */
/* Menu assets                                                                */
/* -------------------------------------------------------------------------- */

export function addMenuAsset(tenantId, url, category = 'X branding') {
  const id = `menu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  db.prepare(`
    INSERT INTO menu_assets (
      id, tenant_id, url, category, active, usage_count, created_at
    )
    VALUES (?,?,?,?,?,?,?)
  `).run(id, tenantId, url, category, 1, 0, now())

  return db.prepare(`
    SELECT * FROM menu_assets
    WHERE tenant_id=? AND id=?
  `).get(tenantId, id)
}

export function listMenuAssets(tenantId) {
  return db.prepare(`
    SELECT * FROM menu_assets
    WHERE tenant_id=? AND active=1
    ORDER BY created_at DESC
  `).all(tenantId)
}

export function randomMenuAsset(tenantId) {
  const row = db.prepare(`
    SELECT * FROM menu_assets
    WHERE tenant_id=? AND active=1
    ORDER BY RANDOM() LIMIT 1
  `).get(tenantId)

  if (row) {
    db.prepare(`
      UPDATE menu_assets
      SET usage_count=usage_count+1
      WHERE tenant_id=? AND id=?
    `).run(tenantId, row.id)
  }

  return row
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

export function addAudit(tenantId, groupId, actorJid, action, targetJid, details = {}) {
  db.prepare(`
    INSERT INTO audit_log (
      tenant_id, group_id, actor_jid, action, target_jid,
      details_json, created_at
    )
    VALUES (?,?,?,?,?,?,?)
  `).run(
    tenantId, groupId, actorJid, action,
    targetJid || null,
    JSON.stringify(details ?? {}),
    now()
  )
}

export function recentAudit(tenantId, groupId, limit = 25) {
  return db.prepare(`
    SELECT * FROM audit_log
    WHERE tenant_id=? AND group_id=?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(
    tenantId, groupId,
    Math.max(1, Math.min(100, Number(limit) || 25))
  )
}

/* -------------------------------------------------------------------------- */
/* Group statistics                                                           */
/* -------------------------------------------------------------------------- */

export function groupStats(tenantId, groupId) {
  const members = db.prepare(`
    SELECT COUNT(*) AS count FROM members
    WHERE tenant_id=? AND group_id=?
  `).get(tenantId, groupId).count

  const messages = db.prepare(`
    SELECT COALESCE(SUM(messages), 0) AS total FROM members
    WHERE tenant_id=? AND group_id=?
  `).get(tenantId, groupId).total

  const xp = db.prepare(`
    SELECT COALESCE(SUM(xp), 0) AS total FROM members
    WHERE tenant_id=? AND group_id=?
  `).get(tenantId, groupId).total

  const coins = db.prepare(`
    SELECT COALESCE(SUM(coins+bank), 0) AS total FROM members
    WHERE tenant_id=? AND group_id=?
  `).get(tenantId, groupId).total

  return { members, messages, xp, coins }
}

/* -------------------------------------------------------------------------- */
/* Wallet                                                                     */
/* -------------------------------------------------------------------------- */

export function transferCoins(tenantId, groupId, fromJid, toJid, amount) {
  const n = Math.floor(Number(amount))

  if (!Number.isFinite(n) || n < 1) {
    throw new Error('Amount must be a positive whole number.')
  }

  const tx = db.transaction(() => {
    const from = getMember(tenantId, groupId, fromJid)
    const to = getMember(tenantId, groupId, toJid)

    if (!from || !to) throw new Error('Both members must be synchronized.')
    if (from.coins < n) throw new Error('Insufficient wallet balance.')

    db.prepare(`
      UPDATE members SET coins=coins-?, updated_at=?
      WHERE tenant_id=? AND group_id=? AND jid=?
    `).run(n, now(), tenantId, groupId, fromJid)

    db.prepare(`
      UPDATE members SET coins=coins+?, updated_at=?
      WHERE tenant_id=? AND group_id=? AND jid=?
    `).run(n, now(), tenantId, groupId, toJid)
  })

  tx()

  return {
    amount: n,
    from: getMember(tenantId, groupId, fromJid),
    to: getMember(tenantId, groupId, toJid)
  }
}

export function bankDeposit(tenantId, groupId, jid, amount) {
  const n = Math.floor(Number(amount))
  const member = getMember(tenantId, groupId, jid)

  if (!member) throw new Error('Member not synchronized.')
  if (n <= 0 || member.coins < n) throw new Error('Invalid amount or insufficient wallet balance.')

  return setMemberEconomy(tenantId, groupId, jid, member.coins - n, member.bank + n)
}

export function bankWithdraw(tenantId, groupId, jid, amount) {
  const n = Math.floor(Number(amount))
  const member = getMember(tenantId, groupId, jid)

  if (!member) throw new Error('Member not synchronized.')
  if (n <= 0 || member.bank < n) throw new Error('Invalid amount or insufficient bank balance.')

  return setMemberEconomy(tenantId, groupId, jid, member.coins + n, member.bank - n)
}

export function richlist(tenantId, groupId, limit = 10) {
  return leaderboard(tenantId, groupId, 'coins', limit)
}

/* -------------------------------------------------------------------------- */
/* Bot settings (global key/value)                                            */
/* -------------------------------------------------------------------------- */

export function getBotSetting(key, fallback = null) {
  const row = db.prepare(`SELECT value FROM bot_settings WHERE key=?`).get(String(key))
  return row ? row.value : fallback
}

export function setBotSetting(key, value) {
  db.prepare(`
    INSERT INTO bot_settings (key, value, updated_at)
    VALUES (?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
  `).run(String(key), String(value), now())

  return getBotSetting(key)
}

export function getBotMode() {
  const mode = String(getBotSetting('mode', 'public')).toLowerCase()
  return mode === 'private' ? 'private' : 'public'
}

export function setBotMode(mode) {
  const normalized = String(mode).toLowerCase() === 'private' ? 'private' : 'public'
  setBotSetting('mode', normalized)
  return normalized
}

/* -------------------------------------------------------------------------- */
/* Bot rivals                                                                 */
/* -------------------------------------------------------------------------- */

export function getRival(tenantId, groupId, jid) {
  if (!groupId || !jid) return null

  return db.prepare(`
    SELECT * FROM bot_rivals
    WHERE tenant_id=? AND group_id=? AND jid=?
  `).get(tenantId, groupId, jid)
}

export function listRivals(tenantId, groupId) {
  return db.prepare(`
    SELECT * FROM bot_rivals
    WHERE tenant_id=? AND group_id=?
    ORDER BY
      CASE status
        WHEN 'hunted' THEN 0
        WHEN 'pending' THEN 1
        WHEN 'vassal' THEN 2
        WHEN 'mercy' THEN 3
        WHEN 'protected' THEN 4
        WHEN 'defeated' THEN 5
      END,
      strikes DESC, last_seen DESC
  `).all(tenantId, groupId)
}

export function listVassals(tenantId, groupId) {
  return db.prepare(`
    SELECT * FROM bot_rivals
    WHERE tenant_id=? AND group_id=? AND status='vassal'
    ORDER BY surrendered_at DESC
  `).all(tenantId, groupId)
}

export function upsertRival(tenantId, groupId, jid, patch = {}) {
  if (!groupId || !jid) return null

  const timestamp = now()
  const existing = getRival(tenantId, groupId, jid)

  if (!existing) {
    db.prepare(`
      INSERT INTO bot_rivals (
        tenant_id, group_id, jid, display_name, owner_jid,
        score, strikes, detected_by, last_quote,
        first_seen, last_seen,
        surrendered_at, revoked_at, defeated_at, status
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      tenantId, groupId, jid,
      patch.displayName ?? null,
      patch.ownerJid ?? resolveBotOwner(tenantId, groupId, jid),
      patch.score ?? 0,
      patch.strikes ?? 0,
      patch.detectedBy ?? null,
      patch.lastQuote ?? null,
      existing?.first_seen ?? timestamp,
      timestamp,
      patch.surrenderedAt ?? null,
      patch.revokedAt ?? null,
      patch.defeatedAt ?? null,
      patch.status ?? 'hunted'
    )
  } else {
    db.prepare(`
      UPDATE bot_rivals
      SET display_name = COALESCE(?, display_name),
          owner_jid = COALESCE(?, owner_jid),
          score = COALESCE(?, score),
          strikes = COALESCE(?, strikes),
          detected_by = COALESCE(?, detected_by),
          last_quote = COALESCE(?, last_quote),
          last_seen = ?,
          surrendered_at = COALESCE(?, surrendered_at),
          revoked_at = COALESCE(?, revoked_at),
          defeated_at = COALESCE(?, defeated_at),
          status = COALESCE(?, status)
      WHERE tenant_id=? AND group_id=? AND jid=?
    `).run(
      patch.displayName ?? null,
      patch.ownerJid ?? null,
      patch.score ?? null,
      patch.strikes ?? null,
      patch.detectedBy ?? null,
      patch.lastQuote ?? null,
      timestamp,
      patch.surrenderedAt ?? null,
      patch.revokedAt ?? null,
      patch.defeatedAt ?? null,
      patch.status ?? null,
      tenantId, groupId, jid
    )
  }

  return getRival(tenantId, groupId, jid)
}

export function removeRival(tenantId, groupId, jid) {
  db.prepare(`
    DELETE FROM bot_rivals
    WHERE tenant_id=? AND group_id=? AND jid=?
  `).run(tenantId, groupId, jid)
}

/* -------------------------------------------------------------------------- */
/* Command assets                                                             */
/* -------------------------------------------------------------------------- */

export function getCommandAsset(tenantId, commandName) {
  if (!commandName) return null

  return db.prepare(`
    SELECT * FROM command_assets
    WHERE tenant_id=? AND command_name=? AND active=1
  `).get(tenantId, String(commandName).toLowerCase())
}

export function setCommandAsset(tenantId, commandName, url, type = 'upload') {
  const name = String(commandName).toLowerCase()
  const timestamp = now()

  const existing = db.prepare(`
    SELECT id FROM command_assets
    WHERE tenant_id=? AND command_name=?
  `).get(tenantId, name)

  if (existing) {
    db.prepare(`
      UPDATE command_assets
      SET url=?, type=?, active=1, updated_at=?
      WHERE tenant_id=? AND command_name=?
    `).run(url, type, timestamp, tenantId, name)

    return getCommandAsset(tenantId, name)
  }

  const id = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  db.prepare(`
    INSERT INTO command_assets (
      id, tenant_id, command_name, url, type, active, created_at, updated_at
    ) VALUES (?,?,?,?,?,1,?,?)
  `).run(id, tenantId, name, url, type, timestamp, timestamp)

  return getCommandAsset(tenantId, name)
}

export function clearCommandAsset(tenantId, commandName) {
  db.prepare(`
    DELETE FROM command_assets
    WHERE tenant_id=? AND command_name=?
  `).run(tenantId, String(commandName).toLowerCase())
}

export function listCommandAssets(tenantId) {
  return db.prepare(`
    SELECT * FROM command_assets
    WHERE tenant_id=? AND active=1
    ORDER BY command_name
  `).all(tenantId)
}

/* -------------------------------------------------------------------------- */
/* Anonymous queue                                                            */
/* -------------------------------------------------------------------------- */

export function queueAnonymous(tenantId, groupId, senderJid, kind, content, targetJid = null) {
  db.prepare(`
    INSERT INTO anonymous_queue (
      tenant_id, group_id, sender_jid, target_jid, kind, content, created_at, delivered
    )
    VALUES (?,?,?,?,?,?,?,0)
  `).run(tenantId, groupId, senderJid, targetJid, kind, content, now())
}

export function popAnonymous(tenantId, groupId) {
  const row = db.prepare(`
    SELECT * FROM anonymous_queue
    WHERE tenant_id=? AND group_id=? AND delivered=0
    ORDER BY RANDOM() LIMIT 1
  `).get(tenantId, groupId)

  if (row) {
    db.prepare(`UPDATE anonymous_queue SET delivered=1 WHERE tenant_id=? AND id=?`).run(tenantId, row.id)
  }

  return row
}

export function anonymousCount(tenantId, groupId) {
  return db.prepare(`
    SELECT COUNT(*) AS c FROM anonymous_queue
    WHERE tenant_id=? AND group_id=? AND delivered=0
  `).get(tenantId, groupId).c
}

/* -------------------------------------------------------------------------- */
/* Per-game stats                                                             */
/* -------------------------------------------------------------------------- */

export function recordGameResult(tenantId, groupId, jid, game, outcome, coins = 0) {
  const existing = db.prepare(`
    SELECT * FROM game_stats
    WHERE tenant_id=? AND group_id=? AND jid=? AND game=?
  `).get(tenantId, groupId, jid, game)

  if (!existing) {
    db.prepare(`
      INSERT INTO game_stats (
        tenant_id, group_id, jid, game, played, won, lost, drawn, biggest_win, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
    `).run(
      tenantId, groupId, jid, game, 1,
      outcome === 'win' ? 1 : 0,
      outcome === 'loss' ? 1 : 0,
      outcome === 'draw' ? 1 : 0,
      Math.max(0, coins),
      now()
    )
    return
  }

  db.prepare(`
    UPDATE game_stats
    SET played = played + 1,
        won = won + ?,
        lost = lost + ?,
        drawn = drawn + ?,
        biggest_win = MAX(biggest_win, ?),
        updated_at = ?
    WHERE tenant_id=? AND group_id=? AND jid=? AND game=?
  `).run(
    outcome === 'win' ? 1 : 0,
    outcome === 'loss' ? 1 : 0,
    outcome === 'draw' ? 1 : 0,
    Math.max(0, coins),
    now(),
    tenantId, groupId, jid, game
  )
}

export function gameStats(tenantId, groupId, jid) {
  return db.prepare(`
    SELECT * FROM game_stats
    WHERE tenant_id=? AND group_id=? AND jid=?
    ORDER BY played DESC
  `).all(tenantId, groupId, jid)
}

/* -------------------------------------------------------------------------- */
/* VICE — characters                                                          */
/* -------------------------------------------------------------------------- */

export function getViceCharacter(tenantId, groupId, jid) {
  if (!groupId || !jid) return null

  return db.prepare(`
    SELECT * FROM vice_characters
    WHERE tenant_id=? AND group_id=? AND jid=?
  `).get(tenantId, groupId, jid)
}

export function createViceCharacter(tenantId, groupId, jid) {
  const timestamp = now()

  db.prepare(`
    INSERT INTO vice_characters (
      tenant_id, group_id, jid, created_at, updated_at
    ) VALUES (?,?,?,?,?)
    ON CONFLICT(tenant_id, group_id, jid) DO NOTHING
  `).run(tenantId, groupId, jid, timestamp, timestamp)

  return getViceCharacter(tenantId, groupId, jid)
}

export function updateViceCharacter(tenantId, groupId, jid, patch = {}) {
  const allowed = [
    'hp', 'max_hp', 'energy', 'max_energy', 'nerve', 'max_nerve',
    'strength', 'agility', 'tech', 'cool',
    'level', 'xp', 'career',
    'credits', 'bank', 'aura',
    'kills', 'deaths', 'robberies', 'busted',
    'hospital_until', 'jail_until',
    'last_energy_tick', 'last_nerve_tick',
    'cooldowns_json', 'pvp_enabled'
  ]

  const fields = []
  const values = []

  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.includes(key)) continue
    fields.push(`${key}=?`)
    values.push(value)
  }

  if (!fields.length) return getViceCharacter(tenantId, groupId, jid)

  fields.push('updated_at=?')
  values.push(now())
  values.push(tenantId, groupId, jid)

  db.prepare(`
    UPDATE vice_characters
    SET ${fields.join(', ')}
    WHERE tenant_id=? AND group_id=? AND jid=?
  `).run(...values)

  return getViceCharacter(tenantId, groupId, jid)
}

export function listViceCharacters(tenantId, groupId, limit = 100) {
  return db.prepare(`
    SELECT * FROM vice_characters
    WHERE tenant_id=? AND group_id=?
    ORDER BY credits DESC LIMIT ?
  `).all(tenantId, groupId, Math.max(1, Math.min(500, limit)))
}

/* -------------------------------------------------------------------------- */
/* VICE — territories                                                         */
/* -------------------------------------------------------------------------- */

export function listViceTerritories() {
  return db.prepare(`SELECT * FROM vice_territories ORDER BY id`).all()
}

export function getViceTerritory(id) {
  return db.prepare(`SELECT * FROM vice_territories WHERE id=?`).get(id)
}

/* -------------------------------------------------------------------------- */
/* VICE — factions                                                            */
/* -------------------------------------------------------------------------- */

export function createViceFaction(tenantId, groupId, name, leaderJid) {
  const id = `fac_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const timestamp = now()

  db.prepare(`
    INSERT INTO vice_factions (
      id, tenant_id, group_id, name, leader_jid, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?)
  `).run(id, tenantId, groupId, name, leaderJid, timestamp, timestamp)

  db.prepare(`
    INSERT INTO vice_faction_members (
      tenant_id, faction_id, jid, role, joined_at
    ) VALUES (?,?,?,?,?)
  `).run(tenantId, id, leaderJid, 'leader', timestamp)

  return getViceFaction(tenantId, id)
}

export function getViceFaction(tenantId, id) {
  if (!id) return null

  return db.prepare(`
    SELECT * FROM vice_factions
    WHERE tenant_id=? AND id=?
  `).get(tenantId, id)
}

export function getViceFactionByName(tenantId, groupId, name) {
  return db.prepare(`
    SELECT * FROM vice_factions
    WHERE tenant_id=? AND group_id=? AND lower(name)=lower(?)
  `).get(tenantId, groupId, String(name))
}

export function listViceFactions(tenantId, groupId) {
  return db.prepare(`
    SELECT * FROM vice_factions
    WHERE tenant_id=? AND group_id=?
    ORDER BY reputation DESC, level DESC
  `).all(tenantId, groupId)
}

export function getViceFactionMembers(tenantId, factionId) {
  return db.prepare(`
    SELECT * FROM vice_faction_members
    WHERE tenant_id=? AND faction_id=?
    ORDER BY
      CASE role
        WHEN 'leader' THEN 0
        WHEN 'officer' THEN 1
        ELSE 2
      END,
      joined_at ASC
  `).all(tenantId, factionId)
}

/*
 * NOTE: argument order is (tenantId, jid, groupId) —
 * jid comes first because this is a lookup by user, not by group.
 */
export function getViceFactionForMember(tenantId, jid, groupId) {
  return db.prepare(`
    SELECT f.* FROM vice_factions f
    INNER JOIN vice_faction_members m
      ON m.faction_id = f.id AND m.tenant_id = f.tenant_id
    WHERE f.tenant_id=? AND m.jid=? AND f.group_id=?
  `).get(tenantId, jid, groupId)
}

/* -------------------------------------------------------------------------- */
/* VICE — wars                                                                */
/* -------------------------------------------------------------------------- */

export function createViceWar(tenantId, {
  groupId,
  attackerFactionId,
  defenderFactionId,
  territoryId = null,
  durationHours = 48
}) {
  const id = `war_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const startedAt = now()
  const endsAt = new Date(Date.now() + durationHours * 3600000).toISOString()

  db.prepare(`
    INSERT INTO vice_wars (
      id, tenant_id, group_id,
      attacker_faction_id, defender_faction_id,
      territory_id, status, started_at, ends_at
    ) VALUES (?,?,?,?,?,?,?,?,?)
  `).run(
    id, tenantId, groupId,
    attackerFactionId, defenderFactionId,
    territoryId, 'active', startedAt, endsAt
  )

  return getViceWar(tenantId, id)
}

export function getViceWar(tenantId, id) {
  if (!id) return null
  return db.prepare(`SELECT * FROM vice_wars WHERE tenant_id=? AND id=?`).get(tenantId, id)
}

export function getActiveWarForFaction(tenantId, groupId, factionId) {
  return db.prepare(`
    SELECT * FROM vice_wars
    WHERE tenant_id=? AND group_id=? AND status='active'
      AND (attacker_faction_id=? OR defender_faction_id=?)
    LIMIT 1
  `).get(tenantId, groupId, factionId, factionId)
}

export function listActiveWars(tenantId, groupId) {
  return db.prepare(`
    SELECT * FROM vice_wars
    WHERE tenant_id=? AND group_id=? AND status='active'
    ORDER BY started_at DESC
  `).all(tenantId, groupId)
}

export function updateViceWar(tenantId, id, patch = {}) {
  const allowed = [
    'attacker_score', 'defender_score',
    'status', 'resolved_at', 'winner_faction_id'
  ]
  const fields = []
  const values = []

  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.includes(key)) continue
    fields.push(`${key}=?`)
    values.push(value)
  }

  if (!fields.length) return getViceWar(tenantId, id)

  values.push(tenantId, id)

  db.prepare(`
    UPDATE vice_wars SET ${fields.join(', ')}
    WHERE tenant_id=? AND id=?
  `).run(...values)

  return getViceWar(tenantId, id)
}

export function addWarContribution(tenantId, {
  warId,
  jid,
  factionId,
  side,
  damage
}) {
  const existing = db.prepare(`
    SELECT * FROM vice_war_participants
    WHERE tenant_id=? AND war_id=? AND jid=?
  `).get(tenantId, warId, jid)

  const timestamp = now()

  if (existing) {
    db.prepare(`
      UPDATE vice_war_participants
      SET damage=damage+?, attacks=attacks+1, updated_at=?
      WHERE tenant_id=? AND war_id=? AND jid=?
    `).run(damage, timestamp, tenantId, warId, jid)
  } else {
    db.prepare(`
      INSERT INTO vice_war_participants (
        tenant_id, war_id, jid, faction_id, side, damage, attacks, updated_at
      ) VALUES (?,?,?,?,?,?,?,?)
    `).run(tenantId, warId, jid, factionId, side, damage, 1, timestamp)
  }
}

export function listWarParticipants(tenantId, warId) {
  return db.prepare(`
    SELECT * FROM vice_war_participants
    WHERE tenant_id=? AND war_id=?
    ORDER BY damage DESC
  `).all(tenantId, warId)
}

/* -------------------------------------------------------------------------- */
/* VICE — territory ownership                                                 */
/* -------------------------------------------------------------------------- */

export function updateTerritoryOwner(territoryId, factionId) {
  db.prepare(`
    UPDATE vice_territories
    SET current_owner_faction_id=?, updated_at=?
    WHERE id=?
  `).run(factionId, now(), territoryId)

  return getViceTerritory(territoryId)
}

/* -------------------------------------------------------------------------- */
/* VICE — seasons                                                             */
/* -------------------------------------------------------------------------- */

export function createViceSeason(tenantId, groupId, seasonNumber, durationDays = 14) {
  const id = `season_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const startedAt = now()
  const endsAt = new Date(Date.now() + durationDays * 86400000).toISOString()

  db.prepare(`
    INSERT INTO vice_seasons (
      id, tenant_id, group_id, season_number, started_at, ends_at, ended
    ) VALUES (?,?,?,?,?,?,0)
  `).run(id, tenantId, groupId, seasonNumber, startedAt, endsAt)

  return getViceSeason(tenantId, id)
}

export function getViceSeason(tenantId, id) {
  return db.prepare(`SELECT * FROM vice_seasons WHERE tenant_id=? AND id=?`).get(tenantId, id)
}

export function getActiveViceSeason(tenantId, groupId) {
  return db.prepare(`
    SELECT * FROM vice_seasons
    WHERE tenant_id=? AND group_id=? AND ended=0
    ORDER BY season_number DESC LIMIT 1
  `).get(tenantId, groupId)
}

/* -------------------------------------------------------------------------- */
/* Tenants (global)                                                           */
/* -------------------------------------------------------------------------- */

export function getTenant(id) {
  if (!id) return null
  return db.prepare(`SELECT * FROM tenants WHERE id=?`).get(id)
}

export function getTenantByOwner(jid) {
  if (!jid) return null
  return db.prepare(`SELECT * FROM tenants WHERE owner_jid=?`).get(jid)
}

export function listTenants() {
  return db.prepare(`SELECT * FROM tenants ORDER BY created_at DESC`).all()
}

export function createTenant({ id, ownerJid, displayName, authFolder, notes }) {
  const timestamp = now()

  db.prepare(`
    INSERT INTO tenants (
      id, owner_jid, display_name, auth_folder,
      status, notes, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?)
  `).run(
    id, ownerJid,
    displayName ?? null,
    authFolder, 'pending',
    notes ?? null,
    timestamp, timestamp
  )

  return getTenant(id)
}

export function approveTenant(id, reviewerJid) {
  const timestamp = now()

  db.prepare(`
    UPDATE tenants
    SET status='approved', approved_at=?, updated_at=?
    WHERE id=?
  `).run(timestamp, timestamp, id)

  return getTenant(id)
}

export function denyTenant(id) {
  db.prepare(`
    UPDATE tenants SET status='denied', updated_at=?
    WHERE id=?
  `).run(now(), id)

  return getTenant(id)
}

export function markTenantConnected(id) {
  const timestamp = now()

  db.prepare(`
    UPDATE tenants
    SET status='connected',
        connected_at=?,
        disconnected_at=NULL,
        last_seen=?,
        updated_at=?
    WHERE id=?
  `).run(timestamp, timestamp, timestamp, id)

  return getTenant(id)
}

export function setTenantOwner(tenantId, ownerJid) {
  if (!tenantId || !ownerJid) return null

  db.prepare(`
    UPDATE tenants
    SET owner_jid = ?, updated_at = ?
    WHERE id = ?
  `).run(ownerJid, now(), tenantId)

  return getTenant(tenantId)
}

export function markTenantDisconnected(id) {
  const timestamp = now()

  db.prepare(`
    UPDATE tenants
    SET status='disconnected',
        disconnected_at=?,
        last_seen=?,
        updated_at=?
    WHERE id=?
  `).run(timestamp, timestamp, timestamp, id)

  return getTenant(id)
}

export function updateTenantLastSeen(id) {
  db.prepare(`
    UPDATE tenants SET last_seen=?, updated_at=?
    WHERE id=?
  `).run(now(), now(), id)
}

export function deleteTenant(id) {
  db.prepare(`DELETE FROM tenants WHERE id=?`).run(id)
}

/* -------------------------------------------------------------------------- */
/* Pair requests (global)                                                     */
/* -------------------------------------------------------------------------- */

export function createPairRequest({ jid, displayName, notes }) {
  const id = `pair_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const code = generatePairCode()
  const timestamp = now()

  db.prepare(`
    INSERT INTO pair_requests (
      id, code, jid, display_name, status, requested_at, notes
    ) VALUES (?,?,?,?,?,?,?)
  `).run(id, code, jid, displayName ?? null, 'pending', timestamp, notes ?? null)

  return getPairRequestByCode(code)
}

export function getPairRequestByCode(code) {
  return db.prepare(`SELECT * FROM pair_requests WHERE code=?`).get(String(code).toUpperCase())
}

export function getPairRequestByJid(jid) {
  return db.prepare(`
    SELECT * FROM pair_requests
    WHERE jid=?
    ORDER BY requested_at DESC LIMIT 1
  `).get(jid)
}

export function listPairRequests(status = 'pending') {
  return db.prepare(`
    SELECT * FROM pair_requests
    WHERE status=?
    ORDER BY requested_at DESC
  `).all(status)
}

export function approvePairRequest(code, reviewerJid) {
  const request = getPairRequestByCode(code)
  if (!request) return null

  const timestamp = now()

  db.prepare(`
    UPDATE pair_requests
    SET status='approved', reviewed_at=?, reviewed_by=?
    WHERE code=?
  `).run(timestamp, reviewerJid, request.code)

  return getPairRequestByCode(code)
}

export function denyPairRequest(code, reviewerJid) {
  const request = getPairRequestByCode(code)
  if (!request) return null

  const timestamp = now()

  db.prepare(`
    UPDATE pair_requests
    SET status='denied', reviewed_at=?, reviewed_by=?
    WHERE code=?
  `).run(timestamp, reviewerJid, request.code)

  return getPairRequestByCode(code)
}

function generatePairCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''

  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  const existing = getPairRequestByCode(code)
  if (existing) return generatePairCode()

  return code
}

/* -------------------------------------------------------------------------- */
/* Tenant users (global)                                                      */
/* -------------------------------------------------------------------------- */

export function addTenantUser(tenantId, jid, role = 'member') {
  db.prepare(`
    INSERT INTO tenant_users (tenant_id, jid, role, joined_at)
    VALUES (?,?,?,?)
    ON CONFLICT(tenant_id, jid) DO NOTHING
  `).run(tenantId, jid, role, now())
}

export function getTenantUsers(tenantId) {
  return db.prepare(`
    SELECT * FROM tenant_users
    WHERE tenant_id=?
    ORDER BY joined_at ASC
  `).all(tenantId)
}

export function getTenantUserRole(tenantId, jid) {
  const row = db.prepare(`
    SELECT role FROM tenant_users
    WHERE tenant_id=? AND jid=?
  `).get(tenantId, jid)

  return row?.role || null
}

export function removeTenantUser(tenantId, jid) {
  db.prepare(`
    DELETE FROM tenant_users
    WHERE tenant_id=? AND jid=?
  `).run(tenantId, jid)
}

/* -------------------------------------------------------------------------- */
/* Bot bans                                                                   */
/* -------------------------------------------------------------------------- */

export function isBanned(jid) {
  if (!jid) return null

  const row = db.prepare(`
    SELECT * FROM bot_bans WHERE jid = ?
  `).get(String(jid))

  if (!row) return null

  if (row.permanent === 1) return row

  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare(`DELETE FROM bot_bans WHERE jid = ?`).run(String(jid))
    return null
  }

  return row
}

export function banUser(jid, { reason = null, durationMs = null, bannedBy = null } = {}) {
  if (!jid) return null

  const timestamp = now()

  const expiresAt = durationMs
    ? new Date(Date.now() + durationMs).toISOString()
    : null

  db.prepare(`
    INSERT INTO bot_bans (
      jid, reason, banned_at, banned_by, expires_at, permanent
    )
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(jid) DO UPDATE SET
      reason=excluded.reason,
      banned_at=excluded.banned_at,
      banned_by=excluded.banned_by,
      expires_at=excluded.expires_at,
      permanent=excluded.permanent
  `).run(
    String(jid),
    reason || null,
    timestamp,
    bannedBy || null,
    expiresAt,
    durationMs ? 0 : 1
  )

  return isBanned(jid)
}

export function unbanUser(jid) {
  if (!jid) return false
  const r = db.prepare(`DELETE FROM bot_bans WHERE jid = ?`).run(String(jid))
  return r.changes > 0
}

export function listBans() {
  /* Purge expired first */
  db.prepare(`
    DELETE FROM bot_bans
    WHERE permanent = 0
      AND expires_at IS NOT NULL
      AND expires_at < ?
  `).run(now())

  return db.prepare(`
    SELECT * FROM bot_bans
    ORDER BY banned_at DESC
  `).all()
}

/* -------------------------------------------------------------------------- */
/* Tenant activity                                                            */
/* -------------------------------------------------------------------------- */

const TENANT_ACTIVITY_CAP = 1000

export function logTenantActivity(tenantId, groupId, actorJid, command, messageBody = null) {
  if (!tenantId || !command) return

  const timestamp = now()

  db.prepare(`
    INSERT INTO tenant_activity (
      tenant_id, group_id, actor_jid, command, message_body, created_at
    ) VALUES (?,?,?,?,?,?)
  `).run(
    tenantId,
    groupId || null,
    actorJid || null,
    String(command).slice(0, 40),
    messageBody ? String(messageBody).slice(0, 500) : null,
    timestamp
  )

  /*
   * Bump the lifetime command counter on the tenant row.
   */
  try {
    db.prepare(`
      UPDATE tenants
      SET total_commands = total_commands + 1,
          updated_at = ?
      WHERE id = ?
    `).run(timestamp, tenantId)
  } catch {}

  /*
   * Trim: keep only the newest TENANT_ACTIVITY_CAP rows
   * for this tenant. Cheap because of the index.
   */
  try {
    db.prepare(`
      DELETE FROM tenant_activity
      WHERE tenant_id = ?
        AND id NOT IN (
          SELECT id FROM tenant_activity
          WHERE tenant_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        )
    `).run(tenantId, tenantId, TENANT_ACTIVITY_CAP)
  } catch {}
}

export function listTenantActivity(tenantId, limit = 50) {
  if (!tenantId) return []

  const safe = Math.max(1, Math.min(500, Number(limit) || 50))

  return db.prepare(`
    SELECT * FROM tenant_activity
    WHERE tenant_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(tenantId, safe)
}

export function getTenantCommandStats(tenantId, limit = 10) {
  if (!tenantId) return []

  const safe = Math.max(1, Math.min(50, Number(limit) || 10))

  return db.prepare(`
    SELECT command, COUNT(*) AS count
    FROM tenant_activity
    WHERE tenant_id = ?
    GROUP BY command
    ORDER BY count DESC
    LIMIT ?
  `).all(tenantId, safe)
}

/* -------------------------------------------------------------------------- */
/* Tenant connection events                                                   */
/* -------------------------------------------------------------------------- */

const CONNECTION_EVENTS_CAP = 500

export function logConnectionEvent(tenantId, event, details = null) {
  if (!tenantId || !event) return

  const timestamp = now()

  db.prepare(`
    INSERT INTO tenant_connection_events (
      tenant_id, event, details, created_at
    ) VALUES (?,?,?,?)
  `).run(
    tenantId,
    String(event).slice(0, 40),
    details ? String(details).slice(0, 500) : null,
    timestamp
  )

  try {
    db.prepare(`
      DELETE FROM tenant_connection_events
      WHERE tenant_id = ?
        AND id NOT IN (
          SELECT id FROM tenant_connection_events
          WHERE tenant_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        )
    `).run(tenantId, tenantId, CONNECTION_EVENTS_CAP)
  } catch {}
}

export function listConnectionEvents(tenantId, limit = 50) {
  if (!tenantId) return []

  const safe = Math.max(1, Math.min(500, Number(limit) || 50))

  return db.prepare(`
    SELECT * FROM tenant_connection_events
    WHERE tenant_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(tenantId, safe)
}

/* -------------------------------------------------------------------------- */
/* Tenant detail                                                              */
/* -------------------------------------------------------------------------- */

export function getTenantDetail(tenantId) {
  const tenant = getTenant(tenantId)
  if (!tenant) return null

  const groups = db.prepare(`
    SELECT
      group_id,
      name,
      member_count,
      admins_count,
      connection_state,
      created_at,
      updated_at
    FROM groups
    WHERE tenant_id = ?
    ORDER BY member_count DESC
  `).all(tenantId)

  const totalGroups = groups.length
  const totalMembers = groups.reduce((sum, g) => sum + (g.member_count || 0), 0)

  const activity = listTenantActivity(tenantId, 50)
  const commandStats = getTenantCommandStats(tenantId, 10)
  const connectionEvents = listConnectionEvents(tenantId, 50)

  return {
    tenant,
    groups,
    stats: {
      totalGroups,
      totalMembers,
      totalCommands: tenant.total_commands || 0,
      activityRows: activity.length
    },
    activity,
    commandStats,
    connectionEvents
  }
}

/* -------------------------------------------------------------------------- */
/* Game board tracking                                                        */
/* -------------------------------------------------------------------------- */

export function setBoardMessageId(tenantId, gameId, messageId) {
  if (!tenantId || !gameId || !messageId) return null

  db.prepare(`
    UPDATE game_sessions
    SET board_message_id = ?, updated_at = ?
    WHERE tenant_id = ? AND id = ?
  `).run(String(messageId), now(), tenantId, gameId)

  return getGame(tenantId, gameId)
}

export function getGameByBoardMessageId(tenantId, messageId) {
  if (!tenantId || !messageId) return null

  return db.prepare(`
    SELECT * FROM game_sessions
    WHERE tenant_id = ?
      AND board_message_id = ?
      AND status = 'active'
    LIMIT 1
  `).get(tenantId, String(messageId))
}

/* -------------------------------------------------------------------------- */
/* Dashboard users                                                            */
/* -------------------------------------------------------------------------- */

export function getDashboardUser(username) {
  if (!username) return null

  return db.prepare(`
    SELECT * FROM dashboard_users
    WHERE username = ?
    LIMIT 1
  `).get(String(username).trim().toLowerCase())
}

export function getDashboardUserByTenant(tenantId) {
  if (!tenantId) return null

  return db.prepare(`
    SELECT * FROM dashboard_users
    WHERE tenant_id = ?
    LIMIT 1
  `).get(tenantId)
}

export function createDashboardUser({
  tenantId,
  username,
  passwordHash
}) {
  if (!tenantId || !username || !passwordHash) return null

  const id = `du_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const timestamp = now()

  db.prepare(`
    INSERT INTO dashboard_users (
      id, tenant_id, username, password_hash,
      created_at, password_changed_at
    ) VALUES (?,?,?,?,?,?)
  `).run(
    id,
    tenantId,
    String(username).trim().toLowerCase(),
    passwordHash,
    timestamp,
    timestamp
  )

  return getDashboardUser(username)
}

export function updateDashboardPassword(username, passwordHash) {
  if (!username || !passwordHash) return null

  const timestamp = now()

  db.prepare(`
    UPDATE dashboard_users
    SET password_hash = ?,
        password_changed_at = ?
    WHERE username = ?
  `).run(passwordHash, timestamp, String(username).trim().toLowerCase())

  return getDashboardUser(username)
}

export function touchDashboardLogin(username) {
  if (!username) return

  db.prepare(`
    UPDATE dashboard_users
    SET last_login = ?
    WHERE username = ?
  `).run(now(), String(username).trim().toLowerCase())
}

export function deleteDashboardUser(tenantId) {
  if (!tenantId) return

  db.prepare(`
    DELETE FROM dashboard_users
    WHERE tenant_id = ?
  `).run(tenantId)
}

/* -------------------------------------------------------------------------- */
/* Default export                                                             */
/* -------------------------------------------------------------------------- */

export default db