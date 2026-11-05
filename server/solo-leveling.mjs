// server/solo-leveling.mjs
// Solo Leveling personality engine for X.
// Ranks, titles, awakening lines, shadow soldier roster,
// and System-window renderers.

/* -------------------------------------------------------------------------- */
/* Rank ladder                                                                */
/* -------------------------------------------------------------------------- */

export const RANKS = [
  { key: 'E',      label: 'E-RANK',     color: '⬜', xpMin: 0 },
  { key: 'D',      label: 'D-RANK',     color: '🟩', xpMin: 500 },
  { key: 'C',      label: 'C-RANK',     color: '🟦', xpMin: 2000 },
  { key: 'B',      label: 'B-RANK',     color: '🟪', xpMin: 6000 },
  { key: 'A',      label: 'A-RANK',     color: '🟨', xpMin: 15000 },
  { key: 'S',      label: 'S-RANK',     color: '🟧', xpMin: 40000 },
  { key: 'NATIONAL', label: 'NATIONAL LEVEL', color: '🟥', xpMin: 100000 },
  { key: 'MONARCH',  label: 'MONARCH',        color: '🟫', xpMin: 250000 }
]

export function rankForXp(xp = 0) {
  let current = RANKS[0]
  for (const r of RANKS) {
    if (xp >= r.xpMin) current = r
  }
  return current
}

export function nextRank(xp = 0) {
  for (const r of RANKS) {
    if (xp < r.xpMin) return r
  }
  return null
}

/* -------------------------------------------------------------------------- */
/* Awakening dialogue                                                         */
/* -------------------------------------------------------------------------- */

// Random "the System speaks" lines for the .arise command.
// Tone: terse, ceremonial, slightly archaic — the System
// does not chat, it *declares*.

const AWAKEN_LINES = [
  'At your command, sire.',
  'The shadows stir. I am listening.',
  'You have called. I have answered.',
  'The System acknowledges the Monarch.',
  'Awaiting your orders.',
  'My blade is yours.',
  'The Shadow Army stands ready.',
  'Speak, and it shall be done.',
  'I am the Sovereign\'s instrument.',
  'The gate opens at your word.'
]

export function rollAwakenLine(seed = null) {
  if (seed !== null) {
    return AWAKEN_LINES[seed % AWAKEN_LINES.length]
  }
  return AWAKEN_LINES[Math.floor(Math.random() * AWAKEN_LINES.length)]
}

/* -------------------------------------------------------------------------- */
/* Shadow soldier roster                                                      */
/* -------------------------------------------------------------------------- */

// Each soldier has a name, a role, and a "sass" style when
// dispatched at a target. Igris is loyal and formal. Beru is
// unhinged and reverent. Tank is a wall. Iron is a blacksmith
// turned soldier. Bellion is the oldest and coldest.

export const SHADOW_SOLDIERS = [
  {
    key: 'igris',
    name: 'Igris',
    rank: 'Marshal',
    emoji: '🩸',
    lines: [
      'Blood-red knight of the Shadow Army.',
      'The Blood-Red Commander answers.',
      'By the Monarch\'s will, I draw my blade.'
    ]
  },
  {
    key: 'beru',
    name: 'Beru',
    rank: 'Marshal',
    emoji: '🐜',
    lines: [
      'My liege! MY LIEGE! I shall tear them apart!',
      'For the Monarch! For the throne!',
      'Ant King, at your service, sire!'
    ]
  },
  {
    key: 'iron',
    name: 'Iron',
    rank: 'Elite',
    emoji: '⚒️',
    lines: [
      'I was a blacksmith. Now I forge silence.',
      'The hammer remembers the hand that held it.',
      'Steel does not question orders.'
    ]
  },
  {
    key: 'tank',
    name: 'Tank',
    rank: 'Elite',
    emoji: '🐻',
    lines: [
      'The wall stands.',
      'Nothing passes. Nothing.',
      'I am the line you cannot cross.'
    ]
  },
  {
    key: 'kaisel',
    name: 'Kaisel',
    rank: 'Knight',
    emoji: '🦇',
    lines: [
      'The wyvern descends.',
      'Skies belong to the Monarch.',
      'I ride the winds he commands.'
    ]
  },
  {
    key: 'bellion',
    name: 'Bellion',
    rank: 'Grand Marshal',
    emoji: '🖤',
    lines: [
      'The oldest shadow remembers every war.',
      'I served before your world had a name.',
      'Grand Marshal of the Shadow Army. Reporting.'
    ]
  },
  {
    key: 'greed',
    name: 'Greed',
    rank: 'Knight',
    emoji: '👁️',
    lines: [
      'I take what is owed.',
      'Hunger has no rank.',
      'Everything returns to the shadow.'
    ]
  }
]

export function rollSoldier(seed = null) {
  if (seed !== null) {
    return SHADOW_SOLDIERS[seed % SHADOW_SOLDIERS.length]
  }
  return SHADOW_SOLDIERS[
    Math.floor(Math.random() * SHADOW_SOLDIERS.length)
  ]
}

/* -------------------------------------------------------------------------- */
/* System window renderer                                                     */
/* -------------------------------------------------------------------------- */

// Renders a Solo Leveling-style System window.
// Borders use box-drawing characters, blue-cyan aesthetic
// implied by the emoji header. WhatsApp renders these fine.

export function systemWindow(title, bodyLines = [], footerLines = []) {
  const inner = []
  inner.push(`╭━━〔 ◈ ${title} 〕━━╮`)
  inner.push('┃')

  for (const line of bodyLines) {
    inner.push(`┃ ${line}`)
  }

  if (footerLines.length) {
    inner.push('┃')
    inner.push('┣━━━━━━━━━━━━━━━━━━━━')
    for (const line of footerLines) {
      inner.push(`┃ ${line}`)
    }
  }

  inner.push('╰━━━━━━━━━━━━━━━━━━━━╯')
  return inner.join('\n')
}

/* -------------------------------------------------------------------------- */
/* Awakening sequence                                                         */
/* -------------------------------------------------------------------------- */

// The full .arise response.
// This is the "wakes up and reports" moment.

export function awakenSequence({
  displayName,
  xp = 0,
  level = 1,
  mode = 'public',
  uptime = '00s',
  groups = 0,
  seed = null
}) {
  const rank = rankForXp(xp)
  const next = nextRank(xp)
  const awakenLine = rollAwakenLine(seed)

  const body = [
    `*SYSTEM ONLINE.*`,
    '',
    awakenLine,
    '',
    `▸ Status : AWAKE`,
    `▸ Mode   : ${String(mode).toUpperCase()}`,
    `▸ Rank   : ${rank.color} ${rank.label}`,
    `▸ Level  : ${level}`,
    `▸ Groups : ${groups}`,
    `▸ Uptime : ${uptime}`
  ]

  const footer = next
    ? [
        `Next rank: ${next.color} ${next.label}`,
        `Progress : ${xp} / ${next.xpMin} XP`
      ]
    : [
        `You stand at the summit.`,
        `Rank: ${rank.color} ${rank.label}`
      ]

  return [
    systemWindow('A R I S E', body, footer),
    '',
    `_— the System acknowledges ${displayName}_`
  ].join('\n')
}

/* -------------------------------------------------------------------------- */
/* Hunter status window                                                       */
/* -------------------------------------------------------------------------- */

export function hunterStatusWindow({
  displayName,
  xp = 0,
  level = 1,
  coins = 0,
  bank = 0,
  messages = 0,
  wins = 0,
  losses = 0,
  streak = 0
}) {
  const rank = rankForXp(xp)
  const next = nextRank(xp)

  const progress = next
    ? `${xp} / ${next.xpMin} XP`
    : `${xp} XP (max)`

  return systemWindow(
    'H U N T E R   S T A T U S',
    [
      `▸ Name    : ${displayName}`,
      `▸ Rank    : ${rank.color} ${rank.label}`,
      `▸ Level   : ${level}`,
      `▸ XP      : ${progress}`,
      '',
      `▸ Wallet  : ${coins.toLocaleString()} KC`,
      `▸ Bank    : ${bank.toLocaleString()} KC`,
      `▸ Messages: ${messages}`,
      '',
      `▸ Wins    : ${wins}`,
      `▸ Losses  : ${losses}`,
      `▸ Streak  : ${streak}`
    ],
    [
      `_"The System does not forgive weakness."_`
    ]
  )
}

/* -------------------------------------------------------------------------- */
/* Shadow summon                                                              */
/* -------------------------------------------------------------------------- */

// Summons a shadow soldier to address a target.
// Used by .shadow @user.

export function shadowSummon({
  soldier,
  summonerName,
  targetMentionText,
  targetName
}) {
  const line = soldier.lines[
    Math.floor(Math.random() * soldier.lines.length)
  ]

  return [
    `╭━━〔 ◈ S H A D O W   S U M M O N 〕━━╮`,
    `┃`,
    `┃ ${soldier.emoji} *${soldier.name}* — ${soldier.rank}`,
    `┃`,
    `┃ _${line}_`,
    `┃`,
    `┃ ▸ Summoned by : ${summonerName}`,
    `┃ ▸ Target      : ${targetMentionText || targetName}`,
    `╰━━━━━━━━━━━━━━━━━━━━╯`,
    '',
    `_The shadow moves. ${targetName} has been marked._`
  ].join('\n')
}

/* -------------------------------------------------------------------------- */
/* Level-up window                                                            */
/* -------------------------------------------------------------------------- */

export function levelUpWindow({ displayName, level, rank }) {
  return systemWindow(
    'L E V E L   U P',
    [
      `▸ Hunter  : ${displayName}`,
      `▸ Level   : ${level}`,
      `▸ Rank    : ${rank.color} ${rank.label}`,
      '',
      `_"You have grown. The gate grows with you."_`
    ]
  )
}

/* -------------------------------------------------------------------------- */
/* Arise cooldown                                                             */
/* -------------------------------------------------------------------------- */

// Per-user in-memory cooldown so .arise can't be spammed
// every message. 10 minutes is enough that it feels like a
// meaningful "the System woke up" moment.

const ARISE_COOLDOWN_MS = 30 * 60 * 1000
const ariseCooldowns = new Map()

export function checkAriseCooldown(jid) {
  const last = ariseCooldowns.get(jid) || 0
  const now = Date.now()
  const remaining = ARISE_COOLDOWN_MS - (now - last)

  if (remaining > 0) {
    return {
      allowed: false,
      remainingMs: remaining
    }
  }

  return { allowed: true, remainingMs: 0 }
}

export function markArise(jid) {
  ariseCooldowns.set(jid, Date.now())
}

export function formatRemaining(ms) {
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}