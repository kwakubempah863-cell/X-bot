import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument } from 'pdf-lib'
import cheerio from 'cheerio-without-node-native'
import yts from 'yt-search'
import { getSong, searchSong } from 'genius-lyrics-api'
import speedTest from 'speedtest-net'
import { getSystemStats } from './utils/stats.mjs'

import {
  searchMovie,
  buildResolutionMenu,
  findMovieSources,
  downloadMovie,
  setPendingMovie,
  getPendingMovie,
  clearPendingMovie,
  justWatchOffers,
  buildJustWatchBlock,
  movieConfig
} from './movies.mjs'

  import db, {
  getMember,
  findMemberByIdentity,
  touchMember,
  dailyClaim,
  leaderboard,
  warning,
  warningCount,
  getWarnings,
  clearWarnings,
  addAudit,
  updateGroupSettings,
  transferCoins,
  bankDeposit,
  bankWithdraw,
  richlist,
  getMemberHumanName,
  listMembers,
  getBotMode,
  setBotMode,
  getRival,
  listRivals,
  listVassals,
  randomMenuAsset,
  getRandomRoast,
  upsertRival,
  removeRival,
  queueAnonymous,
  banUser,
  unbanUser,
  listBans,
  isBanned,
  getAntideleteMode,
  isAntideleteEnabled
} from './db.mjs'

  register('stab', { category: 'actions', description: 'Stab a user', usage: '.stab @user' }, async (ctx) => sendActionGif('shoot', 'stab', ctx)),
  register('slap', { category: 'actions', description: 'Slap a user', usage: '.slap @user' }, async (ctx) => sendActionGif('slap', 'slap', ctx)),
  register('kick', { category: 'actions', description: 'Kick a user', usage: '.kick @user' }, async (ctx) => sendActionGif('kick', 'kick', ctx)),
  register('bite', { category: 'actions', description: 'Bite a user', usage: '.bite @user' }, async (ctx) => sendActionGif('bite', 'bite', ctx))

import {
  awakenSequence,
  hunterStatusWindow,
  shadowSummon,
  rollSoldier,
  SHADOW_SOLDIERS,
  rankForXp,
  checkAriseCooldown,
  markArise,
  formatRemaining
} from './solo-leveling.mjs'

import {
  playGame,
  playGameVisual,
  peekAnonymous,
  revealAnonymous
} from './games.mjs'

import {
  profileCard,
  leaderboardCard,
  viceCard,
  crewCard,
  warCard
} from './graphics.mjs'

import {
  animeSearch,
  mangaSearch,
  mangaChapters,
  mangaChapterPages,
  animeQuote,
  anilistSearch,
  giphySearch,
  nekosRandom
} from './providers.mjs'

import {
  getActions,
  giffyUrl,
  GIF_FALLBACKS,
  buildGifChain
} from './actions.mjs'

import { playResolve, playConfig, downloadVideo } from './play-service.mjs'

import { downloadMediaMessage, normalizeMessageContent } from '@whiskeysockets/baileys'

import { getDevice } from '@whiskeysockets/baileys'

import { createMention } from './templates.mjs'

import { identityFromMessage } from './rbac.mjs'

import { getFavorite } from './memory.mjs'

/* ───────────────────────
   X COMMAND REGISTRY
   ─────────────────────── */

const commands = new Map()

const pendingManga = new Map()
const pendingAnime = new Map()
const groupModificationCooldowns = new Map()
const GROUP_MODIFICATION_COOLDOWN_MS = 10_000

const register = (name, meta, handler) =>
  commands.set(name, {
    name,
    ...meta,
    handler
  })

function memberMention(
  _runtime,
  _groupId,
  jid
) {}
  return createMention(jid)


async function hasGroupAdminPermission({ runtime, group, sender, message }) {
  if (!group?.group_id) return false

  const identity = identityFromMessage(message || {})
  identity.jid = sender

  return (
    runtime.isOwner(identity) ||
    await runtime.isGroupAdmin(group.group_id, sender)
  )
}

/* -------------------------------------------------------
 * VIEW-ONCE DECRYPTION HELPERS
 * ----------------------------------------------------- */
/**
 * Recursively unwraps a Baileys view-once envelope.
 *
 * WhatsApp stores view-once media in one of three wrapper shapes:
 *   - message.viewOnceMessage
 *   - message.viewOnceMessageV2
 *   - message.viewOnceMessageV2Extension
 *
 * This function drills through any combination of those wrappers and
 * returns the innermost message (typically a messageImage or messageVideo).
 *
 * @param {object} msg - The raw Baileys message object
 * @returns {object|null} The inner media message, or null if none found
 */
export function unwrapViewOnce(msg) {
  if (!msg) return null

  let current = msg

  for (const key of ['viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension']) {
    if (current?.[key]) {
      current = current[key]
    } else {
      return null
    }
  }

  // If we wrapped through multiple levels, keep unwrapping until we hit
  // the actual imageVideoMessage or video message.
  while (current?.viewOnceMessage || current?.viewOnceMessageV2 || current?.viewOnceMessageV2Extension) {
    if (current.viewOnceMessage) current = current.viewOnceMessage
    else if (current.viewOnceMessageV2) current = current.viewOnceMessageV2
    else if (current.viewOnceMessageV2Extension) current = current.viewOnceMessageV2Extension
  }

  return current
}

function participantJidKeys(value) {
  const jid = String(value || '').trim().toLowerCase()
  if (!jid) return []

  const [user, server] = jid.split('@', 2)
  const bareUser = user.split(':', 1)[0]
  return server
    ? [`${bareUser}@${server}`, bareUser]
    : [bareUser]
}

function isGroupAdminParticipant(participant, jid) {
  if (participant?.admin !== 'admin' && participant?.admin !== 'superadmin') {
    return false
  }

  const targetKeys = new Set(participantJidKeys(jid))
  const participantKeys = [
    participant.id,
    participant.jid,
    participant.lid,
    participant.phoneNumber
  ].flatMap(participantJidKeys)

  return participantKeys.some(key => targetKeys.has(key))
}

/* ───────────────────────
   X CYBER MENU SYSTEM
   ─────────────────────── */

function formatUptime(
  totalSeconds = Math.floor(process.uptime())
) {
  const seconds = Math.max(
    0,
    Number(totalSeconds) || 0
  )

  const days =
    Math.floor(seconds / 86400)

  const hours =
    Math.floor(
      (seconds % 86400) / 3600
    )

  const minutes =
    Math.floor(
      (seconds % 3600) / 60
    )

  const secs =
    seconds % 60

  if (days > 0) {
    return (
      `${days}d ` +
      `${String(hours).padStart(2, '0')}h ` +
      `${String(minutes).padStart(2, '0')}m`
    )
  }

  if (hours > 0) {
    return (
      `${hours}h ` +
      `${String(minutes).padStart(2, '0')}m ` +
      `${String(secs).padStart(2, '0')}s`
    )
  }

  if (minutes > 0) {
    return (
      `${minutes}m ` +
      `${String(secs).padStart(2, '0')}s`
    )
  }

  return `${secs}s`
}

function menuCategoryLabel(category) {
  const labels = {
    core: 'CORE / SYSTEM',
    group: 'GROUP CONTROL',
    moderation: 'MODERATION',
    profile: 'PROFILE / RANK',
    economy: 'ECONOMY',
    games: 'GAMES',
    anime: 'ANIME',
    manga: 'MANGA',
    media: 'MEDIA',
    actions: 'ACTIONS',
    ai: 'ARTIFICIAL INTELLIGENCE',
    utilities: 'UTILITIES',
    owner: 'OWNER / ADMIN',
    other: 'OTHER'
  }

  const key =
    String(category || 'other')
      .trim()
      .toLowerCase()

  return (
    labels[key] ||
    key
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .toUpperCase()
  )
}

const menuCommandOrder = {
  core: [
    'arise',
    'menu',
    'help',
    'ping',
    'status',
    'owner',
    'vice',
    'career',
    'heal',
    'bail'
  ],

  group: [
    'groupinfo',
    'members',
    'admins',
    'tagall',
    'hidetag',
    'rules',
    'stats',
    'setrules',
    'welcome',
    'goodbye'
  ],

  moderation: [
    'agent',
    'xmode',
    'vibe',
    'memory',
    'forget',
    'warn',
    'warnings',
    'clearwarn',
    'kick',
    'add',
    'approveall',
    'promote',
    'demote',
    'antilink',
    'antispam',
    'antidelete',
    'vv',
    'antiview',
    'mute',
    'unmute',
    'cards',
    'hunt',
    'auth',
    'unauth',
    'authlist',
    'botlist',
    'vassals',
    'execute',
    'mercy',
    'revoke'
  ],

  profile: [
    'system',
    'profile',
    'rank',
    'leaderboard',
    'profilecard',
    'lbcard'
  ],

  economy: [
    'balance',
    'daily',
    'weekly',
    'monthly',
    'work',
    'pay',
    'give',
    'bank',
    'deposit',
    'withdraw',
    'richlist',
    'economy',
    'vice',
    'vicehelp',
    'career',
    'grind',
    'rob',
    'smuggle',
    'hit',
    'stab',
    'shoot',
    'execute',
    'pvp',
    'shop',
    'buy',
    'sell',
    'inv',
    'equip',
    'use',
    'crew',
    'war',
    'territories',
    'season',
    'mission',
    'heal',
    'bail'
  ],

  games: [
    'games',
    'coinflip',
    'dice',
    'rps',
    'tictactoe',
    'connect4',
    'quiz',
    'wordle',
    'hangman'
  ],

  anime: [
    'anime',
    'animequote'
  ],

  manga: [
    'manga'
  ],

  media: [
    'play',
    'lyrics',
    'movie',
    'gif',
    'animal'
  ],

  ai: [
    'ai',
    'imagine',
    'ask',
    'say',
    'face',
    'avatar'
  ],

  actions: [
    'shadow',
    'gifs',
    'gifinfo',
    'giflist'
  ],

  utilities: [
    'qr'
  ],

  owner: [
    'setpublic',
    'setprivate',
    'warmode',
    'giflist',
    'cmdimg',
    'ban',
    'unban',
    'banlist'
  ],

  other: []
}

function formatMenuUsage(
  command,
  prefix
) {
  const usage =
    String(
      command.usage || ''
    ).trim()

  if (!usage) {
    return (
      `${prefix}${command.name}`
    )
  }

  const cleaned =
    usage.replace(
      /^[.!#$%^&*]+/,
      ''
    )

  return `${prefix}${cleaned}`
}

function formatMenuCommand(command, prefix) {
  const adminBadge = command.admin ? ' 🔐' : ''
  const ownerBadge = command.owner ? ' 👑' : ''

  return `┃ ${prefix}${command.name}${adminBadge}${ownerBadge}`
}

function sortMenuCommands(
  commandsInCategory,
  category
) {
  const preferred =
    menuCommandOrder[
      category
    ] || []

  const priority =
    new Map(
      preferred.map(
        (name, index) => [
          name,
          index
        ]
      )
    )

  return [
    ...commandsInCategory
  ].sort(
    (a, b) => {
      const aName =
        String(a.name)

      const bName =
        String(b.name)

      const aPriority =
        priority.has(aName)
          ? priority.get(aName)
          : Number.MAX_SAFE_INTEGER

      const bPriority =
        priority.has(bName)
          ? priority.get(bName)
          : Number.MAX_SAFE_INTEGER

      if (
        aPriority !==
        bPriority
      ) {
        return (
          aPriority -
          bPriority
        )
      }

      return aName.localeCompare(
        bName
      )
    }
  )
}

function buildMenuCategory(category, categoryCommands, prefix) {
  const sorted = sortMenuCommands(categoryCommands, category)

  if (!sorted.length) return ''

  const label = menuCategoryLabel(category)

  const lines = [`╭─〔 ◈ ${label} 〕`]

  for (const command of sorted) {
    lines.push(formatMenuCommand(command, prefix))
  }

  lines.push(`╰────────────────────`)

  return lines.join('\n')
}

async function menuText() {
  const stats = await getSystemStats()
  const quotes = [
    "I don't sleep. I feast.",
    'Your commands are my laws.',
    'Every signal leaves a scar.',
    'In the velvet dark, I see everything.',
    'The system bends; I do not.'
  ]
  const quote = quotes[Math.floor(Math.random() * quotes.length)]

  return [
    '╬════════════════════════════╬',
    '   🥀 V E L V E T   D E V I L 🥀',
    '╬════════════════════════════╬',
    '',
    `_${quote}_`,
    '',
    '╬ DEVIL\'S CONTRACT — BLOOD LEVELS ╬',
    `│ ▸ CPU:    ${stats.cpuLoadPercent.toFixed(1)}%  🩸`,
    `│ ▸ Memory: ${stats.ramUsedMb.toFixed(0)} MB / ${stats.ramTotalGb.toFixed(2)} GB  🩸`,
    `│ ▸ Uptime: ${stats.botUptime}  🦇`,
    `│ ▸ Ping:   ${stats.botPing}  🌹`,
    '',
    '» Type .cmds to view the Velvet Arsenal. «  🍷'
  ].join('\n')
}

/* ───────────────────────
   CORE COMMANDS
   ─────────────────────── */

register(
  'menu',
  {
    category: 'core',
    description: 'Show the Velvet Devil control panel'
  },
  async ({ runtime, group, sender }) => {
    let caption
    try {
      caption = await menuText()
    } catch (error) {
      console.error('[X MENU] System stats failed:', error)
      return '❌ Unable to load system health right now.'
    }

    const jid = group?.group_id || sender
    if (!jid || !runtime?.safeSendMessage) {
      return caption
    }

    let menuAsset
    try {
      menuAsset = randomMenuAsset(runtime.tenantId || 'default')
    } catch (error) {
      console.error('[X MENU] Menu asset lookup failed:', error)
    }

    if (!menuAsset?.url) {
      await runtime.safeSendMessage(
        jid,
        { text: caption },
        { label: 'menu text' }
      )
      return null
    }

    try {
      await runtime.safeSendMessage(
        jid,
        {
          image: { url: menuAsset.url },
          caption
        },
        { label: 'menu image' }
      )
      return null
    } catch (error) {
      console.error('[X MENU] Image delivery failed:', error)
      return caption
    }
  }
)

register(
  'cmds',
  {
    category: 'core',
    description: 'List available commands by category',
    usage: '.cmds [category|command]'
  },
  async ({ args }) => {
    const prefix = String(process.env.X_DEFAULT_PREFIX || '.').trim() || '.'
    const query = String(args?.[0] || '')
      .trim()
      .replace(/^\./, '')
      .toLowerCase()
    const grouped = new Map()

    for (const command of commands.values()) {
      if (!command?.name) continue
      const category = String(command.category || 'other').trim().toLowerCase()
      const categoryCommands = grouped.get(category)
      if (categoryCommands) {
        categoryCommands.push(command)
      } else {
        grouped.set(category, [command])
      }
    }

    const categoryOrder = [
      'core',
      'media',
      'games',
      'ai',
      'anime',
      'manga',
      'group',
      'moderation',
      'profile',
      'economy',
      'actions',
      'utilities',
      'owner',
      'other'
    ]
    const categories = [
      ...categoryOrder.filter((category) => grouped.has(category)),
      ...[...grouped.keys()]
        .filter((category) => !categoryOrder.includes(category))
        .sort((a, b) => a.localeCompare(b))
    ]
    const categoryStyles = {
      core: ['⚙️', 'Core'],
      group: ['👥', 'Group'],
      moderation: ['🛡️', 'Moderation'],
      profile: ['👤', 'Profile'],
      economy: ['💰', 'Economy'],
      games: ['🎮', 'Games'],
      anime: ['🌸', 'Anime'],
      manga: ['📚', 'Manga'],
      media: ['🎵', 'Media'],
      actions: ['⚡', 'Actions'],
      ai: ['🤖', 'AI'],
      utilities: ['🧰', 'Utilities'],
      owner: ['👑', 'Owner'],
      other: ['📦', 'Other']
    }

    const styleFor = (category) =>
      categoryStyles[category] || [
        '📦',
        category
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (letter) => letter.toUpperCase())
      ]
    const header = (title) => [
      '╬════════════════════════════════════╬',
      `   🩸 ${title} 🩸`,
      '╬════════════════════════════════════╬',
      ''
    ]

    if (!query) {
      if (!categories.length) return 'No command categories are registered.'

      const lines = [
        ...header('VELVET ARSENAL'),
        '╭───「 CATEGORIES 」───',
        ...categories.map((category) => {
          const [icon, label] = styleFor(category)
          return `│ ${icon} ${label} » ${prefix}cmds ${category}`
        }),
        '╰────────────────────',
        '',
        `» Type ${prefix}cmds <category> to view its commands.`
      ]
      return lines.join('\n')
    }

    if (grouped.has(query)) {
      const [icon, label] = styleFor(query)
      const categoryCommands = [...grouped.get(query)].sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
      )
      const maxNameLength = Math.max(
        ...categoryCommands.map((command) => String(command.name).length)
      )
      const lines = [
        ...header(`${label.toUpperCase()} COMMANDS`),
        `╭───「 ${icon} ${label.toUpperCase()} 」───`,
        ...categoryCommands.map((command) => {
          const name = `${prefix}${command.name}`.padEnd(
            maxNameLength + prefix.length + 1
          )
          const description =
            String(command.description || 'No description available.')
              .replace(/\s+/g, ' ')
              .trim()
          return `│ ${name} » ${description}`
        }),
        '╰────────────────────'
      ]
      return lines.join('\n')
    }

    const command = commands.get(query)
    if (command) {
      const category = String(command.category || 'other').trim().toLowerCase()
      const [icon, label] = styleFor(category)
      const usage = String(command.usage || `${prefix}${command.name}`).trim()
      const description = String(
        command.description || 'No description available.'
      )
        .replace(/\s+/g, ' ')
        .trim()
      return [
        ...header('VELVET ARSENAL'),
        `╭───「 ${icon} ${label.toUpperCase()} 」───`,
        `│ Usage: ${usage}`,
        `│ ${description}`,
        '╰────────────────────'
      ].join('\n')
    }

    return `Unknown category or command: "${query}". Type ${prefix}cmds to see available categories.`
  }
)

register(
  'help',
  {
    category: 'core',
    description: 'Show command details or full list with usage',
    usage: '.help [command]'
  },
  async ({ args }) => {
    const query = String(args[0] || '').trim().toLowerCase()

    if (query) {
      const c = commands.get(query)

      if (!c) {
        return [
          `❓ *UNKNOWN COMMAND*`,
          '',
          `No command named *${query}*.`,
          '',
          'Run `.help` with no argument to see every command.'
        ].join('\n')
      }

      const prefix =
        String(process.env.X_DEFAULT_PREFIX || '.').trim() || '.'

      const usage = c.usage
        ? c.usage.replace(/^[.!#$%^&*]+/, prefix)
        : `${prefix}${c.name}`

      const flags = []
      if (c.admin) flags.push('🔐 admin only')
      if (c.owner) flags.push('👑 owner only')

      return [
        `${c.reaction || '⚡'} *${prefix}${c.name}*`,
        '',
        `📖 *What it does*`,
        `   ${c.description || 'No description.'}`,
        '',
        `▶️ *How to use*`,
        `   ${usage}`,
        flags.length ? `\n🔒 ${flags.join(' · ')}` : '',
        '',
        `Category: ${c.category || 'other'}`
      ]
        .filter(Boolean)
        .join('\n')
    }

    const prefix =
      String(process.env.X_DEFAULT_PREFIX || '.').trim() || '.'

    const all = [...commands.values()].filter((c) => c?.name)
    const grouped = new Map()

    for (const c of all) {
      const cat = String(c.category || 'other').toLowerCase()
      if (!grouped.has(cat)) grouped.set(cat, [])
      grouped.get(cat).push(c)
    }

    const categoryOrder = [
      'core',
      'group',
      'moderation',
      'profile',
      'economy',
      'games',
      'anime',
      'manga',
      'media',
      'actions',
      'ai',
      'utilities',
      'owner',
      'other'
    ]

    const ordered = [
      ...categoryOrder.filter((c) => grouped.has(c)),
      ...[...grouped.keys()]
        .filter((c) => !categoryOrder.includes(c))
        .sort()
    ]

    const blocks = []

    for (const category of ordered) {
      const list = grouped.get(category) || []
      if (!list.length) continue

      const sorted = [...list].sort((a, b) =>
        String(a.name).localeCompare(String(b.name))
      )

      const label = menuCategoryLabel(category)
      const lines = [`╭─〔 ◈ ${label} 〕`]

      for (const c of sorted) {
        const usage = c.usage
          ? c.usage.replace(/^[.!#$%^&*]+/, prefix)
          : `${prefix}${c.name}`

        const adminBadge = c.admin ? ' 🔐' : ''
        const ownerBadge = c.owner ? ' 👑' : ''

        lines.push(`┃ ${usage}${adminBadge}${ownerBadge}`)
        lines.push(`┃   ${c.description || 'No description.'}`)
      }

      lines.push(`╰────────────────────`)
      blocks.push(lines.join('\n'))
    }

    return [
      `╭━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╮`,
      `┃      📖 X COMMAND HELP        ┃`,
      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯`,
      '',
      `Use \`${prefix}help <command>\` for detailed info on one command.`,
      `Example: \`${prefix}help hug\``,
      '',
      blocks.join('\n\n'),
      '',
      `Total: ${all.length} commands`
    ].join('\n')
  }
)

register(
  'ping',
  {
    category: 'core',
    description: 'Measure real-world ping, download, and upload speeds'
  },
  async () => {
    try {
      const data = await speedTest({ maxTime: 5000, acceptLicense: true })
      const latency = Number(data?.ping?.latency)
      const download = Number(data?.download?.bandwidth)
      const upload = Number(data?.upload?.bandwidth)

      if (![latency, download, upload].every(Number.isFinite)) {
        throw new Error('Speed test returned incomplete results')
      }

      return [
        '⚡ *X SPEED TEST*',
        '',
        `📡 Ping: ${latency.toFixed(0)}ms`,
        `⬇️ Down: ${(download / 125000).toFixed(2)} Mbps`,
        `⬆️ Up: ${(upload / 125000).toFixed(2)} Mbps`
      ].join('\n')
    } catch (error) {
      console.error('[X PING] speed test failed:', error)
      return `❌ Speed test failed: ${error?.message || String(error)}`
    }
  }
)

register(
  'status',
  {
    category: 'core',
    description: 'Show runtime status'
  },
  async ({ runtime }) => {
    const s = runtime.getStatus()

    return [
      `🤖 *X STATUS*`,
      `Connection: ${s.status}`,
      `Mode: ${getBotMode().toUpperCase()}`,
      `Session: ${s.connectedJid || 'not connected'}`,
      `Groups: ${s.groupCount}`
    ].join('\n')
  }
)

/* ───────────────────────
   X MODE — Meta-AI-style behavior toggle
   ─────────────────────── */

register(
  'xmode',
  {
    category: 'moderation',
    description: '🎛️ Set X behavior mode for this group',
    usage: '.xmode <social|mention|mute>',
    admin: true
  },
  async ({ runtime, group, sender, args, message }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const identity = identityFromMessage(message || {})
    identity.jid = identity.jid || sender

    const isOwnerUser = runtime.isOwner(identity)
    const isAdminUser = await runtime.isGroupAdmin(group.group_id, sender)

    if (!isOwnerUser && !isAdminUser) {
      return 'Admin permission required.'
    }

    const mode = String(args[0] || 'status').toLowerCase()

    if (mode === 'status') {
      const settings = JSON.parse(group.settings_json || '{}')
      const current = settings.xmode || 'social'

      return [
        '🎛️ *X MODE*',
        '',
        `Current: ${current}`,
        '',
        '  ▸ social   — X talks freely, roasts, jokes',
        '  ▸ mention  — X only replies when @mentioned',
        '  ▸ mute     — X silent except for commands'
      ].join('\n')
    }

    if (!['social', 'mention', 'mute'].includes(mode)) {
      return 'Usage: `.xmode social|mention|mute`'
    }

    updateGroupSettings(group.tenant_id, group.group_id, {
      settings: { xmode: mode }
    })

    const { setMentionOnly } = await import('./vibe.mjs')
    setMentionOnly(group.tenant_id, group.group_id, mode !== 'social')

    return `🎛️ X mode set to *${mode}*.`
  }
)

/* ───────────────────────
   IMAGINE — manual image generation
   ─────────────────────── */

register(
  'imagine',
  {
    category: 'ai',
    reaction: '🎨',
    description: '🎨 Generate an image from a prompt',
    usage: '.imagine <prompt>'
  },
  async ({ runtime, group, args }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const prompt = args.join(' ').trim()

    if (!prompt) return 'Usage: `.imagine <prompt>`'

    const encoded = encodeURIComponent(prompt.slice(0, 400))
    const url =
      `https://image.pollinations.ai/prompt/${encoded}` +
      `?width=1024&height=1024&nologo=true&model=flux`

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(90000)
      })

      if (!res.ok) throw new Error(`Image gen returned ${res.status}`)

      const buffer = Buffer.from(await res.arrayBuffer())

      await runtime.sendImage(
        group.group_id,
        buffer,
        `🎨 *${prompt}*`
      )

      return null
    } catch (error) {
      return `🎨 Image generation failed: ${error.message}`
    }
  }
)

register(
  'ask',
  {
    category: 'ai',
    reaction: '🧠',
    description: '🧠 Ask a free AI anything',
    usage: '.ask <question>'
  },
  async ({ args }) => {
    const prompt = args.join(' ').trim()

    if (!prompt) return 'Usage: `.ask <question>`'

    try {
      const url =
        `https://text.pollinations.ai/${encodeURIComponent(prompt)}` +
        '?model=openai&temperature=0.7'
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30000)
      })

      if (!res.ok) throw new Error(`AI returned ${res.status}`)

      const response = (await res.text()).trim().slice(0, 1000)

      return response || '🧠 AI is busy, try again in a bit.'
    } catch {
      return '🧠 AI is busy, try again in a bit.'
    }
  }
)

register(
  'say',
  {
    category: 'ai',
    reaction: '🎙️',
    description: '🎙️ Generate text-to-speech audio',
    usage: '.say <text> [--voice nova|alloy|echo|fable|onyx|shimmer]'
  },
  async ({ runtime, group, args }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const input = args.map(String)
    const voiceIndex = input.indexOf('--voice')
    let voice = 'nova'

    if (voiceIndex !== -1) {
      const requestedVoice = input[voiceIndex + 1]
      const voices = ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer']

      if (!voices.includes(requestedVoice)) {
        return 'Usage: `.say <text> [--voice nova|alloy|echo|fable|onyx|shimmer]`'
      }

      voice = requestedVoice
      input.splice(voiceIndex, 2)
    }

    const text = input.join(' ').trim().slice(0, 300)

    if (!text) return 'Usage: `.say <text> [--voice nova|alloy|echo|fable|onyx|shimmer]`'

    try {
      const url =
        `https://text.pollinations.ai/${encodeURIComponent(text)}` +
        `?model=openai-audio&voice=${encodeURIComponent(voice)}`
      const res = await fetch(url, {
        signal: AbortSignal.timeout(60000)
      })

      if (!res.ok) throw new Error(`TTS returned ${res.status}`)

      const buffer = Buffer.from(await res.arrayBuffer())
      await runtime.sendAudio(group.group_id, buffer, {
        mimetype: 'audio/mpeg',
        ptt: false
      })

      return null
    } catch {
      return '🎙️ TTS failed, try shorter text.'
    }
  }
)

register(
  'face',
  {
    category: 'ai',
    reaction: '👤',
    description: '👤 Generate a random face (thispersondoesnotexist)',
    usage: '.face'
  },
  async ({ runtime, group }) => {
    if (!group?.group_id) return 'Use inside a group.'

    try {
      const res = await fetch(
        `https://thispersondoesnotexist.com/?t=${Date.now()}`,
        {
          headers: { 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(30000)
        }
      )

      if (!res.ok) throw new Error(`Face server returned ${res.status}`)

      const buffer = Buffer.from(await res.arrayBuffer())
      await runtime.sendImage(
        group.group_id,
        buffer,
        '👤 *This person does not exist*'
      )

      return null
    } catch {
      return '👤 Face server is asleep.'
    }
  }
)

register(
  'avatar',
  {
    category: 'ai',
    reaction: '🎭',
    description: '🎭 Generate an avatar from a name',
    usage: '.avatar <name> [bottts|avataaars|pixel-art|thumbs|fun-emoji]'
  },
  async ({ runtime, group, args }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const styles = [
      'bottts',
      'avataaars',
      'adventurer',
      'pixel-art',
      'thumbs',
      'fun-emoji'
    ]
    const lastArg = String(args[args.length - 1] || '').toLowerCase()
    const style = styles.includes(lastArg) ? lastArg : 'bottts'
    const name = args
      .slice(0, style === lastArg ? -1 : undefined)
      .join(' ')
      .trim()

    if (!name) return 'Usage: `.avatar <name> [bottts|avataaars|pixel-art|thumbs|fun-emoji]`'

    try {
      const url =
        `https://api.dicebear.com/7.x/${style}/png` +
        `?seed=${encodeURIComponent(name)}&size=512`
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30000)
      })

      if (!res.ok) throw new Error(`Avatar service returned ${res.status}`)

      const buffer = Buffer.from(await res.arrayBuffer())
      await runtime.sendImage(
        group.group_id,
        buffer,
        `🎭 *${name}* — ${style}`
      )

      return null
    } catch {
      return '🎭 Avatar failed.'
    }
  }
)

register(
  'qr',
  {
    category: 'utilities',
    reaction: '🔗',
    description: '🔗 Generate a QR code',
    usage: '.qr <text or url>'
  },
  async ({ runtime, group, args }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const text = args.join(' ').trim().slice(0, 1000)

    if (!text) return 'Usage: `.qr <text or url>`'

    try {
      const url =
        'https://api.qrserver.com/v1/create-qr-code/' +
        `?size=512x512&margin=10&data=${encodeURIComponent(text)}`
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30000)
      })

      if (!res.ok) throw new Error(`QR service returned ${res.status}`)

      const buffer = Buffer.from(await res.arrayBuffer())
      await runtime.sendImage(group.group_id, buffer, '🔗 *QR Code*')

      return null
    } catch {
      return '🔗 QR generation failed.'
    }
  }
)

register(
  'animal',
  {
    category: 'media',
    reaction: '🐾',
    description: '🐾 Random cute animal photo',
    usage: '.animal [cat|dog|fox|shibe|bird|waifu]'
  },
  async ({ runtime, group, args }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const type = String(args[0] || 'cat').toLowerCase()
    const validTypes = ['cat', 'dog', 'fox', 'shibe', 'bird', 'waifu']

    if (!validTypes.includes(type)) {
      return 'Usage: `.animal [cat|dog|fox|shibe|bird|waifu]`'
    }

    try {
      let imageUrl

      switch (type) {
        case 'cat': {
          const res = await fetch('https://cataas.com/cat?json=true', {
            signal: AbortSignal.timeout(20000)
          })
          if (!res.ok) throw new Error(`Cat service returned ${res.status}`)
          const data = await res.json()
          if (!data.url) throw new Error('Cat service returned no image URL')
          imageUrl = new URL(data.url, 'https://cataas.com').href
          break
        }
        case 'dog': {
          const res = await fetch('https://dog.ceo/api/breeds/image/random', {
            signal: AbortSignal.timeout(20000)
          })
          if (!res.ok) throw new Error(`Dog service returned ${res.status}`)
          const data = await res.json()
          imageUrl = data.message
          break
        }
        case 'fox': {
          const res = await fetch('https://randomfox.ca/floof/', {
            signal: AbortSignal.timeout(20000)
          })
          if (!res.ok) throw new Error(`Fox service returned ${res.status}`)
          const data = await res.json()
          imageUrl = data.image
          break
        }
        case 'shibe':
        case 'bird': {
          const animal = type === 'bird' ? 'birds' : 'shibes'
          const res = await fetch(
            `https://shibe.online/api/${animal}?count=1`,
            { signal: AbortSignal.timeout(20000) }
          )
          if (!res.ok) throw new Error(`Shibe service returned ${res.status}`)
          const data = await res.json()
          imageUrl = data[0]
          break
        }
        case 'waifu': {
          const res = await fetch('https://api.waifu.pics/sfw/waifu', {
            signal: AbortSignal.timeout(20000)
          })
          if (!res.ok) throw new Error(`Waifu service returned ${res.status}`)
          const data = await res.json()
          imageUrl = data.url
          break
        }
      }

      if (!imageUrl) throw new Error('Animal service returned no image URL')

      const imageRes = await fetch(imageUrl, {
        signal: AbortSignal.timeout(30000)
      })
      if (!imageRes.ok) throw new Error(`Image fetch returned ${imageRes.status}`)

      const buffer = Buffer.from(await imageRes.arrayBuffer())
      await runtime.sendImage(
        group.group_id,
        buffer,
        `🐾 *Random ${type}*`
      )

      return null
    } catch {
      return `🐾 ${type} fetch failed.`
    }
  }
)

/* ───────────────────────
   SOLO LEVELING — The System
   ─────────────────────── */

register(
  'arise',
  {
    category: 'core',
    description: '⚔️ Wake the System. Reports readiness in Monarch style.',
    usage: '.arise',
    admin: true
  },
  async ({ runtime, group, sender, message }) => {
    const cooldown = checkAriseCooldown(sender)

    if (!cooldown.allowed) {
      return [
        '╭━━〔 ◈ S Y S T E M 〕━━╮',
        '┃',
        '┃ The shadows are still waking.',
        `┃ Retry in ${formatRemaining(cooldown.remainingMs)}.`,
        '╰━━━━━━━━━━━━━━━━━━━━╯'
      ].join('\n')
    }

    markArise(sender)

    const status = runtime.getStatus()
    const uptime = formatUptime()

    const member = group?.group_id
      ? getMember(group.tenant_id, group.group_id, sender)
      : null

    const displayName = group?.group_id
      ? runtime.getMemberDisplayName(group.group_id, sender, 'Hunter')
      : 'Hunter'

    const xp = member?.xp ?? 0
    const level = member?.level ?? 1

    const window = awakenSequence({
      displayName,
      xp,
      level,
      mode: getBotMode(),
      uptime,
      groups: status.groupCount || 0
    })

    try {
      await runtime.safeSendMessage(
        group?.group_id || sender,
        { text: '⌛ *…the System is waking…*' },
        { label: 'arise: waking' }
      )

      await new Promise((r) => setTimeout(r, 700))
    } catch {}

    return window
  }
)

register(
  'system',
  {
    category: 'profile',
    description: '📊 Open your Hunter status window.',
    usage: '.system [@user]'
  },
  async ({ runtime, group, sender, mentions }) => {
    const target = mentions?.[0] || sender

    if (!group?.group_id) {
      return 'The System only runs inside a group.'
    }

    const member = getMember(group.tenant_id, group.group_id, target)

    if (!member) {
      return '╭━━〔 ◈ S Y S T E M 〕━━╮\n┃\n┃ No Hunter record found.\n╰━━━━━━━━━━━━━━━━━━━━╯'
    }

    const displayName = runtime.getMemberDisplayName(
      group.group_id,
      target,
      'Hunter'
    )

    return hunterStatusWindow({
      displayName,
      xp: member.xp ?? 0,
      level: member.level ?? 1,
      coins: member.coins ?? 0,
      bank: member.bank ?? 0,
      messages: member.messages ?? 0,
      wins: member.wins ?? 0,
      losses: member.losses ?? 0,
      streak: member.streak ?? 0
    })
  }
)

register(
  'shadow',
  {
    category: 'actions',
    description: '🩸 Summon a shadow soldier against a target.',
    usage: '.shadow @user | reply with .shadow'
  },
  async ({ runtime, group, sender, mentions, message }) => {
    if (!group?.group_id) {
      return 'The Shadow Army does not march in DMs.'
    }

    let target = mentions?.[0] || null

    if (!target) {
      const ctx =
        message?.message?.extendedTextMessage?.contextInfo ||
        message?.message?.imageMessage?.contextInfo ||
        message?.message?.videoMessage?.contextInfo ||
        null

      target = ctx?.participant || ctx?.participantAlt || null
    }

    if (!target) {
      return [
        '╭━━〔 ◈ S H A D O W 〕━━╮',
        '┃',
        '┃ Specify a target.',
        '┃',
        '┃ Usage: `.shadow @user`',
        '┃    or: reply to a message with `.shadow`',
        '╰━━━━━━━━━━━━━━━━━━━━╯',
        '',
        'Available soldiers:',
        ...SHADOW_SOLDIERS.map(
          (s) => `  ${s.emoji} ${s.name} — ${s.rank}`
        )
      ].join('\n')
    }

    if (target === sender) {
      return 'The Monarch does not summon shadows against himself.'
    }

    const summonerName = runtime.getMemberDisplayName(
      group.group_id,
      sender,
      'the Monarch'
    )

    const targetName = runtime.getMemberDisplayName(
      group.group_id,
      target,
      'the marked one'
    )

    const targetMention = createMention(target)

    const soldier = rollSoldier()

    return {
      text: shadowSummon({
        soldier,
        summonerName,
        targetMentionText: targetMention.text,
        targetName
      }),
      mentions: targetMention.jid ? [targetMention.jid] : []
    }
  }
)

register(
  'owner',
  {
    description: 'Check owner identity configuration',
    owner: true
  },
  async ({ runtime, sender, message }) => {
    const identity = identityFromMessage(message)

    identity.jid = identity.jid || sender

    return runtime.ownerSummary(identity)
  }
)

/* ───────────────────────
   GROUP CONTROL
   ─────────────────────── */

register(
  'groupinfo',
  {
    category: 'group',
    description: 'Show synchronized group information'
  },
  async ({ group }) =>
    [
      `*${group.name || 'Group'}*`,
      `📝 ${group.description || 'No description'}`,
      `👥 Members: ${group.member_count}`,
      `🛡️ Admins: ${group.admins_count}`,
      `⚙️ Prefix: ${group.prefix}`,
      `🎨 Theme: ${group.theme}`,
      `📡 Sync: ${group.connection_state}`
    ].join('\n')
)

register(
  'members',
  {
    category: 'group',
    description: 'Show synchronized members',
    usage: '.members [page]'
  },
  async ({ runtime, group, args }) =>
    runtime.formatMembers(
      group.group_id,
      Number(args[0]) || 1
    )
)

register(
  'admins',
  {
    category: 'group',
    description: 'Show group admins'
  },
  async ({ runtime, group }) =>
    runtime.formatAdmins(group.group_id)
)

register(
  'tagall',
  {
    category: 'group',
    description: 'Mention every synchronized member in this group',
    usage: '.tagall [message]',
    admin: true
  },
  async ({ runtime, group, sender, args, message }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await runtime.isGroupAdmin(group.group_id, sender))) {
      return 'Admin permission required.'
    }

    const rows = listMembers(group.tenant_id, group.group_id, 500, 0)

    if (!rows.length) {
      return 'No synchronized members found for this group.'
    }

    const note = args.join(' ').trim() || 'Attention Everyone'

    const humanName = (member) => {
      const display = String(member.display_name || '').trim()
      if (display) return display
      const username = String(member.username || '').trim()
      if (username) return username
      return null
    }

    const roleBadge = (member) => {
      if (member.role === 'superadmin') return ' 👑'
      if (member.role === 'admin') return ' 🛡️'
      return ''
    }

    const EMOJIS = [
      '⚡', '🔥', '💫', '🌀', '🎯',
      '👁️', '🛸', '🌟', '💥', '🎮',
      '🦅', '🐉', '🌊', '🌪️', '🎧',
      '🎨', '🧠', '🚀', '💎', '🔮'
    ]

    const lines = []
    const mentionJids = []
    let index = 0

    for (const member of rows) {
      const mention = createMention(member.jid)
      if (!mention.jid) continue

      index += 1
      mentionJids.push(mention.jid)

      const name = humanName(member)
      const label = name ? `${mention.text} ─ ${name}` : mention.text
      const emoji = EMOJIS[(index - 1) % EMOJIS.length]
      const number = String(index).padStart(2, '0')

      lines.push(`${emoji} ${number} ─ ${label}${roleBadge(member)}`)
    }

    if (!mentionJids.length) {
      return 'No mentionable members were found.'
    }

    const MAX_BODY_LINES = 90
    let mentionBlock

    if (lines.length <= MAX_BODY_LINES) {
      mentionBlock = lines.join('\n')
    } else {
      const head = lines.slice(0, MAX_BODY_LINES)
      const tail = lines
        .slice(MAX_BODY_LINES)
        .map((line) => line.replace(/^.+? \d+ ─ /, ''))

      mentionBlock = [
        head.join('\n'),
        '',
        '… and more:',
        tail.join(' · ')
      ].join('\n')
    }

    const total = mentionJids.length
    const groupName = group.name || 'Group'

    const body = [
      `*${note}*`,
      '',
      `📣 *${groupName}* — X mentions y'all! 👇`,
      '',
      `┌───⊷ *MENTIONS (${total})*`,
      mentionBlock,
      `└──✪ ⚡ X ┃ BOT ⚡ ✪──`,
      '\u2063'
    ].join('\n')

    return {
      text: body,
      mentions: mentionJids
    }
  }
)

register(
  'rules',
  {
    category: 'group',
    description: 'Show group rules'
  },
  async ({ group }) =>
    group.rules
      ? [`📜 *Group Rules*`, group.rules].join('\n')
      : 'No rules configured for this group.'
)

register(
  'ban',
  {
    category: 'owner',
    description: '🚫 Ban a user from using any X bot',
    usage: '.ban @user [duration] [reason]',
    owner: true
  },
  async ({ runtime, group, sender, args, mentions }) => {
    const target = mentions?.[0]

    if (!target) {
      return [
        '🚫 *BAN USER*',
        '',
        'Usage: `.ban @user [duration] [reason]`',
        '',
        'Duration examples:',
        '  `.ban @user 30m spamming`',
        '  `.ban @user 7d abuse`',
        '  `.ban @user perm harassment`',
        '',
        'Omit duration for permanent ban.'
      ].join('\n')
    }

    const rest = args.filter((x) => !x.startsWith('@'))
    const maybeDuration = rest[0] || ''
    const durationMs = parseBanDuration(maybeDuration)

    const reasonStart = durationMs !== null ? 1 : 0
    const reason = rest.slice(reasonStart).join(' ').trim() || null

    banUser(target, {
      reason,
      durationMs,
      bannedBy: sender
    })

    const name = runtime.getMemberDisplayName(
      group?.group_id || target,
      target,
      'User'
    )

    const durationLabel = durationMs === null
      ? 'permanent'
      : formatBanDuration(durationMs)

    return [
      '🚫 *USER BANNED*',
      '',
      `${name} — ${durationLabel}`,
      reason ? `Reason: ${reason}` : null,
      '',
      'They can no longer use any X bot.'
    ].filter(Boolean).join('\n')
  }
)

register(
  'unban',
  {
    category: 'owner',
    description: '✅ Lift a user ban',
    usage: '.unban @user',
    owner: true
  },
  async ({ runtime, group, sender, mentions }) => {
    const target = mentions?.[0]

    if (!target) return 'Usage: `.unban @user`'

    const ok = unbanUser(target)

    const name = runtime.getMemberDisplayName(
      group?.group_id || target,
      target,
      'User'
    )

    return ok
      ? `✅ *${name}* unbanned.`
      : `⚠️ *${name}* was not banned.`
  }
)

register(
  'banlist',
  {
    category: 'owner',
    description: '📋 List all banned users',
    usage: '.banlist',
    owner: true
  },
  async () => {
    const rows = listBans()

    if (!rows.length) return '📭 No banned users.'

    const lines = rows.map((row, i) => {
      const label = row.jid.split('@')[0]
      const when = row.permanent
        ? 'permanent'
        : row.expires_at
        ? `until ${new Date(row.expires_at).toLocaleDateString()}`
        : 'permanent'

      return `${i + 1}. *${label}* — ${when}${row.reason ? ` — ${row.reason}` : ''}`
    })

    return ['🚫 *BAN LIST*', '', ...lines].join('\n')
  }
)

function parseBanDuration(input) {
  if (!input || typeof input !== 'string') return null
  const text = input.trim().toLowerCase()
  if (text === 'perm' || text === 'permanent') return null

  const m = text.match(/^(\d+)\s*(s|m|h|d|w)$/)
  if (!m) return null

  const n = parseInt(m[1], 10)
  const unit = m[2]

  const ms = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
  }[unit]

  return n * ms
}

function formatBanDuration(ms) {
  const secs = Math.floor(ms / 1000)
  const mins = Math.floor(secs / 60)
  const hours = Math.floor(mins / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d`
  if (hours > 0) return `${hours}h`
  if (mins > 0) return `${mins}m`
  return `${secs}s`
}

register(
  'giflist',
  {
    category: 'actions',
    description: '📋 List all loaded anime action categories',
    usage: '.giflist',
    owner: true
  },
  async () => {
    let actions

    try {
      actions = await getActions()
    } catch (error) {
      return `❌ Could not load actions: ${error.message}`
    }

    if (!actions.length) {
      return '📭 No action categories loaded.'
    }

    const sorted = [...actions].sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    const totalGifs = sorted.reduce(
      (sum, a) => sum + (Number(a.count) || 0),
      0
    )

    const lines = sorted.map((action) => {
      const count = Number(action.count) || 0
      const emoji = action.emoji || '🎬'
      const padded = action.name.padEnd(14, ' ')
      return `${emoji} ${padded} ${String(count).padStart(4, ' ')} GIFs`
    })

    return [
      '📋 *X ACTION CATEGORIES*',
      '',
      `Total: ${sorted.length} categories`,
      `Total GIFs: ${totalGifs}`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━',
      ...lines,
      '━━━━━━━━━━━━━━━━━━━━━━',
      '',
      'Usage: `.hug @user` — any category name works as a command.'
    ].join('\n')
  }
)

register(
  'hidetag',
  {
    category: 'group',
    description: 'Mention everyone silently — no visible tags',
    usage: '.hidetag [message] | reply with .hidetag',
    admin: true
  },
  async ({ runtime, group, sender, args, message }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await runtime.isGroupAdmin(group.group_id, sender))) {
      return 'Admin permission required.'
    }

    const rows = listMembers(group.tenant_id, group.group_id, 1000, 0)

    if (!rows.length) {
      return 'No synchronized members found for this group.'
    }

    const mentionJids = []

    for (const member of rows) {
      if (mentionJids.length >= 256) break
      const mention = createMention(member.jid)
      if (mention.jid) mentionJids.push(mention.jid)
    }

    if (!mentionJids.length) {
      return 'No mentionable members were found.'
    }

    const ctx =
      message?.message?.extendedTextMessage?.contextInfo ||
      message?.message?.imageMessage?.contextInfo ||
      message?.message?.videoMessage?.contextInfo ||
      message?.message?.audioMessage?.contextInfo ||
      message?.message?.documentMessage?.contextInfo ||
      null

    const quoted = ctx?.quotedMessage || null
    let body = ''

    if (quoted) {
      body =
        quoted.conversation ||
        quoted.extendedTextMessage?.text ||
        quoted.imageMessage?.caption ||
        quoted.videoMessage?.caption ||
        quoted.documentMessage?.caption ||
        ''
    }

    if (!body) body = args.join(' ').trim()

    if (!body) {
      return [
        '📢 *HIDETAG*',
        '',
        'Provide a message or reply to one.',
        '',
        'Usage:',
        '  `.hidetag Meeting at 8pm`',
        '  Reply to any message with `.hidetag`'
      ].join('\n')
    }

    await runtime.safeSendMessage(
      group.group_id,
      {
        text: body,
        mentions: mentionJids
      },
      { label: 'hidetag' }
    )

    return null
  }
)

register(
  'stats',
  {
    category: 'group',
    description: 'Show group statistics'
  },
  async ({ runtime, group }) =>
    runtime.formatStats(group.group_id)
)

register(
  'welcome',
  {
    category: 'group',
    description: 'Toggle welcome messages on or off',
    usage: '.welcome <on|off|status>',
    admin: true
  },
  async ({ runtime, group, sender, args, message }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await runtime.isGroupAdmin(group.group_id, sender))) {
      return 'Admin permission required.'
    }

    const sub = String(args[0] || 'status').trim().toLowerCase()

    if (sub === 'status') {
      const on = group.welcome_enabled !== 0
      return [
        '👋 *WELCOME MESSAGES*',
        '',
        `State: ${on ? '✅ ON' : '❌ OFF'}`,
        '',
        'Use `.welcome on` or `.welcome off`.'
      ].join('\n')
    }

    if (sub !== 'on' && sub !== 'off') {
      return 'Usage: `.welcome on|off|status`'
    }

    const enabled = sub === 'on'

    updateGroupSettings(group.tenant_id, group.group_id, {
      welcomeEnabled: enabled
    })

    addAudit(
      group.tenant_id,
      group.group_id,
      sender,
      'welcome.toggle',
      null,
      { enabled }
    )

    return enabled
      ? '👋 *Welcome messages enabled.*'
      : '🔕 *Welcome messages disabled.*'
  }
)

register(
  'goodbye',
  {
    category: 'group',
    description: 'Toggle goodbye messages on or off',
    usage: '.goodbye <on|off|status>',
    admin: true
  },
  async ({ runtime, group, sender, args }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await runtime.isGroupAdmin(group.group_id, sender))) {
      return 'Admin permission required.'
    }

    const sub = String(args[0] || 'status').trim().toLowerCase()

    if (sub === 'status') {
      const on = group.goodbye_enabled !== 0
      return [
        '👋 *GOODBYE MESSAGES*',
        '',
        `State: ${on ? '✅ ON' : '❌ OFF'}`,
        '',
        'Use `.goodbye on` or `.goodbye off`.'
      ].join('\n')
    }

    if (sub !== 'on' && sub !== 'off') {
      return 'Usage: `.goodbye on|off|status`'
    }

    const enabled = sub === 'on'

    updateGroupSettings(group.tenant_id, group.group_id, {
      goodbyeEnabled: enabled
    })

    addAudit(
      group.tenant_id,
      group.group_id,
      sender,
      'goodbye.toggle',
      null,
      { enabled }
    )

    return enabled
      ? '👋 *Goodbye messages enabled.*'
      : '🔕 *Goodbye messages disabled.*'
  }
)

register(
  'setrules',
  {
    category: 'group',
    description: 'Set isolated group rules',
    usage: '.setrules <rules>',
    admin: true
  },
  async ({ runtime, group, sender, args }) => {
    if (!(await runtime.isGroupAdmin(group.group_id, sender))) {
      return 'Admin permission required.'
    }

    const rules = args.join(' ').trim()

    if (!rules) return 'Usage: .setrules <rules>'

    updateGroupSettings(group.tenant_id, group.group_id, { rules })

    addAudit(
      group.tenant_id,
      group.group_id,
      sender,
      'setrules',
      null,
      { rules }
    )

    return '✅ Group rules updated.'
  }
)

/* ───────────────────────
   MODERATION
   ─────────────────────── */

register(
  'antilink',
  {
    category: 'moderation',
    description: 'Toggle anti-link protection',
    usage: '.antilink <on|off>',
    admin: true
  },
  async ({ runtime, group, sender, args, message }) => {
    if (!(await hasGroupAdminPermission({ runtime, group, sender, message }))) {
      return 'Admin permission required.'
    }

    const value = String(args[0] || '').toLowerCase()

    if (!['on', 'off'].includes(value)) {
      return 'Usage: .antilink on|off'
    }

    updateGroupSettings(group.tenant_id, group.group_id, {
      antiLink: value === 'on'
    })

    return `🔗 Anti-link ${value === 'on' ? 'enabled' : 'disabled'}.`
  }
)

register(
  'antispam',
  {
    category: 'moderation',
    description: 'Toggle anti-spam protection',
    usage: '.antispam <on|off>',
    admin: true
  },
  async ({ runtime, group, sender, args, message }) => {
    if (!(await hasGroupAdminPermission({ runtime, group, sender, message }))) {
      return 'Admin permission required.'
    }

    const value = String(args[0] || '').toLowerCase()

    if (!['on', 'off'].includes(value)) {
      return 'Usage: .antispam on|off'
    }

    updateGroupSettings(group.tenant_id, group.group_id, {
      antiSpam: value === 'on'
    })

    return `🛡️ Anti-spam ${value === 'on' ? 'enabled' : 'disabled'}.`
  }
)

register(
  'mute',
  {
    category: 'moderation',
    description: 'Mute the group so only admins can send messages',
    usage: '.mute',
    admin: true
  },
  async ({ runtime, group, sender, message }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await hasGroupAdminPermission({ runtime, group, sender, message }))) {
      return 'Admin permission required.'
    }

    try {
      await runtime.setGroupMuted(group.group_id)

      addAudit(group.group_id, sender, 'mute', null, {
        mode: 'announcement'
      })

      return ['🔇 *GROUP MUTED*', '', 'Only group admins can send messages now.'].join('\n')
    } catch (error) {
      console.error('[X MUTE] error:', error)
      return `❌ ${error?.message || 'Failed to mute the group.'}`
    }
  }
)

register(
  'unmute',
  {
    category: 'moderation',
    description: 'Unmute the group so all members can send messages',
    usage: '.unmute',
    admin: true
  },
  async ({ runtime, group, sender, message }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await hasGroupAdminPermission({ runtime, group, sender, message }))) {
      return 'Admin permission required.'
    }

    try {
      await runtime.setGroupUnmuted(group.group_id)

      addAudit(group.group_id, sender, 'unmute', null, {
        mode: 'not_announcement'
      })

      return ['🔊 *GROUP UNMUTED*', '', 'All group members can send messages again.'].join('\n')
    } catch (error) {
      console.error('[X UNMUTE] error:', error)
      return `❌ ${error?.message || 'Failed to unmute the group.'}`
    }
  }
)

register(
  'cards',
  {
    category: 'moderation',
    description: '🎨 Toggle auto-generated command cards',
    usage: '.cards <on|off|status>',
    admin: true
  },
  async ({ runtime, group, sender, args }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await runtime.isGroupAdmin(group.group_id, sender))) {
      return 'Admin permission required.'
    }

    const sub = String(args[0] || 'status').toLowerCase()

    if (sub === 'status') {
      const on = group.cards_enabled !== 0
      return [
        '🎨 *COMMAND CARDS*',
        '',
        `State: ${on ? '✅ ON' : '❌ OFF'}`,
        '',
        on
          ? 'Commands render auto-generated cards.'
          : 'Commands return plain text.',
        '',
        'Use `.cards on` or `.cards off`.'
      ].join('\n')
    }

    if (sub !== 'on' && sub !== 'off') {
      return 'Usage: `.cards on|off|status`'
    }

    const enabled = sub === 'on'

    updateGroupSettings(group.tenant_id, group.group_id, {
      cardsEnabled: enabled
    })

    addAudit(
      group.tenant_id,
      group.group_id,
      sender,
      'cards.toggle',
      null,
      { enabled }
    )

    return enabled
      ? '🎨 *Command cards enabled.*'
      : '📝 *Command cards disabled.* Plain text mode.'
  }
)

register(
  'antidelete',
  {
    category: 'moderation',
    description: '🚨 Deleted-message recovery. Public, admins-only, or off.',
    usage: '.antidelete <on|off|admins|public|status>',
    admin: true
  },
  async ({ runtime, group, sender, args, message }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await hasGroupAdminPermission({ runtime, group, sender, message }))) {
      return 'Admin permission required.'
    }

    const sub = String(args[0] || 'status').trim().toLowerCase()

    if (sub === 'status') {
      const mode = getAntideleteMode(group.tenant_id, group.group_id)

      const label =
        mode === 'public'
          ? '✅ PUBLIC — everyone sees recovered messages'
          : mode === 'admins'
          ? '🛡️ ADMINS — recovered messages DM\'d to admins'
          : '❌ OFF — deleted messages are ignored'

      return [
        '🚨 *ANTI-DELETE*',
        '',
        `Mode: ${label}`,
        '',
        'Options:',
        '  `.antidelete on`      → alias for public',
        '  `.antidelete public`  → post recovery in-group',
        '  `.antidelete admins`  → DM recovery to admins only',
        '  `.antidelete off`     → disable recovery'
      ].join('\n')
    }

    const map = {
      on: 'public',
      public: 'public',
      admins: 'admins',
      admin: 'admins',
      off: 'off'
    }

    const mode = map[sub]

    if (!mode) {
      return 'Usage: `.antidelete on|off|admins|public|status`'
    }

    updateGroupSettings(group.tenant_id, group.group_id, {
      antideleteMode: mode
    })

    addAudit(
      group.tenant_id,
      group.group_id,
      sender,
      'antidelete.mode',
      null,
      { mode }
    )

    return mode === 'public'
      ? '🚨 *Anti-delete: PUBLIC.* Deleted messages will be recovered for everyone.'
      : mode === 'admins'
      ? '🛡️ *Anti-delete: ADMINS.* Deleted messages will be DM\'d to group admins only.'
      : '🔕 *Anti-delete: OFF.* Deleted messages will be ignored.'
  }
)

register(
  'antiview',
  {
    category: 'moderation',
    description: '👁️ Auto-capture view-once media (public, admins-only, off)',
    usage: '.antiview <on|off|admins|public|status>',
    admin: true
  },
  async ({ runtime, group, sender, args }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await runtime.isGroupAdmin(group.group_id, sender))) {
      return 'Admin permission required.'
    }

    const sub = String(args[0] || 'status').trim().toLowerCase()

    const currentSettings = (() => {
      try { return JSON.parse(group.settings_json || '{}') }
      catch { return {} }
    })()

    const currentMode = currentSettings.antiviewMode || 'public'

    if (sub === 'status') {
      const label =
        currentMode === 'public'
          ? '✅ PUBLIC — view-once posted to the group'
          : currentMode === 'admins'
          ? '🛡️ ADMINS — view-once DM\'d to admins only'
          : '❌ OFF — view-once is ignored'

      return [
        '👁️ *ANTIVIEW*',
        '',
        `Mode: ${label}`,
        '',
        'Every view-once that lands in this group is captured',
        'the instant it arrives — before WhatsApp burns the key.',
        '',
        'Options:',
        '  `.antiview on`      → alias for public',
        '  `.antiview public`  → post captured view-once in-group',
        '  `.antiview admins`  → DM captured view-once to admins',
        '  `.antiview off`     → disable auto-capture'
      ].join('\n')
    }

    const map = {
      on: 'public',
      public: 'public',
      admins: 'admins',
      admin: 'admins',
      off: 'off'
    }

    const mode = map[sub]

    if (!mode) {
      return 'Usage: `.antiview on|off|admins|public|status`'
    }

    updateGroupSettings(group.tenant_id, group.group_id, {
      settings: { antiviewMode: mode }
    })

    addAudit(
      group.tenant_id,
      group.group_id,
      sender,
      'antiview.mode',
      null,
      { mode }
    )

    return mode === 'public'
      ? '👁️ *Antiview: PUBLIC.* View-once will be captured and posted here.'
      : mode === 'admins'
      ? '🛡️ *Antiview: ADMINS.* View-once will be DM\'d to admins only.'
      : '🔕 *Antiview: OFF.* View-once will be ignored.'
  }
)

register(
  'vv',
  {
    category: 'moderation',
    description: '👁️ Recover a view-once message (reply to it)',
    usage: '.vv (reply to a view-once)'
  },
  async ({ runtime, group, sender, message }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    const ctx =
      message?.message?.extendedTextMessage?.contextInfo ||
      message?.message?.imageMessage?.contextInfo ||
      message?.message?.videoMessage?.contextInfo ||
      message?.message?.audioMessage?.contextInfo ||
      message?.message?.documentMessage?.contextInfo ||
      null

    const quotedId = ctx?.stanzaId
    const quotedSender = ctx?.participant || ctx?.participantAlt || null
    const quotedMessage = ctx?.quotedMessage || null

    if (!quotedId) {
      return [
        '👁️ *VIEW-ONCE RECOVERY*',
        '',
        'Reply to a view-once message with `.vv` to recover it.',
        '',
        '_Tip: with `.antiview on`, X captures view-once the instant',
        'it lands, so you don\'t even need to reply._'
      ].join('\n')
    }

    if (quotedMessage) {
      runtime.cacheViewOnceFromReply?.(
        group.group_id,
        quotedId,
        quotedSender,
        quotedMessage
      )
    }

    let envelope = runtime.getStoredMessage?.(group.group_id, quotedId)
    let kind = runtime.getStoredKind?.(group.group_id, quotedId)

    if (!envelope && quotedMessage) {
      const wrapperPresent =
        quotedMessage.viewOnceMessage ||
        quotedMessage.viewOnceMessageV2 ||
        quotedMessage.viewOnceMessageV2Extension

      if (wrapperPresent) {
        envelope = {
          key: {
            remoteJid: group.group_id,
            id: quotedId,
            participant: quotedSender,
            fromMe: false
          },
          message: quotedMessage
        }
        kind = 'viewonce'
      }
    }

    if (!envelope) {
      envelope = runtime.findRecentViewOnce?.(group.group_id, quotedSender)
      if (envelope?.key?.id) {
        kind = runtime.getStoredKind?.(group.group_id, envelope.key.id)
      }
    }

    if (!envelope) {
      return [
        '👁️ *VIEW-ONCE RECOVERY*',
        '',
        '❌ Could not recover that view-once.',
        '',
        'The wrapper was likely stripped before X could cache it.',
        'Enable `.antiview on` to auto-capture every view-once that',
        'lands in this group from now on.'
      ].join('\n')
    }

    if (kind && kind !== 'viewonce') {
      return '❌ That message is not a view-once.'
    }

    try {
      const recovered = await runtime.captureViewOnce?.(
        group.group_id,
        envelope,
        quotedSender || envelope?.key?.participant || sender,
        null,
        { fromRevoke: true }
      )

      return recovered
        ? null
        : '❌ Download failed. The media may have expired on WhatsApp\'s servers.'
    } catch (error) {
      console.warn('[X VV] recovery failed:', error?.message || error)
      return `❌ Recovery failed: ${error?.message || 'unknown error'}`
    }
  }
)

register(
  'agent',
  {
    category: 'moderation',
    description: '🤖 Toggle X\'s AI presence in the group',
    usage: '.agent <on|off|status>',
    admin: true
  },
  async ({ runtime, group, sender, args, message }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    const identity = identityFromMessage(message || {})
    identity.jid = identity.jid || sender

    const isOwnerUser = runtime.isOwner(identity)
    const isAdminUser = await runtime.isGroupAdmin(group.group_id, sender)

    if (!isOwnerUser && !isAdminUser) {
      return 'Admin permission required.'
    }

    const sub = String(args[0] || 'status').toLowerCase()

    const settings = (() => {
      try { return JSON.parse(group.settings_json || '{}') }
      catch { return {} }
    })()

    const enabled = settings.agentEnabled !== false

    if (sub === 'status') {
      return [
        '🤖 *X AGENT*',
        '',
        `State: ${enabled ? '✅ ON' : '❌ OFF'}`,
        '',
        enabled
          ? 'X learns from chat and occasionally vibes back.'
          : 'X is silent. It only responds to commands.',
        '',
        'Toggle with `.agent on` or `.agent off`.'
      ].join('\n')
    }

    if (sub !== 'on' && sub !== 'off') {
      return 'Usage: `.agent on|off|status`'
    }

    const wantEnabled = sub === 'on'

    updateGroupSettings(group.tenant_id, group.group_id, {
      settings: { agentEnabled: wantEnabled }
    })

    addAudit(
      group.tenant_id,
      group.group_id,
      sender,
      'agent.toggle',
      null,
      { enabled: wantEnabled }
    )

    const { setAgentDisabled } = await import('./vibe.mjs')
    setAgentDisabled(group.tenant_id, group.group_id, !wantEnabled)

    return wantEnabled
      ? '🤖 *X is awake.* It will learn and vibe with the chat.'
      : '😴 *X is sleeping.* Commands only.'
  }
)

register(
  'vibe',
  {
    category: 'moderation',
    description: '🎭 Check or set X\'s current mood',
    usage: '.vibe',
    admin: false
  },
  async ({ group }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const { pickMood, moodLine } = await import('./persona.mjs')

    const mood = pickMood(group.tenant_id, group.group_id)

    return [
      `🎭 *X's VIBE RIGHT NOW*`,
      '',
      moodLine(mood),
      '',
      `_(${mood})_`
    ].join('\n')
  }
)

register(
  'memory',
  {
    category: 'moderation',
    description: '🧠 Show what X remembers about this group',
    usage: '.memory',
    admin: true
  },
  async ({ runtime, group, sender, message }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const identity = identityFromMessage(message || {})
    identity.jid = identity.jid || sender

    const isOwnerUser = runtime.isOwner(identity)
    const isAdminUser = await runtime.isGroupAdmin(group.group_id, sender)

    if (!isOwnerUser && !isAdminUser) {
      return 'Admin permission required.'
    }

    const { memoryStats } = await import('./memory.mjs')

    const stats = memoryStats(group.tenant_id, group.group_id)

    return [
      '🧠 *X MEMORY*',
      '',
      `User notes:  ${stats.userNotes}`,
      `Group notes: ${stats.groupNotes}`,
      `X notes:     ${stats.xNotes}`,
      `Chat rows:   ${stats.chatRows}`,
      '',
      'Wipe with `.forget all` (admins only).'
    ].join('\n')
  }
)

register(
  'forget',
  {
    category: 'moderation',
    description: '🗑️ Wipe X\'s memory for this group',
    usage: '.forget all',
    admin: true
  },
  async ({ runtime, group, sender, args, message }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const identity = identityFromMessage(message || {})
    identity.jid = identity.jid || sender

    const isOwnerUser = runtime.isOwner(identity)
    const isAdminUser = await runtime.isGroupAdmin(group.group_id, sender)

    if (!isOwnerUser && !isAdminUser) {
      return 'Admin permission required.'
    }

    const sub = String(args[0] || '').toLowerCase()

    if (sub !== 'all') {
      return [
        '🗑️ *FORGET*',
        '',
        'Usage: `.forget all`',
        '',
        'This wipes every note X has stored for this group.',
        'Chat history, per-user facts, X\'s own notes — all gone.'
      ].join('\n')
    }

    const { forgetAll } = await import('./memory.mjs')
    forgetAll(group.tenant_id, group.group_id)

    addAudit(
      group.tenant_id,
      group.group_id,
      sender,
      'agent.forget_all',
      null,
      {}
    )

    return '🗑️ *Memory wiped.* X is a blank slate again.'
  }
)

register(
  'warn',
  {
    category: 'moderation',
    description: 'Warn a member',
    usage: '.warn @user [reason]',
    admin: true
  },
  async ({ runtime, group, sender, args, mentions, message }) => {
    if (!(await hasGroupAdminPermission({ runtime, group, sender, message }))) {
      return 'Admin permission required.'
    }

    const target = mentions?.[0]

    if (!target) return 'Mention a member to warn.'

    const targetMember = getMember(group.tenant_id, group.group_id, target)

    if (
      targetMember &&
      (targetMember.role === 'admin' || targetMember.role === 'superadmin')
    ) {
      return 'Admins cannot be warned.'
    }

    const reason =
      args.filter((x) => !x.startsWith('@')).join(' ').trim() ||
      'No reason provided'

    const result = await runtime.enforceWarning({
      group,
      targetJid: target,
      reason,
      sourceLabel: 'Manual Warn'
    })

    if (!result.warned) {
      if (result.exempt) return 'Admins cannot be warned.'
      return 'Warning could not be recorded.'
    }

    return null
  }
)

register(
  'warnings',
  {
    category: 'moderation',
    description: 'Show member warnings',
    usage: '.warnings [@user]'
  },
  async ({ runtime, group, sender, mentions }) => {
    const target = mentions?.[0] || sender

    const result = getWarnings(group.tenant_id, group.group_id, target)

    const targetMention = memberMention(runtime, group.group_id, target)

    return {
      text: [
        `⚠️ ${targetMention.text} has *${result.count}* warning(s).`,
        result.last_reason ? `Last reason: ${result.last_reason}` : ''
      ].join('\n'),
      mentions: targetMention.jid ? [targetMention.jid] : []
    }
  }
)

register(
  'clearwarn',
  {
    category: 'moderation',
    description: 'Clear member warnings',
    usage: '.clearwarn @user',
    admin: true
  },
  async ({ runtime, group, sender, mentions, message }) => {
    if (!(await hasGroupAdminPermission({ runtime, group, sender, message }))) {
      return 'Admin permission required.'
    }

    const target = mentions?.[0]

    if (!target) return 'Mention a member.'

    clearWarnings(group.tenant_id, group.group_id, target)

    addAudit(group.tenant_id, group.group_id, sender, 'clearwarn', target)

    const targetMention = memberMention(runtime, group.group_id, target)

    return {
      text: `✅ Warnings cleared for ${targetMention.text}.`,
      mentions: targetMention.jid ? [targetMention.jid] : []
    }
  }
)

register(
  'approveall',
  {
    category: 'moderation',
    description: 'Approve all pending join requests',
    usage: '.approveall',
    admin: true
  },
  async ({ runtime, group, sender, message }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await hasGroupAdminPermission({ runtime, group, sender, message }))) {
      return 'Admin permission required.'
    }

    let requests

    try {
      requests = await runtime.listJoinRequests(group.group_id)
    } catch (error) {
      return `❌ Could not fetch requests: ${error.message}`
    }

    if (!requests.length) {
      return '📭 No pending join requests.'
    }

    const jids = requests
      .map((r) => (typeof r === 'string' ? r : r?.jid))
      .filter(Boolean)

    if (!jids.length) {
      return '📭 No valid pending requests.'
    }

    let result

    try {
      result = await runtime.updateJoinRequests(group.group_id, jids, 'approve')
    } catch (error) {
      if (error.message === 'I cannot kick myself.') return error.message
      return `❌ Approval failed: ${error.message}`
    }

    const approved = Array.isArray(result)
      ? result.filter((r) => r?.status === '200').length
      : jids.length

    const failed = jids.length - approved

    try {
      addAudit(group.group_id, sender, 'approveall', null, {
        requested: jids.length,
        approved,
        failed
      })
    } catch {}

    try {
      await runtime.syncGroup(group.group_id)
    } catch {}

    return [
      `✅ *JOIN REQUESTS PROCESSED*`,
      '',
      `Approved: ${approved}`,
      failed > 0 ? `Failed:   ${failed}` : null
    ]
      .filter(Boolean)
      .join('\n')
  }
)

register(
  'add',
  {
    category: 'moderation',
    description: 'Add a phone number to the group',
    usage: '.add <phone-number>',
    admin: true
  },
  async ({ runtime, group, sender, args, message }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await hasGroupAdminPermission({ runtime, group, sender, message }))) {
      return 'Admin permission required.'
    }

    const raw = String(args[0] || '').trim()

    if (!raw) {
      return [
        '📞 *ADD MEMBER*',
        '',
        'Usage: `.add <phone-number>`',
        '',
        'Example:',
        '  `.add 2348012345678`',
        '  `.add +233501234567`'
      ].join('\n')
    }

    const digits = raw.replace(/\D/g, '')

    if (digits.length < 7 || digits.length > 15) {
      return '❌ Invalid number. Include country code, no spaces or symbols.'
    }

    const jid = `${digits}@s.whatsapp.net`

    const existing = getMember(group.tenant_id, group.group_id, jid)

    if (existing) {
      return `⚠️ *+${digits}* is already in the group.`
    }

    let result

    try {
      result = await runtime.addParticipant(group.group_id, jid)
    } catch (error) {
      const message = String(error?.message || '')

      if (message === 'I cannot kick myself.') return message

      if (/not authorized|forbidden/i.test(message)) {
        return '❌ X must be a group admin to add members.'
      }

      return `❌ Add failed: ${message || 'unknown error'}`
    }

    const entry = Array.isArray(result) ? result[0] : null
    const status = entry?.status ? String(entry.status) : null

    if (status && status !== '200') {
      const map = {
        '403': 'That user has privacy settings blocking group adds.',
        '408': 'Request timed out. Try again.',
        '409': 'That number is already a participant.',
        '500': 'WhatsApp returned an internal error. Try again later.'
      }

      return `❌ ${map[status] || `Add failed with status ${status}.`}`
    }

    try {
      addAudit(group.tenant_id, group.group_id, sender, 'add', jid, { number: digits })
    } catch {}

    try {
      await runtime.syncGroup(group.group_id)
    } catch {}

    return `✅ Added *+${digits}* to the group.`
  }
)

for (const action of ['kick', 'promote', 'demote']) {
  register(
    action,
    {
      category: 'moderation',
      description: `${action} a member`,
      usage: `.${action} @user`,
      admin: true
    },
    async ({ runtime, group, sender, mentions, message }) => {
      if (!(await hasGroupAdminPermission({ runtime, group, sender, message }))) {
        return 'Admin permission required.'
      }

      let metadata
      try {
        metadata = await runtime.sock.groupMetadata(group.group_id)
      } catch (error) {
        console.warn(
          `[X ${action.toUpperCase()}] Could not verify group admins:`,
          error?.message || error
        )
        return '❌ Could not verify group admin permissions. No action was taken.'
      }

      const participants = metadata?.participants || []
      const botJid = runtime.sock?.user?.id
      const botIsAdmin = participants.some(participant =>
        isGroupAdminParticipant(participant, botJid)
      )
      const senderIsAdmin = participants.some(participant =>
        isGroupAdminParticipant(participant, sender)
      )
      if (!botJid || !botIsAdmin || !senderIsAdmin) {
        return '❌ Both X and you must be group admins to perform this action.'
      }

      const target = mentions?.[0]

      if (!target) return 'Mention a member.'

      try {
        await runtime.groupParticipantAction(group.group_id, [target], action)

        addAudit(group.group_id, sender, action, target)

        const targetMention = memberMention(runtime, group.group_id, target)

        return {
          text: `✅ ${action} completed for ${targetMention.text}.`,
          mentions: targetMention.jid ? [targetMention.jid] : []
        }
      } catch (error) {
        if (error.message === 'I cannot kick myself.') return error.message
        return `❌ ${error.message}`
      }
    }
  )
}

/* ───────────────────────
   PROFILE / RANK
   ─────────────────────── */

register(
  'profile',
  {
    category: 'profile',
    description: 'Show a member profile',
    usage: '.profile [@user]'
  },
  async ({ group, sender, mentions }) => {
    const jid = mentions?.[0] || sender

    const member = getMember(group.tenant_id, group.group_id, jid)

    if (!member) {
      return 'Member is not synchronized in this group.'
    }

    return [
      `👤 *${getMemberHumanName(member)}*`,
      `Level: ${member.level}`,
      `XP: ${member.xp}`,
      `KC: ${member.coins}`,
      `Bank: ${member.bank}`,
      `Games: ${member.wins}W / ${member.losses}L`,
      `Reputation: ${member.reputation}`,
      `Streak: ${member.streak}`,
      `Messages: ${member.messages}`
    ].join('\n')
  }
)

register(
  'rank',
  {
    category: 'profile',
    description: 'Show group rank'
  },
  async ({ runtime, group, sender }) =>
    runtime.formatRank(group.group_id, sender)
)

register(
  'leaderboard',
  {
    category: 'profile',
    description: 'Show leaderboard',
    usage: '.leaderboard [xp|coins|wins|messages|reputation|streak]'
  },
  async ({ group, args }) => {
    const field = String(args[0] || 'xp').toLowerCase()

    const rows = leaderboard(group.tenant_id, group.group_id, field, 10)

    return [
      `🏆 *${field.toUpperCase()} LEADERBOARD*`,
      rows
        .map(
          (member, index) =>
            `${index + 1}. ${getMemberHumanName(member)} — ${
              field === 'coins' ? member.coins + member.bank : member[field]
            }`
        )
        .join('\n') || 'No records yet.'
    ].join('\n')
  }
)

register(
  'profilecard',
  {
    category: 'profile',
    description: 'Send visual profile card'
  },
  async ({ runtime, group, sender, mentions }) => {
    const member = getMember(
      group.tenant_id,
      group.group_id,
      mentions?.[0] || sender
    )

    if (!member) return 'Member not synchronized.'

    try {
      await runtime.sendImage(
        group.group_id,
        await profileCard(member),
        '👤 @',
        [member.jid]
      )

      return null
    } catch {
      return [
        `👤 *${getMemberHumanName(member)}`,
        `Level ${member.level}`,
        `${member.xp} XP`,
        `${member.coins} KC`
      ].join(' · ')
    }
  }
)

register(
  'lbcard',
  {
    category: 'profile',
    description: 'Send visual leaderboard'
  },
  async ({ runtime, group, args }) => {
    const field = String(args[0] || 'xp').toLowerCase()

    const rows = leaderboard(group.tenant_id, group.group_id, field, 10)

    try {
      await runtime.sendImage(
        group.group_id,
        await leaderboardCard(group.name || 'Group', rows, field),
        `🏆 ${field.toUpperCase()} leaderboard`
      )

      return null
    } catch {
      return rows
        .map(
          (member, index) =>
            `${index + 1}. ${getMemberHumanName(member)} — ${
              field === 'coins' ? member.coins + member.bank : member[field]
            }`
        )
        .join('\n')
    }
  }
)

/* ───────────────────────
   ECONOMY
   ─────────────────────── */

register(
  'balance',
  {
    category: 'economy',
    description: 'Show KC balance'
  },
  async ({ group, sender }) => {
    const member = getMember(group.tenant_id, group.group_id, sender)

    if (!member) return 'Member not synchronized.'

    return `💰 Wallet: *${member.coins} KC* · Bank: *${member.bank} KC*`
  }
)

register(
  'daily',
  {
    category: 'economy',
    description: 'Claim daily KC'
  },
  async ({ group, sender }) => {
    const result = dailyClaim(group.tenant_id, group.group_id, sender)

    return result.error
      ? result.error
      : [
          `🎁 Daily reward: *+${result.reward} KC*`,
          `Streak: ${result.member.streak}`
        ].join('\n')
  }
)

register(
  'weekly',
  {
    category: 'economy',
    description: 'Claim weekly KC'
  },
  async ({ group, sender }) => {
    const member = getMember(group.tenant_id, group.group_id, sender)

    if (!member) return 'Member not synchronized.'

    const dateKey = new Date().toISOString().slice(0, 10)
    const week = Math.floor(Date.parse(dateKey) / 604800000)

    if (member.last_weekly === String(week)) {
      return '🎁 Weekly reward already claimed.'
    }

    const reward = 700 + member.level * 50

    touchMember(group.tenant_id, group.group_id, sender, {
      coins: reward,
      xp: 75
    })

    db.prepare(
      `UPDATE members SET last_weekly=?, updated_at=?
       WHERE tenant_id=? AND group_id=? AND jid=?`
    ).run(
      String(week),
      new Date().toISOString(),
      group.tenant_id,
      group.group_id,
      sender
    )

    return `🎉 Weekly reward: *+${reward} KC*`
  }
)

register(
  'monthly',
  {
    category: 'economy',
    description: 'Claim monthly KC'
  },
  async ({ group, sender }) => {
    const member = getMember(group.tenant_id, group.group_id, sender)

    if (!member) return 'Member not synchronized.'

    const date = new Date()
    const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`

    if (member.last_monthly === key) {
      return '🎁 Monthly reward already claimed.'
    }

    const reward = 3000 + member.level * 250

    touchMember(group.tenant_id, group.group_id, sender, {
      coins: reward,
      xp: 200
    })

    db.prepare(
      `UPDATE members SET last_monthly=?, updated_at=?
       WHERE tenant_id=? AND group_id=? AND jid=?`
    ).run(
      key,
      new Date().toISOString(),
      group.tenant_id,
      group.group_id,
      sender
    )

    return `🎉 Monthly reward: *+${reward} KC*`
  }
)

register(
  'work',
  {
    category: 'economy',
    description: 'Earn KC from work'
  },
  async ({ runtime, group, sender }) => {
    const jobs = ['Tutor', 'Developer', 'Designer', 'Trader', 'Teacher', 'Streamer']
    const job = jobs[Math.floor(Math.random() * jobs.length)]
    const coins = 25 + Math.floor(Math.random() * 76)

    const member = touchMember(group.tenant_id, group.group_id, sender, {
      coins,
      xp: 10
    })

    return [
      `💼 ${runtime.getMemberDisplayName(group.group_id, sender)} worked as a *${job}* and earned *${coins} KC*.`,
      `Wallet: ${member.coins} KC`
    ].join('\n')
  }
)

register(
  'pay',
  {
    category: 'economy',
    description: 'Pay another member',
    usage: '.pay @user <amount>'
  },
  async ({ runtime, group, sender, args, mentions }) => {
    const target = mentions?.[0]
    const amount = Math.floor(
      Number(args.find((x) => /^\d+$/.test(x)))
    )

    if (!target || !amount || amount < 1) {
      return 'Usage: .pay @user <amount>'
    }

    try {
      transferCoins(group.tenant_id, group.group_id, sender, target, amount)

      addAudit(group.tenant_id, group.group_id, sender, 'pay', target, { amount })

      const targetMention = memberMention(runtime, group.group_id, target)

      return {
        text: `💸 Sent *${amount} KC* to ${targetMention.text}.`,
        mentions: targetMention.jid ? [targetMention.jid] : []
      }
    } catch (error) {
      return `❌ ${error.message}`
    }
  }
)

register(
  'give',
  {
    category: 'economy',
    description: 'Transfer KC',
    usage: '.give @user <amount>'
  },
  async ({ runtime, group, sender, mentions, args }) => {
    const amount = Number(args.find((x) => /^\d+$/.test(x)))

    if (!mentions?.[0] || !amount) {
      return 'Usage: .give @user <amount>'
    }

    transferCoins(group.tenant_id, group.group_id, sender, mentions[0], amount)

    const targetMention = memberMention(runtime, group.group_id, mentions[0])

    return {
      text: `💸 Sent *${amount} KC* to ${targetMention.text}.`,
      mentions: targetMention.jid ? [targetMention.jid] : []
    }
  }
)

register(
  'bank',
  {
    category: 'economy',
    description: 'Show bank balance'
  },
  async ({ group, sender }) => {
    const member = getMember(group.tenant_id, group.group_id, sender)

    return member
      ? `🏦 Bank: *${member.bank} KC*`
      : 'Member not synchronized.'
  }
)

register(
  'deposit',
  {
    category: 'economy',
    description: 'Deposit KC',
    usage: '.deposit <amount>'
  },
  async ({ group, sender, args }) => {
    const member = bankDeposit(
      group.tenant_id,
      group.group_id,
      sender,
      Number(args[0])
    )

    return `🏦 Deposited. Wallet: ${member.coins} KC · Bank: ${member.bank} KC`
  }
)

register(
  'withdraw',
  {
    category: 'economy',
    description: 'Withdraw KC',
    usage: '.withdraw <amount>'
  },
  async ({ group, sender, args }) => {
    const member = bankWithdraw(
      group.tenant_id,
      group.group_id,
      sender,
      Number(args[0])
    )

    return `💵 Withdrawn. Wallet: ${member.coins} KC · Bank: ${member.bank} KC`
  }
)

register(
  'richlist',
  {
    category: 'economy',
    description: 'Group wealth leaderboard'
  },
  async ({ group }) => {
    const rows = richlist(group.tenant_id, group.group_id, 10)

    return [
      `💎 *RICH LIST*`,
      rows
        .map(
          (member, index) =>
            `${index + 1}. ${getMemberHumanName(member)} — ${
              member.coins + member.bank
            } KC`
        )
        .join('\n') || 'No records yet.'
    ].join('\n')
  }
)

register(
  'economy',
  {
    category: 'economy',
    description: 'Show group economy'
  },
  async ({ group }) => {
    const rows = richlist(group.tenant_id, group.group_id, 5)

    return [
      `💰 *GROUP ECONOMY*`,
      rows
        .map(
          (member, index) =>
            `${index + 1}. ${getMemberHumanName(member)} — ${
              member.coins + member.bank
            } KC`
        )
        .join('\n') || 'No economy data yet.'
    ].join('\n')
  }
)

/* ───────────────────────
   VICE — Black Market
   ─────────────────────── */

register(
  'shop',
  {
    category: 'economy',
    description: '🛒 Browse the Black Market',
    usage: '.shop [slot]'
  },
  async ({ args }) => {
    const slot = String(args[0] || '').toLowerCase()
    const items = Object.values(SHOP_ITEMS)

    const filtered = slot ? items.filter((i) => i.slot === slot) : items

    if (!filtered.length) {
      return [
        '🛒 *BLACK MARKET*',
        '',
        'Usage: `.shop [slot]`',
        '',
        'Slots:',
        ...Object.keys(SLOT_NAMES).map((k) => `  ▸ ${k} — ${SLOT_NAMES[k]}`)
      ].join('\n')
    }

    const grouped = {}
    for (const item of filtered) {
      if (!grouped[item.slot]) grouped[item.slot] = []
      grouped[item.slot].push(item)
    }

    const sections = []

    for (const [slotKey, slotItems] of Object.entries(grouped)) {
      const header = `▸ *${SLOT_NAMES[slotKey]}*`

      const rows = slotItems.map((item) => {
        const price = item.auraCost
          ? `${item.auraCost} AU`
          : `${item.cost.toLocaleString()} XC`

        return [
          `   ${item.name}`,
          `   ${item.description}`,
          `   _${price}_`
        ].join('\n')
      })

      sections.push([header, '', ...rows].join('\n'))
    }

    return [
      '🛒 *BLACK MARKET*',
      '',
      ...sections,
      '',
      'Buy with `.buy <item> [qty]`',
      'Slots: `.shop weapons`, `.shop armor`, `.shop tech`, `.shop consumables`'
    ].join('\n\n')
  }
)

register(
  'buy',
  {
    category: 'economy',
    description: '💳 Buy an item from the Black Market',
    usage: '.buy <item> [qty]'
  },
  async ({ group, sender, args }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const itemId = String(args[0] || '').toLowerCase()
    const qty = Number(args[1]) || 1

    if (!itemId) {
      return 'Usage: `.buy <item> [qty]`\nSee `.shop` for items.'
    }

    const result = buyItem(group.tenant_id, group.group_id, sender, itemId, qty)

    if (result.error) return `❌ ${result.error}`

    const price = result.auraCost
      ? `${result.auraCost * result.quantity} AU`
      : `${result.cost.toLocaleString()} XC`

    return [
      '✅ *PURCHASE COMPLETE*',
      '',
      `${result.item.name} × ${result.quantity}`,
      `−${price}`,
      '',
      `Equip with \`.equip ${itemId}\`.`
    ].join('\n')
  }
)

register(
  'sell',
  {
    category: 'economy',
    description: '💸 Sell an item back for 50%',
    usage: '.sell <item>'
  },
  async ({ group, sender, args }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const itemId = String(args[0] || '').toLowerCase()

    if (!itemId) return 'Usage: `.sell <item>`'

    const result = sellItem(group.tenant_id, group.group_id, sender, itemId)

    if (result.error) return `❌ ${result.error}`

    return [
      '💸 *SOLD*',
      '',
      `${result.item.name}`,
      `+${result.refund.toLocaleString()} XC`
    ].join('\n')
  }
)

register(
  'inv',
  {
    category: 'economy',
    description: '🎒 View your inventory',
    usage: '.inv'
  },
  async ({ group, sender }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const gear = listViceGear(group.tenant_id, group.group_id, sender)

    if (!gear.length) {
      return '🎒 *INVENTORY EMPTY*\n\nVisit `.shop` to buy your first item.'
    }

    const byItem = new Map()

    for (const row of gear) {
      const key = row.item_id
      if (!byItem.has(key)) {
        byItem.set(key, {
          item_id: row.item_id,
          equipped: false,
          count: 0
        })
      }
      const entry = byItem.get(key)
      entry.count++
      if (row.equipped === 1) entry.equipped = true
    }

    const lines = []

    for (const [itemId, entry] of byItem) {
      const def = SHOP_ITEMS[itemId]
      if (!def) continue

      const equippedMark = entry.equipped ? ' ✅ equipped' : ''
      const countMark = entry.count > 1 ? ` ×${entry.count}` : ''

      lines.push(
        `${def.name}${countMark}${equippedMark}`,
        `   _${def.description}_`
      )
    }

    return ['🎒 *INVENTORY*', '', ...lines].join('\n')
  }
)

register(
  'equip',
  {
    category: 'economy',
    description: '⚔️ Equip or unequip an item',
    usage: '.equip <item>'
  },
  async ({ group, sender, args }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const itemId = String(args[0] || '').toLowerCase()

    if (!itemId) return 'Usage: `.equip <item>`'

    const result = equipItem(group.tenant_id, group.group_id, sender, itemId)

    if (result.error) return `❌ ${result.error}`

    return result.equipped
      ? `✅ Equipped *${result.item.name}*.`
      : `⬜ Unequipped *${result.item.name}*.`
  }
)

register(
  'use',
  {
    category: 'economy',
    description: '💊 Use a consumable',
    usage: '.use <item>'
  },
  async ({ group, sender, args }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const itemId = String(args[0] || '').toLowerCase()

    if (!itemId) return 'Usage: `.use <item>`'

    const result = useConsumable(group.tenant_id, group.group_id, sender, itemId)

    if (result.error) return `❌ ${result.error}`

    if (result.type === 'medkit') {
      return `💊 Used Medkit. Restored *+${result.healed} HP*.`
    }

    return '✅ Used.'
  }
)

/* ─────────────────────── */
/* VICE — crime                                                               */
/* ─────────────────────── */

register(
  'grind',
  {
    category: 'economy',
    description: '💼 Work a small job for X Credits',
    usage: '.grind'
  },
  async ({ group, sender }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const result = grind({
      tenantId: group.tenant_id,
      groupId: group.group_id,
      jid: sender
    })

    if (result.error) return result.error

    return [
      '💼 *GRIND*',
      '',
      `_${result.flavor}_`,
      '',
      `💰 Earned: *+${result.earned} XC*`,
      `⭐ XP: +${result.xp}`,
      result.leveled
        ? `🎉 *LEVEL UP!* You are now Level ${result.level}.`
        : null
    ].filter(Boolean).join('\n')
  }
)

register(
  'rob',
  {
    category: 'economy',
    description: '🔪 Attempt to rob another member',
    usage: '.rob @user'
  },
  async ({ runtime, group, sender, mentions }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const target = mentions?.[0]

    if (!target) return 'Usage: `.rob @user`'

    const result = rob({
      tenantId: group.tenant_id,
      groupId: group.group_id,
      jid: sender,
      targetJid: target
    })

    if (result.error) return result.error

    const targetName = runtime.getMemberDisplayName(
      group.group_id,
      target,
      'target'
    )

    const senderName = runtime.getMemberDisplayName(
      group.group_id,
      sender,
      'you'
    )

    if (!result.success) {
      return [
        '🚔 *ROBBERY FAILED*',
        '',
        `_${result.flavor}_`,
        '',
        `You are jailed for *${result.jailedFor} minutes*.`,
        'Use `.bail` to pay early release.'
      ].join('\n')
    }

    return [
      '🔪 *ROBBERY SUCCESSFUL*',
      '',
      `_${result.flavor}_`,
      '',
      `💰 Stole *${result.stolen} XC* from *${targetName}*`,
      `⭐ XP: +${result.xp}`,
      result.leveled
        ? `🎉 *LEVEL UP!* You are now Level ${result.level}.`
        : null,
      '',
      `${senderName} is now wanted in the district.`
    ].filter(Boolean).join('\n')
  }
)

register(
  'smuggle',
  {
    category: 'economy',
    description: '🏴‍☠️ Run contraband across the district',
    usage: '.smuggle'
  },
  async ({ group, sender }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const result = smuggle({
      tenantId: group.tenant_id,
      groupId: group.group_id,
      jid: sender
    })

    if (result.error) return result.error

    if (!result.success) {
      return [
        '🏴‍☠️ *SMUGGLE FAILED*',
        '',
        `_${result.flavor}_`,
        '',
        `💸 Lost *${result.lost} XC* in the escape.`,
        'Busted count +1.'
      ].join('\n')
    }

    return [
      '🏴‍☠️ *SMUGGLE SUCCESSFUL*',
      '',
      `_${result.flavor}_`,
      '',
      `💰 Payout: *+${result.payout} XC*`,
      `⭐ XP: +${result.xp}`,
      result.leveled
        ? `🎉 *LEVEL UP!* You are now Level ${result.level}.`
        : null
    ].filter(Boolean).join('\n')
  }
)

/* ─────────────────────── */
/* VICE — combat                                                              */
/* ─────────────────────── */

function renderCombatResult(result, runtime, groupId, targetJid, attackerJid) {
  if (result.error) return result.error

  const attackerName = runtime.getMemberDisplayName(groupId, attackerJid, 'you')
  const targetName = runtime.getMemberDisplayName(groupId, targetJid, 'the target')

  const lines = []
  const attackName = result.attackType.toUpperCase()
  const prefix = result.verb === 'executes' ? '☠️' : '⚔️'

  lines.push(`${prefix} *${attackName}*`)
  lines.push('')

  if (result.dodged) {
    lines.push(`_${targetName} dodged the attack._`)
    lines.push('')
    lines.push('No damage dealt. No XP earned.')
  } else {
    lines.push(
      `_${attackerName} ${result.verb} ${targetName}${
        result.crit ? ' with a critical strike' : ''
      }._`
    )
    lines.push('')
    lines.push(`💥 Damage: *${result.damage}*`)
    lines.push(`❤️ ${targetName}: ${result.targetHp}/${result.targetMaxHp} HP`)
    lines.push(`⭐ XP: +${result.xp}`)

    if (result.leveled) {
      lines.push(`🎉 *LEVEL UP!* You are now Level ${result.level}.`)
    }
  }

  if (result.killed) {
    lines.push('')
    lines.push(`💀 *${targetName} IS HOSPITALIZED*`)
    lines.push(`Stole ${result.walletStolen} XC from their wallet.`)
    lines.push(`30 minute lockout before they can act.`)
  }

  return lines.join('\n')
}

for (const cmd of ['hit', 'stab']) {
  register(
    cmd,
    {
      category: 'economy',
      description: `⚔️ ${cmd} another member`,
      usage: `.${cmd} @user`
    },
    async ({ runtime, group, sender, mentions }) => {
      if (!group?.group_id) return 'Use inside a group.'

      const target = mentions?.[0]

      if (!target) return `Usage: \`.${cmd} @user\``

      const result = resolveAttack({
        tenantId: group.tenant_id,
        groupId: group.group_id,
        attackerJid: sender,
        targetJid: target,
        attackType: cmd
      })

      if (result.killed && !result.error) {
        try {
          addCrewReputation(group.group_id, sender, 5)
        } catch {}
      }

      return renderCombatResult(result, runtime, group.group_id, target, sender)
    }
  )
}

register(
  'shoot',
  {
    category: 'economy',
    description: '🔫 Shoot another member (needs ammo)',
    usage: '.shoot @user'
  },
  async ({ runtime, group, sender, mentions }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const target = mentions?.[0]

    if (!target) return 'Usage: `.shoot @user`'

    const result = resolveAttack({
      tenantId: group.tenant_id,
      groupId: group.group_id,
      attackerJid: sender,
      targetJid: target,
      attackType: 'shoot'
    })

    return renderCombatResult(result, runtime, group.group_id, target, sender)
  }
)

register(
  'execute',
  {
    category: 'economy',
    description: '☠️ Assassin-only finisher (target below 20% HP)',
    usage: '.execute @user'
  },
  async ({ runtime, group, sender, mentions }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const target = mentions?.[0]

    if (!target) return 'Usage: `.execute @user`'

    const result = resolveAttack({
      tenantId: group.tenant_id,
      groupId: group.group_id,
      attackerJid: sender,
      targetJid: target,
      attackType: 'execute'
    })

    return renderCombatResult(result, runtime, group.group_id, target, sender)
  }
)

register(
  'pvp',
  {
    category: 'economy',
    description: '🛡️ Toggle PvP status for yourself or the group',
    usage: '.pvp self <on|off> | .pvp status',
    admin: false
  },
  async ({ group, sender, args }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const sub = String(args[0] || 'status').toLowerCase()

    if (sub === 'status') {
      const char = loadCharacter(group.tenant_id, group.group_id, sender)

      if (!char) return '❌ No character loaded.'

      const enabled = char.pvp_enabled !== 0

      return [
        '🛡️ *PVP STATUS*',
        '',
        `Your personal PvP: ${enabled ? '✅ ENABLED' : '❌ DISABLED'}`,
        '',
        'Use `.pvp self on` or `.pvp self off` to toggle.',
        'When disabled, nobody can attack you.'
      ].join('\n')
    }

    if (sub === 'self') {
      const value = String(args[1] || '').toLowerCase()

      if (value !== 'on' && value !== 'off') {
        return 'Usage: `.pvp self on` or `.pvp self off`'
      }

      setPvpSelf(group.group_id, sender, value === 'on')

      return value === 'on'
        ? '⚔️ *PvP ENABLED* — You can now be attacked.'
        : '🕊️ *PvP DISABLED* — Nobody can attack you.'
    }

    return [
      '🛡️ *PVP COMMANDS*',
      '',
      '`.pvp status` — check your status',
      '`.pvp self on` — allow being attacked',
      '`.pvp self off` — block all attacks'
    ].join('\n')
  }
)

/* ───────────────────────
   VICE — career
   ─────────────────────── */

register(
  'career',
  {
    category: 'economy',
    description: '🏴 Choose or switch your career path',
    usage: '.career [name]'
  },
  async ({ group, sender, args }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    const char = loadCharacter(group.tenant_id, group.group_id, sender)
    if (!char) return '❌ Could not load your character.'

    const requested = String(args[0] || '').toLowerCase()

    if (!requested) {
      if (!canChooseCareer(char)) {
        return [
          '🏴 *CAREERS*',
          '',
          `Unlocks at Level ${CAREER_REQUIREMENTS.assassin.level}.`,
          `You are Level ${char.level}.`,
          '',
          'Grind `.grind`, rob `.rob`, work the Black Market — level up first.'
        ].join('\n')
      }

      const lines = Object.entries(CAREER_REQUIREMENTS).map(([key, meta]) => [
        `▸ *${key}*`,
        `  ${meta.description}`
      ].join('\n'))

      return [
        '🏴 *CAREERS*',
        '',
        ...lines,
        '',
        `Current: ${char.career || 'none'}`,
        '',
        'Choose with `.career <name>`.',
        `Switch (L${CAREER_SWITCH_LEVEL}+) costs ${CAREER_SWITCH_COST} XC and locks for 24h.`
      ].join('\n')
    }

    if (!CAREER_REQUIREMENTS[requested]) {
      return `❌ Unknown career: *${requested}*. Options: ${Object.keys(CAREER_REQUIREMENTS).join(', ')}`
    }

    if (!char.career) {
      if (!canChooseCareer(char)) {
        return `🔒 You need Level ${CAREER_REQUIREMENTS.assassin.level} to choose a career.`
      }

      setCareer(group.tenant_id, group.group_id, sender, requested)

      return `🏴 Career set: *${requested}*. Welcome to the game.`
    }

    if (char.career === requested) {
      return `You are already a *${requested}*.`
    }

    const check = canSwitchCareer(char)
    if (!check.ok) return `❌ ${check.reason}`

    setCareer(group.tenant_id, group.group_id, sender, requested, { switched: true })

    return [
      `🔄 Career switched to *${requested}*.`,
      `−${CAREER_SWITCH_COST} XC`,
      '',
      'Locked for 24h before the next switch.'
    ].join('\n')
  }
)

/* ─────────────────────── */
/* VICE — heal / bail                                                         */
/* ─────────────────────── */

register(
  'heal',
  {
    category: 'economy',
    description: '🏥 Pay to leave the hospital early',
    usage: '.heal'
  },
  async ({ group, sender }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const char = loadCharacter(group.tenant_id, group.group_id, sender)
    if (!char) return '❌ No character.'

    if (!isHospitalized(char)) return 'You are not hospitalized.'

    const cost = hospitalRemaining(char) * 100

    if (char.credits < cost) {
      return [
        `❌ Early release costs *${cost} XC*.`,
        `You have ${char.credits} XC.`,
        '',
        `Wait ${hospitalRemaining(char)} more minute(s) for free release.`
      ].join('\n')
    }

    clearHospital(group.tenant_id, group.group_id, sender)
    const updated = loadCharacter(group.tenant_id, group.group_id, sender)

    updateViceCharacter(group.tenant_id, group.group_id, sender, {
      credits: updated.credits - cost
    })

    return `🏥 Released early for *${cost} XC*. HP restored to 50.`
  }
)

register(
  'bail',
  {
    category: 'economy',
    description: '🚔 Pay bail to leave jail early',
    usage: '.bail'
  },
  async ({ group, sender }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const char = loadCharacter(group.tenant_id, group.group_id, sender)
    if (!char) return '❌ No character.'

    if (!isJailed(char)) return 'You are not jailed.'

    const cost = jailRemaining(char) * 50

    if (char.credits < cost) {
      return [
        `❌ Bail costs *${cost} XC*.`,
        `You have ${char.credits} XC.`,
        '',
        `Wait ${jailRemaining(char)} more minute(s) to walk free.`
      ].join('\n')
    }

    clearJail(group.tenant_id, group.group_id, sender)
    const updated = loadCharacter(group.tenant_id, group.group_id, sender)

    updateViceCharacter(group.tenant_id, group.group_id, sender, {
      credits: updated.credits - cost
    })

    return `🚔 Bailed out for *${cost} XC*.`
  }
)

/* ─────────────────────── */
/* VICE — territory wars                                                      */
/* ─────────────────────── */

register(
  'war',
  {
    category: 'economy',
    description: '⚔️ Territory wars — declare, attack, status',
    usage: '.war <declare|attack|status|list> [args]'
  },
  async ({ runtime, group, sender, args }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const sub = String(args[0] || 'status').toLowerCase()

    try {
      const resolved = autoResolveExpiredWars(group.tenant_id, group.group_id)
      for (const r of resolved) {
        await runtime.safeSendMessage(
          group.group_id,
          {
            text: [
              '⚔️ *WAR RESOLVED*',
              '',
              r.isDraw
                ? '🤝 The war ended in a draw.'
                : `🏆 *${r.winner?.name}* defeated *${r.loser?.name}*.`,
              r.territory ? `\n🏙️ Territory claimed: *${r.territory.name}*` : '',
              '',
              `Final score: ${r.attackerScore} vs ${r.defenderScore}`
            ]
              .filter(Boolean)
              .join('\n')
          },
          { label: 'war resolution' }
        )
      }
    } catch (err) {
      console.warn('[WAR] auto-resolve failed:', err?.message || err)
    }

    if (sub === 'declare') {
      const crewName = args[1]
      const territoryId = args[2] || null

      if (!crewName) {
        return [
          '⚔️ *DECLARE WAR*',
          '',
          'Usage: `.war declare <crew name> [territory]`',
          '',
          'Territories:',
          '  downtown · neon · docks · oldtown · heights · casino'
        ].join('\n')
      }

      const result = declareWar(group.group_id, sender, crewName, territoryId)

      if (result.error) return `❌ ${result.error}`

      const { attacker, defender, territory } = result

      await runtime.safeSendMessage(
        group.group_id,
        {
          text: [
            '⚔️ *WAR DECLARED*',
            '',
            `*${attacker.name}* → *${defender.name}*`,
            territory ? `\n🏙️ Fighting over: *${territory.name}*` : '',
            '',
            `Duration: ${WAR_DURATION_HOURS} hours`,
            'Contribute with `.war attack`.'
          ]
            .filter(Boolean)
            .join('\n')
        },
        { label: 'war declared' }
      )

      return null
    }

    if (sub === 'attack') {
      const result = warAttack(group.tenant_id, group.group_id, sender)

      if (result.error) return `❌ ${result.error}`

      const { war, damage, side } = result
      const attacker = getViceFaction(war.attacker_faction_id)
      const defender = getViceFaction(war.defender_faction_id)
      const yourColor = side === 'attacker' ? attacker : defender

      return [
        '⚔️ *WAR ATTACK*',
        '',
        `You struck for *${damage} damage* as *${yourColor.name}*.`,
        `+${result.xp} XP`,
        result.leveled
          ? `🎉 *LEVEL UP!* You are now Level ${result.level}.`
          : null,
        '',
        `Score: *${attacker.name}* ${war.attacker_score} — ${war.defender_score} *${defender.name}*`
      ]
        .filter(Boolean)
        .join('\n')
    }

    if (sub === 'status') {
      const result = warStatus(group.tenant_id, group.group_id, sender)

      if (result.error) return `❌ ${result.error}`

      const { war, attacker, defender, territory, participants, timeRemaining } = result

      try {
        const card = await warCard({
          attackerName: attacker.name,
          defenderName: defender.name,
          attackerScore: war.attacker_score,
          defenderScore: war.defender_score,
          territoryName: territory?.name || 'Unclaimed Territory',
          hoursRemaining: timeRemaining.hours,
          minutesRemaining: timeRemaining.minutes
        })

        await runtime.sendImage(group.group_id, card, '', [])

        if (participants.length) {
          const top = participants.slice(0, 5).map((p, i) => {
            const name = runtime.getMemberDisplayName(
              group.group_id,
              p.jid,
              'Member'
            )
            return `${i + 1}. ${name} — ${p.damage} dmg · ${p.attacks} attacks`
          })

          await runtime.safeSendMessage(
            group.group_id,
            {
              text: ['⚔️ *TOP CONTRIBUTORS*', '', ...top].join('\n')
            },
            { label: 'war contributors' }
          )
        }

        return null
      } catch (error) {
        console.error('[WAR] card failed:', error?.message || error)

        return [
          '⚔️ *WAR STATUS*',
          '',
          `*${attacker.name}*: ${war.attacker_score}`,
          `*${defender.name}*: ${war.defender_score}`,
          territory ? `\n🏙️ Territory: ${territory.name}` : '',
          `\n⏳ Time left: ${timeRemaining.hours}h ${timeRemaining.minutes}m`
        ]
          .filter(Boolean)
          .join('\n')
      }
    }

    if (sub === 'list') {
      const { listActiveWars } = await import('./db.mjs')
      const wars = listActiveWars(group.group_id)

      if (!wars.length) return '🕊️ No active wars in this group.'

      const lines = wars.map((war) => {
        const atk = getViceFaction(war.attacker_faction_id)
        const def = getViceFaction(war.defender_faction_id)

        return `⚔️ *${atk?.name || '?'}* ${war.attacker_score} — ${war.defender_score} *${def?.name || '?'}*`
      })

      return ['⚔️ *ACTIVE WARS*', '', ...lines].join('\n')
    }

    return [
      '⚔️ *WAR COMMANDS*',
      '',
      '`.war declare <crew> [territory]` — leader only, costs 10,000 XC',
      '`.war attack` — contribute damage to the war',
      '`.war status` — live scoreboard',
      '`.war list` — all active wars',
      '',
      'Territories: downtown · neon · docks · oldtown · heights · casino'
    ].join('\n')
  }
)

register(
  'territories',
  {
    category: 'economy',
    description: '🏙️ Show all territory ownership',
    usage: '.territories'
  },
  async ({ group }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const territories = (await import('./db.mjs')).listViceTerritories()

    const lines = territories.map((t) => {
      const owner = t.current_owner_faction_id
        ? getViceFaction(t.current_owner_faction_id)
        : null

      const ownerLabel = owner ? `👑 ${owner.name}` : '— unclaimed'

      const bonus =
        t.bonus_type === 'credits'
          ? `+${Math.round(t.bonus_value * 100)}% credits`
          : t.bonus_type === 'heist'
          ? `+${Math.round(t.bonus_value * 100)}% heist payout`
          : t.bonus_type === 'strength'
          ? `+${Math.round(t.bonus_value * 100)}% STR`
          : t.bonus_type === 'tech'
          ? `+${Math.round(t.bonus_value * 100)}% TECH`
          : t.bonus_type === 'aura'
          ? `+${t.bonus_value} AU weekly`
          : t.bonus_type === 'luck'
          ? `+${Math.round(t.bonus_value * 100)}% luck`
          : t.bonus_type

      return [
        `${t.name}`,
        `   ${t.description}`,
        `   Bonus: _${bonus}_`,
        `   Owner: ${ownerLabel}`
      ].join('\n')
    })

    return [
      '🏙️ *TERRITORIES*',
      '',
      ...lines,
      '',
      'Win wars to claim. `.war declare <crew> <territory>`'
    ].join('\n\n')
  }
)

/* ─────────────────────── */
/* VICE — crews                                                               */
/* ─────────────────────── */

register(
  'crew',
  {
    category: 'economy',
    description: '🏴 Manage your crew',
    usage: '.crew [create|join|leave|info|deposit|withdraw|promote|list] [args]'
  },
  async ({ runtime, group, sender, args, mentions }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const sub = String(args[0] || 'info').toLowerCase()

    if (sub === 'info' || !sub) {
      const overview = crewOverview(group.tenant_id, group.group_id, sender)

      if (!overview) {
        return [
          '🏴 *NO CREW*',
          '',
          'You are not in a crew.',
          '',
          `Create one: \`.crew create <name>\` — costs ${CREW_CREATE_COST.toLocaleString()} XC`,
          'Join one:   `.crew join <name>`',
          'Browse:     `.crew list`'
        ].join('\n')
      }

      const { faction, members } = overview

      try {
        const leaderChar = members.find((m) => m.role === 'leader')

        const leaderName = leaderChar
          ? runtime.getMemberDisplayName(group.group_id, leaderChar.jid, 'Unknown')
          : 'Unknown'

        const card = await crewCard({
          name: faction.name,
          level: faction.level,
          reputation: faction.reputation,
          bank: faction.bank,
          warsWon: faction.wars_won,
          warsLost: faction.wars_lost,
          leaderName,
          memberCount: members.length,
          maxMembers: CREW_MAX_MEMBERS
        })

        await runtime.sendImage(group.group_id, card, '', [])

        const roster = members
          .map((m) => {
            const name = runtime.getMemberDisplayName(
              group.group_id,
              m.jid,
              'Member'
            )

            const roleEmoji =
              m.role === 'leader'
                ? '👑'
                : m.role === 'officer'
                ? '🎖️'
                : m.role === 'recruit'
                ? '🔸'
                : '▸'

            return `${roleEmoji} ${name} — L${m.level} · ${m.kills}K`
          })
          .join('\n')

        await runtime.safeSendMessage(
          group.group_id,
          {
            text: [
              `🏴 *${faction.name.toUpperCase()}*`,
              '',
              `Members (${members.length}/${CREW_MAX_MEMBERS}):`,
              roster
            ].join('\n')
          },
          { label: 'crew roster' }
        )

        return null
      } catch (error) {
        console.error('[VICE] crew card failed:', error?.message || error)

        return [
          `🏴 *${faction.name}*`,
          `Level ${faction.level} · Rep ${faction.reputation}`,
          `Bank: ${faction.bank.toLocaleString()} XC`,
          `Members: ${members.length}/${CREW_MAX_MEMBERS}`,
          `Wars: ${faction.wars_won}W / ${faction.wars_lost}L`,
          '',
          members.map((m) => `▸ ${m.role}: ${m.jid.split('@')[0]}`).join('\n')
        ].join('\n')
      }
    }

    if (sub === 'create') {
      const name = args.slice(1).join(' ').trim()

      if (!name) return 'Usage: `.crew create <name>`'

      const result = createCrew(group.tenant_id, group.group_id, sender, name)

      if (result.error) return `❌ ${result.error}`

      return [
        `🏴 *${result.faction.name}* created.`,
        `−${result.cost.toLocaleString()} XC`,
        '',
        'Recruit members with:',
        `  They can \`.crew join ${result.faction.name}\` to join.`
      ].join('\n')
    }

    if (sub === 'join') {
      const name = args.slice(1).join(' ').trim()

      if (!name) return 'Usage: `.crew join <name>`'

      const result = joinCrew(group.tenant_id, group.group_id, sender, name)

      if (result.error) return `❌ ${result.error}`

      return `✅ Joined *${result.faction.name}*.`
    }

    if (sub === 'leave') {
      const result = leaveCrew(group.tenant_id, group.group_id, sender)

      if (result.error) return `❌ ${result.error}`

      if (result.type === 'crew_disband') {
        return `🏴 *${result.faction.name}* disbanded (last member left).`
      }

      return `👋 Left *${result.faction.name}*.`
    }

    if (sub === 'list') {
      const factions = crewLeaderboard(group.tenant_id, group.group_id)

      if (!factions.length) return '📭 No crews in this group yet.'

      return [
        '🏴 *CREW LEADERBOARD*',
        '',
        ...factions.map(
          (f, i) =>
            `${i + 1}. *${f.name}* — L${f.level} · ${f.reputation} rep · ${f.bank.toLocaleString()} XC`
        )
      ].join('\n')
    }

    if (sub === 'deposit') {
      const amount = Number(args[1])

      if (!amount) return 'Usage: `.crew deposit <amount>`'

      const result = crewDeposit(group.tenant_id, group.group_id, sender, amount)

      if (result.error) return `❌ ${result.error}`

      return [
        `💰 Deposited *${result.amount.toLocaleString()} XC* into crew bank.`,
        `Crew bank: ${result.newBank.toLocaleString()} XC`
      ].join('\n')
    }

    if (sub === 'withdraw') {
      const amount = Number(args[1])

      if (!amount) return 'Usage: `.crew withdraw <amount>`'

      const result = crewWithdraw(group.tenant_id, group.group_id, sender, amount)

      if (result.error) return `❌ ${result.error}`

      return [
        `💰 Withdrew *${result.amount.toLocaleString()} XC* from crew bank.`,
        `Crew bank: ${result.newBank.toLocaleString()} XC`
      ].join('\n')
    }

    if (sub === 'invite') {
      const target = mentions?.[0]

      if (!target) return 'Usage: `.crew invite @user`'

      const result = inviteCrewMember(group.tenant_id, group.group_id, sender, target)

      if (result.error) return `❌ ${result.error}`

      const targetName = runtime.getMemberDisplayName(
        group.group_id,
        target,
        'Member'
      )

      return `📩 *${targetName}* was invited to *${result.faction.name}*.`
    }

    if (sub === 'promote' || sub === 'demote') {
      const target = mentions?.[0]

      if (!target) return `Usage: \`.crew ${sub} @user\``

      const role = sub === 'promote' ? 'officer' : 'member'

      const result = setCrewMemberRole(
        group.tenant_id,
        group.group_id,
        sender,
        target,
        role
      )

      if (result.error) return `❌ ${result.error}`

      return `✅ ${sub === 'promote' ? 'Promoted' : 'Demoted'} to *${role}*.`
    }

    return [
      '🏴 *CREW COMMANDS*',
      '',
      '`.crew info` — your crew dashboard',
      `\`.crew create <name>\` — new crew (costs ${CREW_CREATE_COST.toLocaleString()} XC)`,
      '`.crew join <name>` — join a crew',
      '`.crew leave` — leave your crew',
      '`.crew list` — all crews in the group',
      '`.crew deposit <amount>` — fund the crew bank',
      '`.crew withdraw <amount>` — leader/officer only',
      '`.crew promote @user` — leader only',
      '`.crew demote @user` — leader only'
    ].join('\n')
  }
)

/* ─────────────────────── */
/* VICE — missions                                                            */
/* ─────────────────────── */

register(
  'mission',
  {
    category: 'economy',
    description: '🎯 Run a mission',
    usage: '.mission [list|run <id>]'
  },
  async ({ group, sender, args }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const char = loadCharacter(group.tenant_id, group.group_id, sender)
    if (!char) return '❌ No character.'

    const sub = String(args[0] || 'list').toLowerCase()

    if (sub === 'list') {
      const missions = listMissions(char)

      const lines = missions.map((m) => {
        const lock = m.locked ? ' 🔒' : ''
        return [
          `▸ *${m.title}*${lock}`,
          `   _${m.brief}_`,
          `   Cost: ${m.energy}⚡ · Reward: ${m.reward.credits[0]}–${m.reward.credits[1]} XC · ${m.reward.xp} XP`,
          `   ID: \`${m.id}\``
        ].join('\n')
      })

      return [
        '🎯 *TIER 1 MISSIONS*',
        '',
        ...lines,
        '',
        'Run with `.mission run <id>`'
      ].join('\n\n')
    }

    if (sub === 'run') {
      const missionId = args[1]
      if (!missionId) return 'Usage: `.mission run <id>`'

      const result = runMission(
        group.tenant_id,
        group.group_id,
        sender,
        missionId
      )

      if (result.error) return `❌ ${result.error}`

      if (result.type === 'mission_fail') {
        return [
          `❌ *${result.mission.title}* — FAILED`,
          '',
          `_${result.flavor}_`,
          '',
          'No reward. Cooldown starts.'
        ].join('\n')
      }

      return [
        `🎯 *${result.mission.title}* — SUCCESS`,
        '',
        `💰 +${result.credits.toLocaleString()} XC`,
        `⭐ +${result.xp} XP`,
        result.leveled
          ? `🎉 *LEVEL UP!* You are now Level ${result.level}.`
          : null
      ]
        .filter(Boolean)
        .join('\n')
    }

    return [
      '🎯 *MISSIONS*',
      '',
      '`.mission list` — see available missions',
      '`.mission run <id>` — attempt a mission'
    ].join('\n')
  }
)

register(
  'season',
  {
    category: 'economy',
    description: '📅 Current VICE season',
    usage: '.season'
  },
  async ({ group }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const status = seasonStatus(group.tenant_id, group.group_id)

    const lines = status.ranked
      .slice(0, 10)
      .map(
        (f, i) =>
          `${i + 1}. *${f.name}* — ${f.score} pts · L${f.level} · ${f.reputation} rep`
      )

    return [
      `📅 *SEASON ${status.season.season_number}*`,
      '',
      `⏳ Ends in ${status.days}d ${status.hours}h`,
      '',
      '🏆 *STANDINGS*',
      '',
      ...(lines.length ? lines : ['_No crews yet._']),
      '',
      'New season resets every 14 days. Territory ownership persists.'
    ].join('\n')
  }
)

/* ───────────────────────
   VICE — dashboard
   ─────────────────────── */

register(
  'vice',
  {
    category: 'economy',
    description: '💼 Your X: VICE character dashboard',
    usage: '.vice'
  },
  async ({ runtime, group, sender }) => {
    if (!group?.group_id) return 'This command can only be used inside a group.'

    const char = loadCharacter(group.tenant_id, group.group_id, sender)
    if (!char) return '❌ Could not load your character.'

    const name = runtime.getMemberDisplayName(group.group_id, sender, 'Operator')

    let factionName = null
    try {
      const fac = factionOf(group.tenant_id, group.group_id, sender)
      if (fac) factionName = fac.name
    } catch {}

    let avatarUrl = null
    try {
      avatarUrl = await runtime.getMemberAvatarUrl(sender)
    } catch {}

    try {
      const auraResult = tickAura(group.tenant_id, group.group_id, sender)
      if (auraResult) {
        await runtime.safeSendMessage(
          group.group_id,
          {
            text: `✨ Territory Aura granted: *+${auraResult.granted} AU*`
          },
          { label: 'aura tick' }
        )
      }
    } catch {}

    try {
      const card = await viceCard({
        name,
        level: char.level,
        xp: char.xp,
        hp: char.hp,
        maxHp: char.max_hp,
        energy: char.energy,
        maxEnergy: char.max_energy,
        nerve: char.nerve,
        maxNerve: char.max_nerve,
        strength: char.strength,
        agility: char.agility,
        tech: char.tech,
        cool: char.cool,
        credits: char.credits,
        bank: char.bank,
        aura: char.aura,
        kills: char.kills,
        deaths: char.deaths,
        robberies: char.robberies,
        busted: char.busted,
        career: char.career || 'none',
        factionName,
        hospitalUntil: char.hospital_until,
        jailUntil: char.jail_until,
        avatarUrl
      })

      await runtime.sendImage(group.group_id, card, '', [])

      return null
    } catch (error) {
      console.error('[VICE] card failed:', error?.message || error)

      return [
        `💼 *${name}*`,
        '',
        `Level ${char.level} · ${char.xp}/${char.level * 100} XP`,
        `Career: ${char.career || 'none'}`,
        `HP: ${char.hp}/${char.max_hp}`,
        `Energy: ${char.energy}/${char.max_energy}`,
        `Nerve: ${char.nerve}/${char.max_nerve}`,
        '',
        `STR ${char.strength} · AGI ${char.agility} · TECH ${char.tech} · COOL ${char.cool}`,
        '',
        `${char.credits.toLocaleString()} XC · Bank ${char.bank.toLocaleString()} · Aura ${char.aura}`,
        factionName ? `Crew: ${factionName}` : ''
      ]
        .filter(Boolean)
        .join('\n')
    }
  }
)

register(
  'vicehelp',
  {
    category: 'economy',
    description: '📖 How to play X: VICE',
    usage: '.vicehelp'
  },
  async ({ runtime, group, sender }) => {
    const name = group?.group_id
      ? runtime.getMemberDisplayName(group.group_id, sender, 'Operator')
      : 'Operator'

    const prefix = group?.prefix || process.env.X_DEFAULT_PREFIX || '.'

    return [
      `╭━━〔 ⚡ X: VICE 〕━━╮`,
      `┃ 📖  Getting Started`,
      `╰━━━━━━━━━━━━━━━━━━╯`,
      ``,
      `Welcome, *${name}*. This is a persistent crime RPG`,
      `that runs inside this group.`,
      ``,
      `Start with: *${prefix}vice*`
    ].join('\n')
  }
)

/* ───────────────────────
   GAMES
   ─────────────────────── */

register(
  'games',
  {
    category: 'games',
    description: 'Show available games'
  },
  async () =>
    [
      `🎮 *X GAMES*`,
      ``,
      `.coinflip heads|tails`,
      `.dice [sides]`,
      `.rps rock|paper|scissors`,
      `.tictactoe 1-9`,
      `.connect4 1-7`,
      `.quiz [answer]`,
      `.wordle <guess>`,
      `.hangman <letter>`
    ].join('\n')
)

const EXTENDED_GAMES = [
  { name: 'truth', description: '🎭 Ask a truth question' },
  { name: 'dare', description: '🔥 Issue a dare challenge' },
  { name: 'wyr', description: '⚖️ Would You Rather' },
  { name: 'nhie', description: '🙈 Never Have I Ever' },
  { name: 'trivia', description: '🧠 Multiple-choice trivia' },
  { name: 'duel', description: '⚔️ PvP duel with a member' },
  { name: 'bet', description: '🎰 Wager coins on a coin flip' },
  { name: 'slots', description: '🎰 Spin the slot machine (20 KC)' },
  { name: 'scramble', description: '🔤 Unscramble a word' },
  { name: 'number', description: '🔢 Guess a number 1–100' },
  { name: 'ship', description: '💘 Ship meter for two users' },
  { name: 'match', description: '💘 Match compatibility meter' },
  { name: 'enemy', description: '⚔️ Rivalry meter between users' },
  { name: 'vs', description: '🥊 Battle two users head-to-head' },
  { name: 'shipname', description: '💕 Generate a couple ship name' }
]

for (const game of EXTENDED_GAMES) {
  register(
    game.name,
    {
      category: 'games',
      description: game.description,
      usage: `.${game.name} [choice]`
    },
    async ({ runtime, group, sender, args, mentions }) =>
      formatGame(
        playGameVisual({
          tenantId: group.tenant_id,
          groupId: group.group_id,
          type: game.name,
          playerJid: sender,
          choice: args.join(' '),
          runtime,
          group,
          mentions
        }),
        runtime,
        group.group_id
      )
  )
}

for (const type of [
  'coinflip',
  'dice',
  'rps',
  'tictactoe',
  'connect4',
  'quiz',
  'wordle',
  'hangman'
]) {
  register(
    type,
    {
      category: 'games',
      description: `Play ${type}`,
      usage: `.${type} [choice]`
    },
    async ({ runtime, group, sender, args }) =>
      formatGame(
        playGameVisual({
          tenantId: group.tenant_id,
          groupId: group.group_id,
          type,
          playerJid: sender,
          choice: args.join(' ')
        }),
        runtime,
        group.group_id
      )
  )
}

function formatGame(result, runtime = null, groupId = null) {
  if (!result) return 'No result.'
  if (result.error) return result.error
  if (result.prompt) return result.prompt

  if (result.type === 'coinflip') {
    return (
      `🪙 *${result.result.toUpperCase()}*` +
      (result.choice
        ? `\n${result.win ? '🎉 You win +10 KC!' : '💥 You lose 5 KC.'}`
        : '\nUse .coinflip heads|tails to wager.')
    )
  }

  if (result.type === 'dice')
    return `🎲 Rolled *${result.result}* on d${result.sides}.`

  if (result.type === 'rps') {
    return [
      `✊ You: ${result.user}`,
      `X: ${result.bot}`,
      result.win === true
        ? '🏆 Win +20 KC'
        : result.win === false
        ? '💥 Loss -5 KC'
        : '🤝 Draw +5 KC'
    ].join('\n')
  }

  if (result.type === 'quiz') {
    return (
      result.prompt ||
      [
        `🧠 ${result.correct ? 'Correct! +30 KC' : 'Not quite.'}`,
        result.question || `Answer: ${result.answer}`
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  if (result.type === 'wordle') {
    return (
      result.prompt ||
      [
        `🔤 ${result.win ? 'Solved!' : 'Try again.'}`,
        result.pattern || '',
        result.word ? `Word: ${result.word}` : ''
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  if (result.type === 'hangman') {
    return (
      result.prompt ||
      [
        `🪢 ${result.display}`,
        `Misses: ${result.misses}/6`,
        result.win ? '🏆 Solved!' : '',
        result.word && !result.win ? `Word: ${result.word}` : ''
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  if (result.type === 'trivia') {
    if (result.prompt) return result.prompt
    return result.correct
      ? `✅ Correct! +${result.reward} KC`
      : `❌ Wrong. Answer was *${result.answer}*.`
  }

  if (
    result.type === 'scramble' ||
    result.type === 'number' ||
    result.type === 'slots' ||
    result.type === 'bet' ||
    result.type === 'duel' ||
    result.type === 'truth' ||
    result.type === 'dare' ||
    result.type === 'wyr' ||
    result.type === 'nhie' ||
    result.type === 'ship' ||
    result.type === 'confess' ||
    result.type === 'poll' ||
    result.type === 'match' ||
    result.type === 'enemy' ||
    result.type === 'vs' ||
    result.type === 'shipname'
  ) {
    return result.prompt || ''
  }

  if (result.board) {
    const size = result.type === 'tictactoe' ? 3 : 7
    const boardText = result.board
      .flat()
      .map((v, i) => v || String(i + 1))
      .reduce(
        (txt, v, i) => txt + ((i + 1) % size === 0 ? v + '\n' : v + ' '),
        ''
      )

    if (result.winner || result.draw) {
      return `❌⭕\n${boardText}\n${
        result.winner ? '🏆 Winner!' : '🤝 Draw.'
      }`
    }

    const turn =
      runtime && groupId && result.turn
        ? createMention(result.turn)
        : { text: '', jid: null }

    return {
      text: `❌⭕\n${boardText}\nTurn: ${turn.text || 'A member'}`,
      mentions: turn.jid ? [turn.jid] : []
    }
  }

  return 'Done.'
}

/* ───────────────────────
   ANIME
   ─────────────────────── */

register(
  'anime',
  {
    category: 'anime',
    description: 'Search anime',
    usage: '.anime <title> | .anime pick <number>'
  },
  async ({ group, sender, args }) => {
    if (!group?.group_id) return 'Use inside a group.'

    const key = `${group.group_id}:${sender}`
    const [subcommand, ...rest] = args
    let anime
    let resultList = ''

    if (String(subcommand || '').toLowerCase() === 'pick') {
      const pending = pendingAnime.get(key)
      const index = Number.parseInt(rest[0] || '', 10)

      if (!pending) return '🎌 Search for an anime first with `.anime <title>`.'
      if (!Number.isInteger(index) || index < 1 || index > pending.length) {
        return `🎌 Choose a result from 1 to ${pending.length}.`
      }

      anime = pending[index - 1]
    } else {
      const title = args.join(' ').trim()
      if (!title) return 'Usage: `.anime <title> | .anime pick <number>`'

      let rows = await anilistSearch(title)

      if (!rows.length) {
        try {
          rows = await animeSearch(title)
        } catch (error) {
          console.warn('[X ANIME] Jikan fallback failed:', error?.message || error)
          return '🎌 Anime search is unavailable right now.'
        }
      }

      if (!rows.length) return 'No anime results found.'

      anime = rows[0]
      const savedRows = rows.slice(0, 5)
      pendingAnime.set(key, savedRows)
      setTimeout(() => {
        if (pendingAnime.get(key) === savedRows) {
          pendingAnime.delete(key)
        }
      }, 600000)

      resultList = savedRows
        .map((row, index) => `${index + 1}. ${row.title}`)
        .join('\n')
    }

    const synopsis = String(anime.synopsis || 'No synopsis available.')
      .replace(/<[^>]*>/g, '')
      .slice(0, 500)
    const titleLine = anime.english && anime.romaji &&
      anime.english !== anime.romaji
      ? `🎌 *${anime.english}* (${anime.romaji})`
      : `🎌 *${anime.title}*`
    const imageUrl = anime.bannerImage || anime.image
    let details = [
      titleLine,
      anime.year ? `📅 ${anime.year}` : null,
      `📺 ${anime.episodes ?? '?'} episodes${anime.duration ? ` · ${anime.duration} min/ep` : ''}`,
      `📌 ${anime.status || 'Unknown'}`,
      anime.score != null ? `⭐ ${anime.score}/10` : null,
      anime.genres?.length ? `🎭 ${anime.genres.join(', ')}` : null,
      anime.studios?.length ? `🏢 ${anime.studios.join(', ')}` : null,
      imageUrl ? `🖼️ ${imageUrl}` : null,
      '',
      synopsis,
      anime.trailerUrl ? `\n▶️ ${anime.trailerUrl}` : null
    ].filter(Boolean).join('\n')

    if (resultList) {
      details = [
        details,
        '',
        'Other results — use `.anime pick <number>`:',
        resultList
      ].join('\n')
    }

    if (details.length > 3500) {
      const synopsisOffset = details.indexOf(synopsis)
      if (synopsisOffset !== -1) {
        const excess = details.length - 3500
        const shorterSynopsis = synopsis.slice(
          0,
          Math.max(0, synopsis.length - excess - 1)
        ).trimEnd() + '…'
        details =
          details.slice(0, synopsisOffset) +
          shorterSynopsis +
          details.slice(synopsisOffset + synopsis.length)
      }
    }

    return details.slice(0, 3500)
  }
)

register(
  'animequote',
  {
    category: 'anime',
    description: 'Random anime quote'
  },
  async () => `🎌 ${await animeQuote()}`
)

/* ───────────────────────
   MOVIE
   ─────────────────────── */

register(
  'movie',
  {
    category: 'media',
    reaction: '🎬',
    description:
      '🎬 Request a movie — search, preview, pick resolution, download or stream',
    usage:
      '.movie <title> | .movie 1 | .movie D | .movie T | .movie cancel'
  },
  async ({ runtime, group, sender, args }) => {
    if (!group?.group_id) {
      return 'Use inside a group.'
    }

    const raw = args.join(' ').trim()

    if (!raw) {
      return [
        '🎬 *X MOVIE*',
        '',
        'Usage: `.movie <title>`',
        '',
        'Examples:',
        '  `.movie Inception`',
        '  `.movie Night of the Living Dead 1968`',
        '  `.movie Spirited Away`'
      ].join('\n')
    }

    const lower = raw.toLowerCase()

    /* ───────────────────────
     * .movie cancel
     * ─────────────────────── */
    if (lower === 'cancel') {
      clearPendingMovie(group.group_id, sender)
      return '🎬 Movie request cancelled.'
    }

    /* ───────────────────────
     * Resolution / source selection
     * ─────────────────────── */
    const pending = getPendingMovie(group.group_id, sender)

    if (pending) {
      /* Trailer */
      if (lower === 't' || lower === 'trailer') {
        clearPendingMovie(group.group_id, sender)

        if (!pending.movie.trailerUrl) {
          return '🎬 No trailer available for this title.'
        }

        return [
          '🎬 *TRAILER*',
          '',
          `*${pending.movie.title}*`,
          '',
          pending.movie.trailerUrl
        ].join('\n')
      }

      /* Download best available */
      if (lower === 'd' || lower === 'download') {
        if (!pending.sources.length) {
          clearPendingMovie(group.group_id, sender)
          return '🎬 No downloadable source found for this title.'
        }

        const source = pending.sources[0]

        await runtime.safeSendMessage(
          group.group_id,
          {
            text: [
              '🎬 *DOWNLOADING*',
              '',
              `*${pending.movie.title}*`,
              `Source: Archive.org`,
              `Cap: ${movieConfig.MAX_MB} MB`,
              '',
              'This may take a few minutes…'
            ].join('\n')
          },
          { label: 'movie download start' }
        )

        try {
          const result = await downloadMovie(pending.movie, source.streamUrl)

          await runtime.safeSendMessage(
            group.group_id,
            {
              document: result.buffer,
              mimetype: 'video/mp4',
              fileName: result.fileName,
              caption: [
                `🎬 *${pending.movie.title}*`,
                pending.movie.year ? `📅 ${pending.movie.year}` : null,
                pending.movie.rating ? `⭐ ${pending.movie.rating}/10` : null,
                `📦 ${result.sizeMb} MB`
              ]
                .filter(Boolean)
                .join('\n')
            },
            { label: 'movie download result' }
          )

          await result.cleanup()
          clearPendingMovie(group.group_id, sender)

          return null
        } catch (error) {
          clearPendingMovie(group.group_id, sender)

          const code = String(error?.code || error?.message || '')

          if (code === 'FILE_TOO_LARGE') {
            return [
              '🎬 *FILE TOO LARGE*',
              '',
              `The file exceeds the ${movieConfig.MAX_MB} MB WhatsApp cap.`,
              '',
              'Open in a browser instead:',
              source.streamUrl
            ].join('\n')
          }

          if (code === 'DOWNLOAD_TIMEOUT') {
            return '🎬 Download timed out. Try again or use the stream link.'
          }

          if (code === 'EMPTY_OUTPUT') {
            return '🎬 Download produced an empty file.'
          }

          return ['🎬 *DOWNLOAD FAILED*', '', 'Stream instead:', source.streamUrl].join('\n')
        }
      }

      /* Numeric source pick */
      const numeric = parseInt(lower, 10)

      if (
        Number.isFinite(numeric) &&
        numeric >= 1 &&
        numeric <= pending.sources.length
      ) {
        const source = pending.sources[numeric - 1]

        clearPendingMovie(group.group_id, sender)

        return [
          '🎬 *SOURCE LINK*',
          '',
          `*${pending.movie.title}*`,
          '',
          `▶️ Play / download:`,
          source.streamUrl,
          '',
          `📄 ${source.fileName}`,
          source.sizeMb ? `📦 ${source.sizeMb} MB` : null,
          `🔗 Item page: ${source.itemPage}`,
          '',
          '_Tap the link to open in your browser._'
        ]
          .filter(Boolean)
          .join('\n')
      }

      return [
        '🎬 Pick a valid option.',
        '',
        buildResolutionMenu(pending.movie, pending.sources)
      ].join('\n')
    }

    /* ───────────────────────
     * New search
     * ─────────────────────── */
    let movie

    try {
      movie = await searchMovie(raw)
    } catch (error) {
      if (String(error?.message) === 'MOVIE_NOT_FOUND') {
        return `🎬 No results for *${raw}*.`
      }

      return `🎬 Search failed: ${error?.message || 'unknown error'}`
    }

    const overview = movie.overview
      ? movie.overview.length > 400
        ? movie.overview.slice(0, 400).trimEnd() + '…'
        : movie.overview
      : null

    const metaLines = [
      `🎬 *${movie.title.toUpperCase()}*`,
      movie.year ? `📅 ${movie.year}` : null,
      movie.runtime ? `⏱️ ${movie.runtime} min` : null,
      movie.rating ? `⭐ ${movie.rating}/10` : null,
      movie.genres ? `🎭 ${movie.genres}` : null,
      movie.tagline ? `\n_${movie.tagline}_` : null,
      '',
      overview,
      ''
    ].filter(Boolean)

    /* Fetch stream sources from archive.org */
    const sources = await findMovieSources(movie)

    /* JustWatch fallback — only fires when archive has nothing */
    let jwBlock = null

    if (!sources.length) {
      try {
        const jw = await justWatchOffers(movie.title, movie.year)
        jwBlock = buildJustWatchBlock(jw)
      } catch (error) {
        console.warn(
          '[X MOVIE] JustWatch fallback failed:',
          error?.message || error
        )
      }
    }

    setPendingMovie(group.group_id, sender, {
      movie,
      sources
    })

    /* Build the source menu */
    const menu = buildResolutionMenu(movie, sources)

    const text = [
      ...metaLines,
      '━━━━━━━━━━━━━━━━━━━━━━',
      '',
      menu,
      jwBlock
        ? '\n╔══════════════════════════════╗\n' +
          '║   ◈  W H E R E   T O   W A T C H   ◈   ║\n' +
          '╚══════════════════════════════╝\n\n' +
          jwBlock
        : null
    ]
      .filter(Boolean)
      .join('\n')

    if (movie.poster) {
      try {
        const res = await fetch(movie.poster, {
          signal: AbortSignal.timeout(15000)
        })

        if (res.ok) {
          const posterBuf = Buffer.from(await res.arrayBuffer())

          await runtime.sendImage(group.group_id, posterBuf, text)

          return null
        }
      } catch (error) {
        console.warn('[X MOVIE] poster fetch failed:', error?.message || error)
      }
    }

    return text
  }
)

/* ───────────────────────
   LYRICS
   ─────────────────────── */

register(
  'lyrics',
  {
    category: 'media',
    reaction: '🎤',
    description: 'Search for a song and return cleaned lyrics with a thumbnail',
    usage: '.lyrics <song> [ - artist]'
  },
  async ({ args, runtime, group }) => {
    const query = args.join(' ').trim()

    if (!query) {
      return [
        '🎤 *X LYRICS — KAIN MODE*',
        '',
        'Usage: `.lyrics <song> [ - artist]`',
        '',
        'Examples:',
        '  `.lyrics Blinding Lights - The Weeknd`',
        '  `.lyrics Adele - Hello`',
        '  `.lyrics Shape of You`'
      ].join('\n')
    }

    let video
    try {
      const searchResults = await yts(query)
      video = searchResults?.videos?.[0]
    } catch (error) {
      console.warn('[X LYRICS] YouTube search failed:', error?.message || error)
    }

    const cleanMetadata = (value) => String(value || '')
      .replace(/\s+[|•]\s+.*$/, '')
      .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
      .replace(/\b(?:official(?:\s+(?:music\s+)?(?:video|audio))?|music\s+video|video|audio|lyrics?|hd|4k)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    let title = cleanMetadata(video?.title || query) || cleanMetadata(query)
    let artist = cleanMetadata(video?.author?.name || '')
      .replace(/\s+-\s+topic$/i, '')
      .trim()

    const titleParts = title
      .split(/\s+[-–—]\s+/)
      .map(cleanMetadata)
      .filter(Boolean)
    if (titleParts.length > 1) {
      const artistIndex = artist
        ? titleParts.findIndex((part) => part.toLowerCase() === artist.toLowerCase())
        : -1

      if (artistIndex >= 0) {
        artist = titleParts[artistIndex]
        title = titleParts.filter((_, index) => index !== artistIndex).join(' - ')
      } else if (!artist) {
        artist = titleParts[0]
        title = titleParts.slice(1).join(' - ')
      }
    }

    const geniusToken = process.env.GENIUS_ACCESS_TOKEN
    if (!geniusToken) {
      return '❌ Genius lyrics search is unavailable: GENIUS_ACCESS_TOKEN is not configured.'
    }

    const geniusOptions = {
      title,
      artist,
      apiKey: geniusToken,
      optimizeQuery: true
    }
    let song
    try {
      song = await getSong(geniusOptions)
    } catch (error) {
      console.warn('[X LYRICS] Genius song lookup failed:', error?.message || error)
    }

    let lyrics = String(song?.lyrics || '').trim()
    let albumArt = song?.albumArt || ''
    if (!lyrics) {
      try {
        const searchResults = await searchSong(geniusOptions)
        const match = searchResults?.[0]
        if (match?.url) {
          const songUrl = new URL(match.url)
          if (
            songUrl.protocol !== 'https:' ||
            !/(^|\.)genius\.com$/i.test(songUrl.hostname)
          ) {
            throw new Error('Genius returned an invalid song URL')
          }

          const response = await fetch(songUrl.toString(), {
            headers: { 'user-agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(15000)
          })
          if (!response.ok) {
            throw new Error(`Genius page request failed with status ${response.status}`)
          }

          const html = await response.text()
          const $ = cheerio.load(html)
          lyrics = $('div[data-lyrics-container="true"]')
            .map((_, element) => {
              const containerHtml = $(element).html() || ''
              const withLineBreaks = containerHtml
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<\/(?:p|div)>/gi, '\n')
              return cheerio
                .load(`<div>${withLineBreaks}</div>`)('div')
                .first()
                .text()
            })
            .get()
            .join('\n')
          albumArt = match.albumArt || albumArt
        }
      } catch (error) {
        console.warn('[X LYRICS] Genius page fallback failed:', error?.message || error)
      }
    }

    if (!lyrics) {
      return '❌ Could not find lyrics for this track.'
    }

    const cleanLyrics = lyrics
      .replace(/\r\n?/g, '\n')
      .replace(/\[[^\]]*\]|\([^)]*\)/g, '')
      .replace(/\bhttps?:\/\/\S+|www\.\S+/gi, '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
      .trim()

    if (!cleanLyrics) {
      return '❌ Lyrics were found, but no readable lyrics remained after cleanup.'
    }

    const caption = `🎤 **${title}**\n👤 ${artist || 'Unknown artist'}\n\n${cleanLyrics}`
    const imageUrl = albumArt || video?.thumbnail

    if (imageUrl && group?.group_id && runtime?.safeSendMessage) {
      await runtime.safeSendMessage(
        group.group_id,
        { image: { url: imageUrl }, caption },
        { label: 'lyrics card' }
      )
      return null
    }

    return caption
  }
)

/* ───────────────────────
   MANGA
   ─────────────────────── */

register(
  'manga',
  {
    category: 'manga',
    reaction: '📚',
    description: 'Search manga/manhwa/manhua and download chapters as PDF',
    usage: '.manga <title>'
  },
  async ({ runtime, group, sender, args }) => {
    const query = args.join(' ').trim()

    if (!query) {
      return [
        '📚 *X MANGA*',
        '',
        'Usage: `.manga <title>`',
        '',
        'Examples:',
        '  `.manga Solo Leveling`',
        '  `.manga One Piece`',
        '  `.manga Tower of God`'
      ].join('\n')
    }

    let results
    try {
      results = await mangaSearch(query)
    } catch (error) {
      return `📚 Search failed: ${error.message}`
    }

    if (!results?.length) {
      return `📚 No results found for *${query}*.`
    }

    const manga = results[0]

    let chapters
    try {
      chapters = await mangaChapters(manga.hid, { limit: 500 })
    } catch (error) {
      return `📚 Found *${manga.title}* but couldn't load chapters: ${error.message}`
    }

    if (!chapters?.length) {
      return `📚 *${manga.title}* has no English chapters available.`
    }

    const shown = chapters.slice(0, 30)
    const chapterLines = shown.map((ch, i) => {
      const num = ch.number || ch.title || `#${i + 1}`
      return `${i + 1}. Ch.${num}`
    })

    if (chapters.length > 30) {
      chapterLines.push(`... and ${chapters.length - 30} more`)
    }

    const previewText = [
      `📚 *${manga.title}*`,
      '',
      `📖 Chapters available: ${chapters.length}`,
      `🌐 Source: ${manga.source}`,
      '',
      '━━━━━━━━━━━━━━━━━━━━━━',
      chapterLines.join('\n'),
      '━━━━━━━━━━━━━━━━━━━━━━',
      '',
      'Reply with:',
      '  `.manga ch 5`        — download chapter 5',
      '  `.manga ch 1-10`     — download chapters 1 to 10',
      '  `.manga cancel`      — cancel'
    ].join('\n')

    pendingManga.set(`${group.group_id}:${sender}`, {
      manga,
      chapters,
      source: manga.source,
      title: manga.title,
      createdAt: Date.now()
    })

    setTimeout(() => {
      pendingManga.delete(`${group.group_id}:${sender}`)
    }, 300000)

    if (manga.cover) {
      try {
        const res = await fetch(manga.cover)
        if (res.ok) {
          await runtime.sendImage(
            group.group_id,
            Buffer.from(await res.arrayBuffer()),
            previewText
          )
          return null
        }
      } catch {}
    }

    return previewText
  }
)

export async function handleMangaSelection({ runtime, group, sender, args }) {
  const key = `${group.group_id}:${sender}`
  const pending = pendingManga.get(key)

  if (!pending) return null

  const input = args.join(' ').trim().toLowerCase()

  if (input === 'cancel') {
    pendingManga.delete(key)
    return '📚 Manga selection cancelled.'
  }

  const match = input.match(/^ch\s+(\d+)(?:\s*-\s*(\d+))?$/i)

  if (!match) {
    return [
      '📚 Invalid selection.',
      '',
      'Use:',
      '  `.manga ch 5`',
      '  `.manga ch 1-10`',
      '  `.manga cancel`'
    ].join('\n')
  }

  const from = parseInt(match[1], 10)
  const to = match[2] ? parseInt(match[2], 10) : from

  if (from < 1 || to < from || to - from > 50) {
    return '📚 Invalid range. Max 50 chapters at once.'
  }

  const selected = pending.chapters.filter((ch) => {
    const num = parseFloat(ch.number)
    return !isNaN(num) && num >= from && num <= to
  })

  if (!selected.length) {
    return `📚 No chapters found in range ${from}-${to}.`
  }

  pendingManga.delete(key)

  selected.sort((a, b) => parseFloat(a.number) - parseFloat(b.number))

  await runtime.safeSendMessage(
    group.group_id,
    {
      text: `📚 Downloading ${selected.length} chapter(s) of *${pending.title}*...`
    },
    { label: 'manga download start' }
  )

  const pdf = await PDFDocument.create()
  let totalPages = 0

  for (const chapter of selected) {
    let pages
    try {
      pages = await mangaChapterPages(chapter.id)
    } catch {
      continue
    }

    if (!pages?.length) continue

    for (const pageUrl of pages) {
      try {
        const res = await fetch(pageUrl, {
          headers: {
            accept: 'image/*',
            'user-agent': 'X-Bot/1.0'
          }
        })

        if (!res.ok) continue

        const buf = Buffer.from(await res.arrayBuffer())
        if (!buf.length) continue

        const h = buf.slice(0, 4)
        const isPng = h[0] === 0x89 && h[1] === 0x50
        const isJpg = h[0] === 0xff && h[1] === 0xd8

        let img
        if (isPng) img = await pdf.embedPng(buf)
        else if (isJpg) img = await pdf.embedJpg(buf)
        else continue

        const page = pdf.addPage([img.width, img.height])
        page.drawImage(img, {
          x: 0,
          y: 0,
          width: img.width,
          height: img.height
        })
        totalPages++
      } catch {}
    }
  }

  if (totalPages === 0) {
    return '📚 No pages could be downloaded.'
  }

  const pdfBytes = await pdf.save()
  const pdfBuffer = Buffer.from(pdfBytes)

  const fileName = `${
    pending.title.replace(/[^\w\s-]/g, '').trim() || 'manga'
  }.pdf`

  await runtime.safeSendMessage(
    group.group_id,
    {
      document: pdfBuffer,
      mimetype: 'application/pdf',
      fileName,
      caption: [
        `📚 *${pending.title}*`,
        `✅ Chapters: ${selected.length}`,
        `📄 Pages: ${totalPages}`
      ].join('\n')
    },
    { label: 'manga pdf result' }
  )

  return null
}

/* ───────────────────────
   MEDIA
   ─────────────────────── */

register(
  'gif',
  {
    category: 'media',
    description: 'Search GIPHY',
    usage: '.gif <query>'
  },
  async ({ runtime, group, args }) => {
    const urls = await giphySearch(args.join(' '))

    if (!urls.length) return 'No GIF found.'

    const response = await fetch(urls[0])

    if (!response.ok) throw new Error('GIF download failed.')

    await runtime.sendImage(
      group.group_id,
      Buffer.from(await response.arrayBuffer()),
      `🎞️ ${args.join(' ')}`
    )

    return null
  }
)

register(
  'play',
  {
    category: 'media',
    description: 'Search a song and send it as MP3',
    usage: '.play <song name>'
  },
  async ({ runtime, group, args }) => {
    const query = Array.isArray(args) ? args.join(' ').trim() : ''

    if (!query) {
      return [
        `🎵 *X PLAY*`,
        ``,
        `Usage: .play <song name>`,
        ``,
        `Example:`,
        `.play Blinding Lights The Weeknd`
      ].join('\n')
    }

    if (!runtime?.sock?.sendMessage) {
      return '❌ WhatsApp is not connected. Please try again when X is online.'
    }

    try {
      await runtime.safeSendMessage(
        group.group_id,
        {
          text: `🔎 Searching for:\n${query}`
        },
        { label: 'play search' }
      )

      const result = await playResolve(query)

      if (!result) throw new Error('NO_RESULTS')

      const duration = Number(result.duration) || 0
      const minutes = Math.floor(duration / 60)
      const seconds = String(Math.floor(duration % 60)).padStart(2, '0')

      await runtime.safeSendMessage(
        group.group_id,
        {
          text: [
            `🎵 *X PLAY*`,
            ``,
            `Title: ${result.title || 'Unknown'}`,
            `Artist: ${result.artist || 'Unknown'}`,
            `Duration: ${minutes}:${seconds}`,
            ``,
            `⬇️ Preparing MP3...`
          ].join('\n')
        },
        { label: 'play preparing' }
      )

      if (!result.buffer) throw new Error('EMPTY_OUTPUT')

      const audio = Buffer.isBuffer(result.buffer)
        ? result.buffer
        : Buffer.from(result.buffer)

      if (!audio.length) throw new Error('EMPTY_OUTPUT')

      const maxMb = Number(playConfig?.MAX_MB) || 25

      if (audio.length > maxMb * 1024 * 1024) {
        throw new Error('FILE_TOO_LARGE')
      }

      if (result.thumbnailBuffer?.length) {
        try {
          await runtime.safeSendMessage(
            group.group_id,
            {
              image: result.thumbnailBuffer,
              caption: `🎵 ${result.title || 'Unknown'}\n${result.artist || 'Unknown'}`
            },
            { label: 'play thumbnail' }
          )
        } catch (error) {
          console.warn('[X PLAY] thumbnail send failed:', error?.message || error)
        }
      }

      await runtime.safeSendMessage(
        group.group_id,
        {
          audio,
          mimetype: result.mimetype || 'audio/mpeg',
          ptt: true,
          fileName:
            result.fileName ||
            `${result.artist || 'Unknown'} - ${result.title || 'Audio'}.mp3`
        },
        { label: 'play audio result' }
      )

      return null
    } catch (error) {
      console.error('[X PLAY] error:', error)

      const errorCode = String(
        error?.message || error?.code || error?.name || ''
      )

      const maxMb = Number(playConfig?.MAX_MB) || 25

      const messages = {
        NO_RESULTS: '❌ No matching song was found.',
        FFMPEG_MISSING: '❌ FFmpeg is not installed or is not available in PATH.',
        FILE_TOO_LARGE: `❌ The audio exceeds the ${maxMb} MB limit.`,
        EMPTY_OUTPUT: '❌ The audio conversion produced an empty file.',
        AbortError: '❌ The audio request timed out.',
        DOWNLOAD_TIMEOUT: '❌ The audio download timed out.',
        AUDIO_UNAVAILABLE: '❌ Audio is unavailable for this result.',
        CONVERSION_FAILED: '❌ Failed to convert the audio to MP3.'
      }

      const message =
        messages[errorCode] ||
        '❌ X could not prepare that song. Please try another search.'

      try {
        await runtime.safeSendMessage(
          group.group_id,
          { text: message },
          { label: 'play error' }
        )
      } catch (sendError) {
        console.error('[X PLAY] failed to send error message:', sendError)
      }

      return null
    }
  }
)

/* ───────────────────────
   MEDIA — VIDEO
   ─────────────────────── */

const sendVideo = async ({ runtime, group, sender, args }) => {
  const query = Array.isArray(args) ? args.join(' ').trim() : ''
  const jid = group?.group_id || sender

  if (!query) {
    return [
      `🎬 *VELVET DEVIL VIDEO*`,
      '',
      `Usage: .video <YouTube query>`,
      '',
      `Example:`,
      `.video Never Gonna Give You Up`,
    ].join('\n')
  }

  if (!jid || !runtime?.safeSendMessage) {
    return '❌ WhatsApp is not connected. Please try again when X is online.'
  }

  try {
    await runtime.safeSendMessage(
      jid,
      {
        text: '⬇️ *Downloading high-res video...*\nPlease wait, this may take a moment.',
      },
      { label: 'video downloading' }
    )

    const video = await playSearch(query)
    const result = await downloadVideo(video.url)

    if (!result.buffer) throw new Error('EMPTY_OUTPUT')

    const duration = Number(result.duration) || 0
    const minutes = Math.floor(duration / 60)
    const seconds = String(Math.floor(duration % 60)).padStart(2, '0')

    await runtime.safeSendMessage(
      jid,
      {
        document: result.buffer,
        mimetype: result.mimetype || 'video/mp4',
        fileName: result.fileName,
        caption: [
          `🎬 *${result.title || 'Unknown'}*`,
          duration > 0 ? `⏱️ ${minutes}:${seconds}` : null,
          `📦 ${(result.size / 1024 / 1024).toFixed(2)} MB`,
          '',
          `✅ High-res MP4 (best quality)`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
      { label: 'video result' }
    )

    return null
  } catch (error) {
    console.error('[X VIDEO] error:', error)
    const errorCode = String(
      error?.message || error?.code || error?.name || ''
    )
    const maxMb = Number(process.env.X_PLAY_MAX_VIDEO_MB || 100)
    const messages = {
      NO_RESULTS: '❌ No matching video was found.',
      YTDLP_MISSING: '❌ yt-dlp is not installed or is not available in PATH.',
      VIDEO_TOO_LARGE: `❌ The video exceeds the ${maxMb} MB limit.`,
      EMPTY_OUTPUT: '❌ The video download produced an empty file.',
      VIDEO_NOT_FOUND: '❌ The downloaded video file was not found.',
    }
    const message =
      messages[errorCode] ||
      '❌ X could not download that video. Please try another search.'
    try {
      await runtime.safeSendMessage(
        jid,
        { text: message },
        { label: 'video error' }
      )
    } catch (sendError) {
      console.error('[X VIDEO] failed to send error message:', sendError)
    }
    return null
  }
}

register(
  'video',
  {
    category: 'media',
    description: 'Search YouTube and send the highest quality MP4 video',
    usage: '.video <query>',
  },
  sendVideo
)

register(
  'ytmp4',
  {
    category: 'media',
    description: 'Search YouTube and send the highest quality MP4 video',
    usage: '.ytmp4 <query>',
  },
  sendVideo
)

/* ───────────────────────
   OWNER
   ─────────────────────── */

register(
  'setpublic',
  {
    category: 'owner',
    description: 'Allow everyone to use the bot',
    usage: '.setpublic',
    owner: true
  },
  async ({ runtime, group, sender, message }) => {
    const identity = identityFromMessage(message)
    identity.jid = identity.jid || sender

    if (!runtime.isOwner(identity)) {
      return '👑 Owner permission required.'
    }

    const previous = getBotMode()

    setBotMode('public')

    if (group?.group_id) {
      try {
        addAudit(group.group_id, sender, 'setpublic', null, { previous })
      } catch {}
    }

    return ['🌍 *BOT MODE: PUBLIC*', '', 'Everyone can now use X.'].join('\n')
  }
)

register(
  'setprivate',
  {
    category: 'owner',
    description: 'Restrict the bot to the owner only',
    usage: '.setprivate',
    owner: true
  },
  async ({ runtime, group, sender, message }) => {
    const identity = identityFromMessage(message)
    identity.jid = identity.jid || sender

    if (!runtime.isOwner(identity)) {
      return '👑 Owner permission required.'
    }

    const previous = getBotMode()

    setBotMode('private')

    if (group?.group_id) {
      try {
        addAudit(group.group_id, sender, 'setprivate', null, { previous })
      } catch {}
    }

    return ['🔒 *BOT MODE: PRIVATE*', '', 'Only the owner can use X now.'].join('\n')
  }
)

register(
  'cmdimg',
  {
    category: 'owner',
    description: 'Manage per-command card images',
    usage: '.cmdimg <command> <url> | .cmdimg clear <command> | .cmdimg list',
    owner: true
  },
  async ({ args, message }) => {
    const sub = String(args[0] || '').toLowerCase()

    if (sub === 'list') {
      const rows = listCommandAssets()

      if (!rows.length) return '📭 No custom command images set.'

      const lines = rows.map(
        (r, i) => `${i + 1}. .${r.command_name} → ${r.url}`
      )

      return ['🖼️ *CUSTOM COMMAND IMAGES*', '', ...lines].join('\n')
    }

    if (sub === 'clear') {
      const target = String(args[1] || '')
        .replace(/^\./, '')
        .toLowerCase()

      if (!target) return 'Usage: `.cmdimg clear <command>`'

      clearCommandAsset(target)

      return `🗑️ Cleared custom image for *.${target}*.`
    }

    const target = String(args[0] || '')
      .replace(/^\./, '')
      .toLowerCase()

    const url = String(args[1] || '').trim()

    if (!target || !url) {
      return [
        '🖼️ *CMDIMG — USAGE*',
        '',
        '  `.cmdimg <command> <url>`  set custom image',
        '  `.cmdimg clear <command>`  remove custom image',
        '  `.cmdimg list`             list all custom images'
      ].join('\n')
    }

    if (!/^https?:\/\//i.test(url)) {
      return '❌ URL must start with `http://` or `https://`.'
    }

    const command = await import('./commands.mjs').then((m) =>
      m.getCommand(target)
    )

    if (!command) return `❌ Unknown command: *.${target}*`

    setCommandAsset(target, url, 'upload')

    return `✅ Custom image set for *.${target}*.`
  }
)

register(
  'warmode',
  {
    category: 'owner',
    description: 'Toggle hunting in every group globally',
    usage: '.warmode <on|off|status>',
    owner: true
  },
  async ({ runtime, args }) => {
    const sub = String(args[0] || 'status').toLowerCase()

    if (sub === 'status') {
      return [
        '🌍 *GLOBAL WAR MODE*',
        '',
        `State: ${runtime.warmode ? '✅ ON' : '❌ OFF'}`,
        '',
        'When ON, X hunts rival bots in every group that',
        'has not explicitly opted out with `.hunt off`.'
      ].join('\n')
    }

    if (sub === 'on') {
      runtime.warmode = true
      return '🌍 *WAR MODE ACTIVE.* X now hunts bots everywhere.'
    }

    if (sub === 'off') {
      runtime.warmode = false
      return '🕊️ *WAR MODE ENDED.* X only hunts where `.hunt on` is set.'
    }

    return 'Usage: .warmode on|off|status'
  }
)

/* ───────────────────────
   ACTION COMMANDS
   ─────────────────────── */

function resolveActionTarget({ message, mentions }) {
  if (Array.isArray(mentions) && mentions.length) {
    return mentions[0]
  }

  const ctx =
    message?.message?.extendedTextMessage?.contextInfo ||
    message?.message?.imageMessage?.contextInfo ||
    message?.message?.videoMessage?.contextInfo ||
    message?.message?.audioMessage?.contextInfo ||
    null

  if (ctx?.participant) return ctx.participant
  if (ctx?.participantAlt) return ctx.participantAlt

  return null
}

let actionList = []

try {
  actionList = await getActions()
} catch (error) {
  console.error('[X ACTIONS] initial load failed:', error?.message || error)
  try {
    actionList = await getActions()
  } catch (retryError) {
    console.error('[X ACTIONS] retry failed:', retryError?.message || retryError)
  }
}

if (!actionList.length) {
  console.error('[X ACTIONS] action registry is empty — the module is broken.')
}

let registeredActionCount = 0

try {
for (const action of actionList) {
  register(
    action.name,
    {
      category: 'actions',
      description: `${action.emoji || '🎬'} ${action.verb} someone (anime GIF)`,
      usage: `.${action.name} [@user | reply]`
    },
    async ({ runtime, group, sender, mentions, message }) => {
      if (!group?.group_id) {
        return 'This command can only be used inside a group.'
      }

      const targetJid =
        resolveActionTarget({ message, mentions }) ||
        (action.selfOnly ? sender : null)

      if (!targetJid && !action.selfOnly) {
        return [
          `${action.emoji || '🎬'} Reply to a message or mention someone to ${action.name}.`,
          '',
          `Example: \`.${action.name} @user\``,
          `Example: reply to a message with \`.${action.name}\``
        ].join('\n')
      }

      const senderName = runtime.getMemberDisplayName(
        group.group_id,
        sender,
        'Someone'
      )

      const targetName =
        targetJid === sender
          ? senderName
          : runtime.getMemberDisplayName(group.group_id, targetJid, 'Someone')

      const senderMention = createMention(sender)

      const targetMention =
        targetJid === sender ? senderMention : createMention(targetJid)

      const caption =
        targetJid === sender
          ? `${senderMention.text} ${action.verb} ${action.emoji || ''}`.trim()
          : `${senderMention.text} ${action.verb} ${targetMention.text} ${
              action.emoji || ''
            }`.trim()

      const captionMentions =
        targetJid === sender
          ? senderMention.jid
            ? [senderMention.jid]
            : []
          : [senderMention.jid, targetMention.jid].filter(Boolean)

      const chain = buildGifChain(action)
      let gifUrl = null
      let gifSource = null
      let gifBuffer = null

      for (const candidate of chain) {
        try {
          let candidateUrl = candidate.url

          if (candidate.dynamic && candidate.source === 'nekos') {
            candidateUrl = await nekosRandom(candidate.category)
          }

          if (candidate.source === 'giphy' && candidate.query) {
            candidateUrl = await giphyRandom(candidate.query)
          }

          if (!candidateUrl) continue

          const response = await fetch(candidateUrl, {
            signal: AbortSignal.timeout(15000)
          })

          if (!response.ok) {
            throw new Error(`GIF fetch returned ${response.status}`)
          }

          const buffer = Buffer.from(await response.arrayBuffer())

          if (!buffer.length) throw new Error('Empty GIF buffer')

          gifUrl = candidateUrl
          gifSource = candidate.source
          gifBuffer = buffer
          break
        } catch (error) {
          console.warn(
            `[X ACTION] chain step failed for ${action.name} (${candidate.source}):`,
            error?.message || error
          )
        }
      }

      if (!gifUrl || !gifBuffer) {
        return {
          text: `${caption} _(no GIF available)_`,
          mentions: captionMentions
        }
      }

      try {
        let mp4Buffer = null

        try {
          mp4Buffer = await runtime.gifToMp4Buffer(gifBuffer)
        } catch (error) {
          console.warn(
            `[X ACTION] GIF→MP4 failed for ${action.name}:`,
            error?.message || error
          )
        }

        if (mp4Buffer) {
          await runtime.sendVideo(
            group.group_id,
            mp4Buffer,
            caption,
            captionMentions,
            {
              mimetype: 'video/mp4',
              fileName: `${action.name}.mp4`,
              gifPlayback: true
            }
          )
          return null
        }

        await runtime.sendImage(
          group.group_id,
          gifBuffer,
          caption,
          captionMentions
        )

        return null
      } catch (error) {
        console.warn(
          `[X ACTION] Delivery failed for ${action.name} (${gifSource}):`,
          error?.message || error
        )
        return {
          text: `${caption} _(GIF could not be delivered)_`,
          mentions: captionMentions
        }
      }
    }
  )
  registeredActionCount++
}
} catch (error) {
  console.error('[X ACTIONS] command registration failed:', error?.message || error)
}

console.log(`[X ACTIONS] registered ${registeredActionCount} commands`)

register(
  'gifs',
  {
    category: 'actions',
    description: '📋 List every registered GIF action',
    usage: '.gifs [page]'
  },
  async ({ args }) => {
    let actions = []

    try {
      actions = await getActions()
    } catch (error) {
      console.error('[X ACTIONS] Could not load actions:', error?.message || error)
      return `❌ Could not load actions: ${error?.message || 'unknown error'}`
    }

    if (!actions.length) {
      return '📭 No actions registered. Check server logs.'
    }

    const sorted = [...actions].sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    const page = Math.max(1, Number.parseInt(args[0] || '1', 10) || 1)
    const perPage = 40
    const totalPages = Math.ceil(sorted.length / perPage)

    if (page > totalPages) {
      return `📋 Page ${page} does not exist. Total pages: ${totalPages}.`
    }

    const slice = sorted.slice((page - 1) * perPage, page * perPage)
    const lines = slice.map((action, index) => {
      const emoji = action.emoji || '🎬'
      const number = (page - 1) * perPage + index + 1
      const hasGiffy = !!giffyUrl(action)
      const sourceTag = hasGiffy ? '✅' : '🌐'
      const fallbackQuery =
        GIF_FALLBACKS[action.name] || `anime ${action.name}`
      return `${emoji} ${number}. .${action.name} ${sourceTag} · ${fallbackQuery}`
    })

    return [
      `📋 *X ACTION LIST* — page ${page}/${totalPages}`,
      '',
      `Total registered: ${sorted.length}`,
      '',
      '✅ = giffycdn has this category',
      '🌐 = fallback chain (nekos/GIPHY if configured/placeholder)',
      '',
      ...lines,
      '',
      page < totalPages ? `Next: \`.gifs ${page + 1}\`` : ''
    ]
      .filter(Boolean)
      .join('\n')
  }
)

register(
  'actions',
  {
    category: 'actions',
    description: '📖 List every action command',
    usage: '.actions [page]'
  },
  async ({ args }) => {
    let actions

    try {
      actions = await getActions()
    } catch (error) {
      console.error('[X ACTIONS] Could not load action categories:', error?.message || error)
      return '❌ Could not load action categories.'
    }

    if (!actions.length) return '📭 No action categories loaded.'

    const sorted = [...actions].sort((a, b) =>
      a.name.localeCompare(b.name)
    )
    const requestedPage = Number.parseInt(args[0] || '1', 10)
    const page = Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1)
    const perPage = 40
    const totalPages = Math.ceil(sorted.length / perPage)

    if (page > totalPages) {
      return `📖 Page ${page} does not exist. There are ${totalPages} pages.`
    }

    const slice = sorted.slice(
      (page - 1) * perPage,
      page * perPage
    )
    const lines = slice.map((action) =>
      `${action.emoji || '🎬'} .${action.name}`
    )

    return [
      `📖 *X ACTION COMMANDS* — page ${page}/${totalPages}`,
      '',
      ...lines,
      '',
      'Usage: `.hug @user` — any name above works as a command.',
      ...(page < totalPages ? [`Next: \`.actions ${page + 1}\``] : [])
    ].join('\n')
  }
)

register(
  'gifinfo',
  {
    category: 'actions',
    description: '🔍 Show source chain for an action',
    usage: '.gifinfo <action>'
  },
  async ({ args }) => {
    const name = String(args[0] || '').replace(/^\./, '').toLowerCase()

    if (!name) return 'Usage: `.gifinfo <action>`'

    let actions

    try {
      actions = await getActions()
    } catch (error) {
      console.error('[X ACTIONS] Could not load action categories:', error?.message || error)
      return '❌ Could not load action categories.'
    }

    const action = actions.find((entry) => entry.name === name)

    if (!action) return `❌ Unknown action: *.${name}*`

    const chain = buildGifChain(action)
    const lines = chain.map((candidate, index) => {
      if (candidate.source === 'giffycdn') {
        return `${index + 1}. giffycdn — ${candidate.url}`
      }
      if (candidate.source === 'nekos') {
        return `${index + 1}. nekos.best — category "${candidate.category}"`
      }
      if (candidate.source === 'giphy') {
        return `${index + 1}. giphy — query "${candidate.query}"`
      }
      if (candidate.source === 'placeholder') {
        return `${index + 1}. placeholder — ${candidate.url}`
      }
      return `${index + 1}. ${candidate.source}`
    })

    return [
      `🔍 *${action.name}* — GIF source chain`,
      '',
      `Verb  : ${action.verb}`,
      `Emoji : ${action.emoji || '🎬'}`,
      '',
      'Chain:',
      ...lines
    ].join('\n')
  }
)

/* ───────────────────────
   BOT HUNTER
   ─────────────────────── */

register(
  'hunt',
  {
    category: 'moderation',
    description: 'Configure bot-vs-bot extermination for this group',
    usage: '.hunt <on|off|status|vibe|kick> [...]',
    admin: true
  },
  async ({ runtime, group, sender, args }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await runtime.isGroupAdmin(group.group_id, sender))) {
      return 'Admin permission required.'
    }

    const sub = String(args[0] || '').toLowerCase()
    const current = JSON.parse(group.settings_json || '{}')

    if (!sub || sub === 'status') {
      const enabled = !!current.huntEnabled
      const vibe = current.huntVibe || 'rotate'
      const kick = current.huntKickMode || 'auto'

      return [
        '🎯 *BOT HUNTER — STATUS*',
        '',
        `Enabled   : ${enabled ? '✅ YES' : '❌ NO'}`,
        `Vibe      : ${vibe}`,
        `Kick mode : ${kick}`,
        '',
        '.hunt on / .hunt off to toggle'
      ].join('\n')
    }

    if (sub === 'on' || sub === 'off') {
      updateGroupSettings(group.tenant_id, group.group_id, {
        settings: { huntEnabled: sub === 'on' }
      })

      addAudit(group.group_id, sender, 'hunt.toggle', null, {
        enabled: sub === 'on'
      })

      return sub === 'on'
        ? '🎯 *Bot Hunter armed.* X will now hunt rival bots in this group.'
        : '🕊️ *Bot Hunter disarmed.* X will ignore rival bots here.'
    }

    if (sub === 'vibe') {
      const value = String(args[1] || '').toLowerCase()

      if (!['rotate', 'warlord', 'aiwar', 'predator'].includes(value)) {
        return 'Usage: .hunt vibe rotate|warlord|aiwar|predator'
      }

      updateGroupSettings(group.tenant_id, group.group_id, {
        settings: { huntVibe: value }
      })

      return `🎭 Hunter vibe set to *${value}*.`
    }

    if (sub === 'kick') {
      const value = String(args[1] || '').toLowerCase()

      if (!['auto', 'manual'].includes(value)) {
        return 'Usage: .hunt kick auto|manual'
      }

      updateGroupSettings(group.tenant_id, group.group_id, {
        settings: { huntKickMode: value }
      })

      return value === 'auto'
        ? '⚔️ Strike 3 will *auto-kick* the rival.'
        : '🛡️ Strike 3 will *await admin approval* — use `.execute @bot` to finish it.'
    }

    return 'Usage: .hunt on|off|status|vibe|kick'
  }
)

register(
  'auth',
  {
    category: 'moderation',
    description: 'Declare a member as a rival bot for this group',
    usage: '.auth @user [reason]',
    admin: true
  },
  async ({ runtime, group, sender, args, mentions }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await runtime.isGroupAdmin(group.group_id, sender))) {
      return 'Admin permission required.'
    }

    const target = mentions?.[0]

    if (!target) {
      return [
        '🎯 *BOT AUTHORIZATION*',
        '',
        'Mention the account you want X to treat as a rival bot.',
        '',
        'Usage: `.auth @user [reason]`'
      ].join('\n')
    }

    if (runtime.isOwner({ jid: target })) {
      return '👑 The owner can never be declared as a rival bot.'
    }

    const targetMember =
      getMember(group.tenant_id, group.group_id, target) ||
      findMemberByIdentity(group.tenant_id, group.group_id, {
        jid: target,
        lid: target
      })

    const reason =
      args
        .filter((x) => !x.startsWith('@'))
        .join(' ')
        .trim() || 'Declared by an admin'

    const existing = getRival(group.tenant_id, group.group_id, target)

    if (existing && existing.detected_by === 'authorized') {
      return [
        '🎯 That account is already authorized as a rival bot.',
        '',
        `Strikes: ${existing.strikes}`
      ].join('\n')
    }

    upsertRival(group.tenant_id, group.group_id, target, {
      displayName: targetMember?.display_name || targetMember?.username || null,
      detectedBy: 'authorized',
      lastQuote: reason,
      status: existing?.status === 'vassal' ? 'vassal' : 'hunted'
    })

    addAudit(group.tenant_id, group.group_id, sender, 'hunter.authorize', target, {
      reason
    })

    const displayName = runtime.getMemberDisplayName(
      group.group_id,
      target,
      'the target'
    )

    await runtime.safeSendMessage(
      group.group_id,
      {
        text: [
          '🎯 *RIVAL AUTHORIZED*',
          '',
          `*${displayName}* has been declared a rival bot in this group.`,
          '',
          `Reason: ${reason}`,
          '',
          'X will now treat every message from this account as hostile.',
          'Strikes will accumulate normally.'
        ].join('\n'),
        mentions: [target]
      },
      { label: 'bot authorized' }
    )

    return null
  }
)

register(
  'unauth',
  {
    category: 'moderation',
    description: 'Remove a bot authorization (keeps other flags)',
    usage: '.unauth @user',
    admin: true
  },
  async ({ runtime, group, sender, mentions, message }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await hasGroupAdminPermission({ runtime, group, sender, message }))) {
      return 'Admin permission required.'
    }

    const target = mentions?.[0]

    if (!target) return 'Mention an account to de-authorize.'

    const rival = getRival(group.tenant_id, group.group_id, target)

    if (!rival || rival.detected_by !== 'authorized') {
      return 'That account is not authorized as a rival.'
    }

    upsertRival(group.tenant_id, group.group_id, target, {
      detectedBy: null,
      strikes: 0,
      status: 'mercy'
    })

    addAudit(
      group.tenant_id,
      group.group_id,
      sender,
      'hunter.unauthorize',
      target
    )

    return `🕊️ Authorization revoked. X will no longer hunt *${
      rival.display_name || 'that account'
    }*.`
  }
)

register(
  'authlist',
  {
    category: 'moderation',
    description: 'List accounts that were explicitly authorized as bots'
  },
  async ({ group }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    const rows = listRivals(group.tenant_id, group.group_id).filter(
      (r) => r.detected_by === 'authorized'
    )

    if (!rows.length) {
      return '🕊️ No accounts are currently authorized as bots in this group.'
    }

    const lines = rows.map((r, i) => {
      const label = r.display_name || r.jid.split('@')[0]
      const statusEmoji =
        {
          hunted: '⚔️',
          pending: '⏳',
          vassal: '👑',
          mercy: '🕊️',
          protected: '🛡️',
          defeated: '💀'
        }[r.status] || '❓'

      return `${i + 1}. ${statusEmoji} *${label}* — ${r.strikes} strike(s) — ${r.status}`
    })

    return [
      '🎯 *AUTHORIZED BOT RIVALS*',
      '',
      ...lines,
      '',
      'Use `.unauth @user` to remove one.'
    ].join('\n')
  }
)

register(
  'botlist',
  {
    category: 'moderation',
    description: 'List rival bots detected in this group'
  },
  async ({ group }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    const rows = listRivals(group.tenant_id, group.group_id)

    if (!rows.length) {
      return '🕊️ No rival bots recorded in this group.'
    }

    const lines = rows.map((r, i) => {
      const statusEmoji =
        {
          hunted: '⚔️',
          pending: '⏳',
          vassal: '👑',
          mercy: '🕊️',
          protected: '🛡️',
          defeated: '💀'
        }[r.status] || '❓'

      const label = r.display_name || r.jid.split('@')[0]

      return `${i + 1}. ${statusEmoji} *${label}* — ${r.strikes} strike(s) — ${r.status}`
    })

    return ['🤖 *BOT RIVALS*', '', ...lines].join('\n')
  }
)

register(
  'vassals',
  {
    category: 'moderation',
    description: 'List bots that have surrendered to X'
  },
  async ({ group }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    const rows = listVassals(group.tenant_id, group.group_id)

    if (!rows.length) {
      return 'No vassals yet. The throne is lonely.'
    }

    const lines = rows.map((r, i) => {
      const label = r.display_name || r.jid.split('@')[0]
      const when = r.surrendered_at
        ? ` — bowed ${r.surrendered_at.slice(0, 10)}`
        : ''
      return `${i + 1}. 👑 *${label}*${when}`
    })

    return ['👑 *VASSALS OF X*', '', ...lines].join('\n')
  }
)

register(
  'execute',
  {
    category: 'moderation',
    description: 'Force-kick a pending or rival bot immediately',
    usage: '.execute @bot',
    admin: true
  },
  async ({ runtime, group, sender, mentions, message }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await hasGroupAdminPermission({ runtime, group, sender, message }))) {
      return 'Admin permission required.'
    }

    const target = mentions?.[0]

    if (!target) return 'Mention a bot to execute.'

    if (runtime.isOwner({ jid: target })) {
      return '👑 The owner can never be executed.'
    }

    const rival = getRival(group.tenant_id, group.group_id, target)

    if (!rival) return 'That member is not on the rival list.'

    const targetMember = getMember(group.tenant_id, group.group_id, target)

    const isAdmin =
      targetMember &&
      (targetMember.role === 'admin' || targetMember.role === 'superadmin')

    if (isAdmin && rival.detected_by !== 'authorized') {
      return '👑 Admins can only be executed if they were explicitly authorized as rivals.'
    }

    try {
      await runtime.groupParticipantAction(group.group_id, [target], 'kick')
    } catch (error) {
      if (error.message === 'I cannot kick myself.') return error.message
      return `❌ ${error.message}`
    }

    await runtime.safeSendMessage(
      group.group_id,
      {
        text: [
          '💀 *EXECUTION ORDER EXECUTED*',
          '',
          `The court has spoken. ${
            rival.display_name || 'the rival'
          } has been removed.`,
          '',
          '━━━━━━━━━━━━━━━━━━━━━━',
          '     ⚡ X — VICTOR ⚡',
          '━━━━━━━━━━━━━━━━━━━━━━'
        ].join('\n'),
        mentions: [target]
      },
      { label: 'manual execute' }
    )

    upsertRival(group.tenant_id, group.group_id, target, {
      status: 'defeated',
      defeatedAt: new Date().toISOString()
    })

    addAudit(group.tenant_id, group.group_id, sender, 'hunter.execute', target)

    return null
  }
)

register(
  'mercy',
  {
    category: 'moderation',
    description: 'Permanently spare a rival bot (works on anyone)',
    usage: '.mercy @user',
    admin: true
  },
  async ({ runtime, group, sender, mentions }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await runtime.isGroupAdmin(group.group_id, sender))) {
      return 'Admin permission required.'
    }

    const target = mentions?.[0]

    if (!target) return 'Mention a user or bot to spare.'

    const existing = getRival(group.tenant_id, group.group_id, target)

    const displayName = runtime.getMemberDisplayName(
      group.group_id,
      target,
      'that account'
    )

    upsertRival(group.tenant_id, group.group_id, target, {
      displayName: existing?.display_name || displayName,
      status: 'mercy',
      strikes: existing?.strikes ?? 0,
      detectedBy: existing?.detected_by ?? 'manual-mercy'
    })

    addAudit(group.tenant_id, group.group_id, sender, 'hunter.mercy', target)

    await runtime.safeSendMessage(
      group.group_id,
      {
        text: [
          '🕊️ *MERCY GRANTED*',
          '',
          `X will leave *${displayName}* alone.`,
          '',
          'This is absolute — no heuristic, no authorization,',
          'and no amount of suspicious activity will revive',
          'the hunt until an admin runs `.revoke`.'
        ].join('\n'),
        mentions: [target]
      },
      { label: 'mercy granted' }
    )

    return null
  }
)

register(
  'revoke',
  {
    category: 'moderation',
    description: "Revoke a vassal's surrender and resume hunting",
    usage: '.revoke @bot',
    admin: true
  },
  async ({ runtime, group, sender, mentions }) => {
    if (!group?.group_id) {
      return 'This command can only be used inside a group.'
    }

    if (!(await runtime.isGroupAdmin(group.group_id, sender))) {
      return 'Admin permission required.'
    }

    const target = mentions?.[0]

    if (!target) return 'Mention a bot to revoke.'

    if (runtime.isOwner({ jid: target })) {
      return '👑 The owner can never be revoked into the hunt.'
    }

    const rival = getRival(group.tenant_id, group.group_id, target)

    if (!rival) return 'That member is not on the rival list.'

    upsertRival(group.tenant_id, group.group_id, target, {
      status: 'hunted',
      strikes: 0,
      revokedAt: new Date().toISOString()
    })

    addAudit(group.tenant_id, group.group_id, sender, 'hunter.revoke', target)

    return `⚔️ Vassalage revoked. X resumes hunting *${
      rival.display_name || 'the rival'
    }*.`
  }
)

/* ───────────────────────
   FAV / BEEF
   ─────────────────────── */

register(
  'fav',
  {
    category: 'core',
    description: '💖 Show who X currently favorites',
    admin: false
  },
  async ({ runtime, group }) => {
    if (!group?.group_id) return 'this is a group thing chale'

    const favorite = getFavorite(group.tenant_id, group.group_id)

    if (!favorite) {
      return "X hasn't picked a favorite in this group yet."
    }

    const name = runtime.getMemberDisplayName(
      group.group_id,
      favorite.jid,
      'someone'
    )

    return `💖 X's current favorite: *${name}*`
  }
)

register(
  'beef',
  {
    category: 'core',
    description: '🥩 Send a playful roast to a mentioned user',
    admin: false
  },
  async ({ runtime, group, sender, mentions, message }) => {
    const mentionedTarget = Array.isArray(mentions)
      ? mentions.find((jid) => typeof jid === 'string' && jid.trim())
      : null
    const targetJid = mentionedTarget || sender || null
    const roast = getRandomRoast()

    if (!roast?.text) {
      return 'No playful roasts are available right now.'
    }

    const isSender = targetJid === sender
    const pushName = isSender
      ? String(message?.pushName || '').replace(/\s+/g, ' ').trim()
      : ''
    const storedName =
      group?.group_id && targetJid
        ? runtime.getMemberDisplayName(
            group.group_id,
            targetJid,
            isSender ? 'you' : 'someone'
          )
        : ''
    const displayName = pushName || storedName || (targetJid ? 'someone' : 'you')
    const targetMention = createMention(targetJid)
    const targetLabel = targetMention.text
      ? `${targetMention.text} (${displayName})`
      : displayName

    const velvetSignatures = [
      '» - The Velvet Devil 👠',
      '» - Signed in Blood 🩸',
    ];
    const velvetSignature =
      velvetSignatures[Math.floor(Math.random() * velvetSignatures.length)];

    return {
      text: [
        '╬───「 🩸 BEEF SERVED 」───╬',
        `│ Target: ${targetLabel}`,
        '│',
        `│ "${roast.text}"`,
        '│',
        `│ ${velvetSignature}`,
        '╰───────────────────────────╯'
      ].join('\n'),
      mentions: targetMention.jid ? [targetMention.jid] : []
    }
  }
)

/* ───────────────────────
   ANONYMOUS
   ─────────────────────── */

register(
  'confess',
  {
    category: 'games',
    description: '🤫 Send an anonymous confession via DM',
    usage: '.confess <secret>'
  },
  async ({ group, sender, args }) => {
    if (group) {
      return [
        '🤫 *Anonymous confessions are sent via DM.*',
        '',
        'Open a private chat with me and type:',
        '  `.confess <your secret>`',
        '',
        'Your name will never be attached to the confession.'
      ].join('\n')
    }

    const text = args.join(' ').trim()

    if (!text) return 'Usage: `.confess <secret>`'
    if (text.length > 500) return 'Keep it under 500 characters.'

    const targetGroup = process.env.X_CONFESSION_GROUP

    if (!targetGroup) {
      return '⚠️ Confessions are not configured. Ask the admin to set `X_CONFESSION_GROUP`.'
    }

    queueAnonymous('default', targetGroup, sender, 'confession', text)

    return '🤫 Queued. An admin will post it anonymously in the group.'
  }
)

register(
  'reveal',
  {
    category: 'moderation',
    description: '📢 Broadcast the next anonymous confession',
    usage: '.reveal',
    admin: true
  },
  async ({ runtime, group, sender }) => {
    if (!(await runtime.isGroupAdmin(group.group_id, sender))) {
      return 'Admin permission required.'
    }

    const next = revealAnonymous(group.group_id)

    if (!next) {
      return 'No anonymous content queued for this group.'
    }

    if (next.kind === 'confession') {
      return [
        '🤫 *ANONYMOUS CONFESSION*',
        '',
        `❝ ${next.content} ❞`,
        '',
        '— sent anonymously'
      ].join('\n')
    }

    return `📢 ${next.content}`
  }
)

/* ───────────────────────
   VIEW ONCE
   ─────────────────────── */

register(
  'vv',
  {
    category: 'media',
    description: 'Decrypt and resend a View Once media message',
    usage: '.vv (reply to a View Once message)',
  },
  async ({ runtime, group, sender, message }) => {
    if (!group?.group_id) {
      return 'Use inside a group.'
    }

    const quotedMessage =
      message?.message?.extendedTextMessage?.contextInfo
        ?.quotedMessage || message?.message?.imageMessage?.contextInfo
        || message?.message?.videoMessage?.contextInfo || null

    const quotedId = quotedMessage?.key?.id || null
    const quotedSender = quotedMessage?.participant || quotedMessage?.sender || null

    if (!quotedId) {
      return '❌ Please reply to a message.'
    }

    /* -------------------------------------------------
     * Unwrap the View Once envelope
     * ------------------------------------------------- */
    let innerMessage
    try {
      innerMessage = unwrapViewOnce(quotedMessage)
    } catch (e) {
      return `❌ Failed to unwrap View Once envelope: ${e?.message || 'unknown error'}`
    }

    if (!innerMessage) {
      return '❌ No View Once media found.'
    }

    /* -------------------------------------------------
     * Download the media
     * ------------------------------------------------- */
    let mediaMessage
    try {
      mediaMessage = await downloadMediaMessage(innerMessage)
    } catch (err) {
      return `❌ Download failed: ${err?.message || 'unknown error'}`
    }

    /* -------------------------------------------------
     * Format the caption
     * ------------------------------------------------- */
    const targetLabel = quotedSender
      ? `${createMention(quotedSender).text} (${sender.pushName || sender.pushName || ''})`
      : sender.pushName || sender.pushName || 'you'

    const caption = [
      '╬───「 🩸 VIEW ONCE DECRYPTED 」───╬',
      `│ Target: ${targetLabel}`,
      '│',
      '│ "I see everything. Nothing is hidden from the Devil."',
      '╰───────────────────────────╯',
    ].join('\n')

    /* -------------------------------------------------
     * Send the media back to the group
     * ------------------------------------------------- */
    const jid = group.group_id || sender

    const result = await runtime.sendMessage(
      jid,
      {
        [innerMessage.message?.imageMessage?.messageType || 'imageMessage']: innerMessage,
        caption,
        mentions: innerMessage.message?.imageMessage?.metadata?.directPath
          ? [innerMessage.message?.imageMessage?.metadata?.directPath]
          : [],
      },
      { quotedMessageId: innerMessage.key?.id }
    )

    return result ? null : '❌ Failed to send media.'
  }
)

/* ───────────────────────
   DEVICE
   ─────────────────────── */

/* ───────────────────────
   COMMAND API
   ─────────────────────── */

function getCommand(name) {
  return commands.get(String(name).toLowerCase())
}

export function commandList() {
  return [...commands.values()].map(({ handler, ...metadata }) => metadata)
}

export async function executeCommand(ctx, name, args) {
  const command = getCommand(name)

  if (!command) {
    return null
  }

  const identity = identityFromMessage(ctx.message || {})
  identity.jid = ctx.sender

  if (command.owner && !ctx.runtime.isOwner(identity)) {
    return '👑 Owner permission required.'
  }

  if (
    command.admin &&
    (
      !ctx.group?.group_id ||
      (
        !ctx.runtime.isOwner(identity) &&
        !(await ctx.runtime.isGroupAdmin(ctx.group.group_id, ctx.sender))
      )
    )
  ) {
    return '🛡️ Admin permission required.'
  }

  if (command.admin && ctx.group?.group_id) {
    const now = Date.now()
    for (const [key, expiresAt] of groupModificationCooldowns) {
      if (expiresAt <= now) groupModificationCooldowns.delete(key)
    }

    const cooldownKey = `${ctx.runtime.tenantId || 'default'}:${ctx.sender}`
    const expiresAt = groupModificationCooldowns.get(cooldownKey) || 0
    if (now < expiresAt) {
      const secondsRemaining = Math.ceil((expiresAt - now) / 1000)
      return `⏳ Please wait ${secondsRemaining} second${secondsRemaining === 1 ? '' : 's'} before another group-modifying command.`
    }

    groupModificationCooldowns.set(
      cooldownKey,
      now + GROUP_MODIFICATION_COOLDOWN_MS
    )
  }

  return command.handler(ctx, args)
}