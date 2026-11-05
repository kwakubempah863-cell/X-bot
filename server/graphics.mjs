import sharp from 'sharp'

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
const svg = ({title,subtitle,lines=[],avatar=null,footer='X • BempsX'}) => {
  const body = lines.map((x,i)=>`<text x="80" y="${330+i*42}" fill="#f5f5f5" font-family="Arial,sans-serif" font-size="25">${esc(x)}</text>`).join('')
  const image = avatar ? `<clipPath id="c"><circle cx="1050" cy="145" r="92"/></clipPath><image href="${esc(avatar)}" x="958" y="53" width="184" height="184" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675"><defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#0b1020"/><stop offset="1" stop-color="#24124a"/></linearGradient></defs><rect width="1200" height="675" rx="34" fill="url(#g)"/><circle cx="80" cy="70" r="18" fill="#9b6cff"/><text x="120" y="82" fill="#cdbbff" font-family="Arial,sans-serif" font-size="22" font-weight="700">X BOT</text>${image}<text x="80" y="180" fill="#fff" font-family="Arial,sans-serif" font-size="48" font-weight="800">${esc(title)}</text><text x="80" y="225" fill="#b9b9c8" font-family="Arial,sans-serif" font-size="24">${esc(subtitle)}</text>${body}<text x="80" y="625" fill="#8f8fa3" font-family="Arial,sans-serif" font-size="18">${esc(footer)}</text></svg>`
}
export async function cardBuffer(opts){ return sharp(Buffer.from(svg(opts))).png().toBuffer() }
export const profileCard = m => cardBuffer({title:m.username||m.display_name||'New member',subtitle:`Level ${m.level} • ${m.xp} XP`,lines:[`Wallet: ${m.coins} KC`,`Bank: ${m.bank} KC`,`Games: ${m.wins}W / ${m.losses}L`,`Reputation: ${m.reputation} • Streak: ${m.streak}`],avatar:m.avatar_url})
export const leaderboardCard = (name,rows,field) => cardBuffer({title:`${name} Leaderboard`,subtitle:`Top ${field}`,lines:rows.slice(0,7).map((m,i)=>`${i+1}. ${m.username||m.display_name||'New member'} — ${field==='coins'?(m.coins+m.bank):m[field]}`)})
export const eventCard = ({title,subtitle,member,avatar}) => cardBuffer({title,subtitle,lines:[member].filter(Boolean),avatar})

/* -------------------------------------------------------------------------- */
/* Command dossier card                                                       */
/* -------------------------------------------------------------------------- */

const CATEGORY_THEMES = {
  core:       { accent: '#5bc0eb', glow: '#3aa0cc', pattern: 'grid',      tag: 'CORE' },
  group:      { accent: '#4ade80', glow: '#22a05a', pattern: 'dots',      tag: 'GROUP' },
  moderation: { accent: '#f97316', glow: '#c95a10', pattern: 'stripes',   tag: 'MOD' },
  profile:    { accent: '#a78bfa', glow: '#7854d8', pattern: 'circles',   tag: 'PROFILE' },
  economy:    { accent: '#fbbf24', glow: '#c9901a', pattern: 'coins',     tag: 'ECONOMY' },
  games:      { accent: '#ec4899', glow: '#b52570', pattern: 'hexagons',  tag: 'GAMES' },
  anime:      { accent: '#f472b6', glow: '#c04a90', pattern: 'petals',    tag: 'ANIME' },
  manga:      { accent: '#fb7185', glow: '#c94864', pattern: 'panels',    tag: 'MANGA' },
  media:      { accent: '#06b6d4', glow: '#0494ad', pattern: 'waves',     tag: 'MEDIA' },
  actions:    { accent: '#ef4444', glow: '#b52c2c', pattern: 'splatter',  tag: 'ACTION' },
  ai:         { accent: '#8b5cf6', glow: '#6633d4', pattern: 'neurons',   tag: 'AI' },
  utilities:  { accent: '#64748b', glow: '#3e4a5c', pattern: 'grid',      tag: 'UTIL' },
  owner:      { accent: '#eab308', glow: '#b08a08', pattern: 'crowns',    tag: 'OWNER' },
  other:      { accent: '#94a3b8', glow: '#6b7688', pattern: 'grid',      tag: 'CMD' }
}

export async function commandCard({
  command,
  category = 'other',
  description = '',
  usage = '',
  reaction = null,
  admin = false,
  owner = false,
  responseText = '',
  senderName = 'User'
}) {
  const W = 900
  const H = 460

  const theme = CATEGORY_THEMES[category] || CATEGORY_THEMES.other

  /* -------------------------------------------
   * Pattern — SVG defs
   * ----------------------------------------- */
  const patternSvg = buildPatternSvg(theme.pattern, theme.accent)

  /* -------------------------------------------
   * Category tag (top right)
   * ----------------------------------------- */
  const tagText = esc(theme.tag)
  const tagW = tagText.length * 11 + 40
  const tagX = W - tagW - 40

  const tagSvg = `
    <rect x="${tagX}" y="30" width="${tagW}" height="36" rx="18"
      fill="${theme.accent}" fill-opacity="0.15"
      stroke="${theme.accent}" stroke-opacity="0.6" stroke-width="1.5"/>
    <text x="${tagX + tagW / 2}" y="54" fill="${theme.accent}"
      font-family="Arial,sans-serif" font-size="15" font-weight="700"
      text-anchor="middle" letter-spacing="1.5">${tagText}</text>
  `

  /* -------------------------------------------
   * Reaction emoji (top right, below tag)
   * ----------------------------------------- */
  const reactionSvg = reaction
    ? `<text x="${W - 60}" y="140" font-family="Arial,sans-serif"
        font-size="52" text-anchor="end">${esc(reaction)}</text>`
    : ''

  /* -------------------------------------------
   * Access badges
   * ----------------------------------------- */
  let badgeX = 60
  const badgeY = 190
  const badges = []

  if (admin) {
    badges.push(buildBadgeSvg(badgeX, badgeY, '🔐 ADMIN', '#f97316'))
    badgeX += 145
  }
  if (owner) {
    badges.push(buildBadgeSvg(badgeX, badgeY, '👑 OWNER', '#eab308'))
  }

  /* -------------------------------------------
   * Description — wrap into lines
   * ----------------------------------------- */
  const descMaxChars = 55
  const descLines = wrapText(description, descMaxChars)
  const descStartY = admin || owner ? 270 : 250

  const descSvg = descLines
    .slice(0, 3)
    .map(
      (line, i) =>
        `<text x="60" y="${descStartY + i * 30}" fill="#d4d4dc"
          font-family="Arial,sans-serif" font-size="20">${esc(line)}</text>`
    )
    .join('')

  const usageY = descStartY + Math.min(descLines.length, 3) * 30 + 30

  /* -------------------------------------------
   * Full SVG
   * ----------------------------------------- */
  const svgDoc = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#08080d"/>
          <stop offset="0.5" stop-color="#0d0d15"/>
          <stop offset="1" stop-color="#12121d"/>
        </linearGradient>
        <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${theme.glow}" stop-opacity="0.5"/>
          <stop offset="1" stop-color="${theme.glow}" stop-opacity="0"/>
        </linearGradient>
        ${patternSvg.defs}
      </defs>

      <!-- Background -->
      <rect width="${W}" height="${H}" rx="0" fill="url(#bg)"/>

      <!-- Pattern -->
      ${patternSvg.body}

      <!-- Left glow -->
      <rect x="0" y="0" width="60" height="${H}" fill="url(#glow)"/>

      <!-- Top accent bar -->
      <rect x="0" y="0" width="${W}" height="4" fill="${theme.accent}"/>

      <!-- Bottom accent line -->
      <rect x="0" y="${H - 2}" width="${W}" height="2"
        fill="${theme.accent}" fill-opacity="0.3"/>

      <!-- Corner brackets -->
      <path d="M 24 44 L 24 24 L 44 24" fill="none"
        stroke="${theme.accent}" stroke-opacity="0.5" stroke-width="2"/>
      <path d="M ${W - 44} ${H - 24} L ${W - 24} ${H - 24} L ${W - 24} ${H - 44}"
        fill="none" stroke="${theme.accent}" stroke-opacity="0.5" stroke-width="2"/>

      <!-- Category tag -->
      ${tagSvg}

      <!-- Reaction -->
      ${reactionSvg}

      <!-- Command name -->
      <text x="60" y="150" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="68" font-weight="800">.${esc(command)}</text>

      <!-- Underline -->
      <line x1="60" y1="172"
        x2="${60 + Math.min(500, 40 + String(command).length * 40)}" y2="172"
        stroke="${theme.accent}" stroke-width="3"/>

      <!-- Badges -->
      ${badges.join('')}

      <!-- Description -->
      ${descSvg}

      <!-- Usage label -->
      <text x="60" y="${usageY}" fill="${theme.accent}"
        font-family="Arial,sans-serif" font-size="16" font-weight="700"
        letter-spacing="1.5">USAGE</text>

      <!-- Usage text -->
      <text x="60" y="${usageY + 28}" fill="#e8e8ee"
        font-family="Consolas,monospace" font-size="19">${esc(usage || '.' + command)}</text>

      <!-- Footer -->
      <text x="${W - 40}" y="${H - 30}" fill="#5a5a70"
        font-family="Arial,sans-serif" font-size="14" text-anchor="end">
        requested by ${esc(senderName)} · X
      </text>
    </svg>
  `

  return sharp(Buffer.from(svgDoc)).png().toBuffer()
}


/* -------------------------------------------------------------------------- */
/* SVG helpers                                                                */
/* -------------------------------------------------------------------------- */

function buildBadgeSvg(x, y, text, color) {
  const w = text.length * 9 + 24
  return `
    <rect x="${x}" y="${y}" width="${w}" height="30" rx="15"
      fill="${color}" fill-opacity="0.18"
      stroke="${color}" stroke-opacity="0.6" stroke-width="1"/>
    <text x="${x + w / 2}" y="${y + 21}" fill="${color}"
      font-family="Arial,sans-serif" font-size="14" font-weight="700"
      text-anchor="middle">${esc(text)}</text>
  `
}

function wrapText(text, maxChars) {
  const words = String(text || '').split(/\s+/)
  const lines = []
  let line = ''

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (test.length > maxChars && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }

  if (line) lines.push(line)
  return lines
}

function buildPatternSvg(pattern, accent) {
  const W = 900
  const H = 460
  const stroke = 'rgba(255,255,255,0.035)'
  const fill = 'rgba(255,255,255,0.035)'

  switch (pattern) {
    case 'dots': {
      let body = ''
      for (let x = 30; x < W; x += 50) {
        for (let y = 30; y < H; y += 50) {
          body += `<circle cx="${x}" cy="${y}" r="2" fill="${fill}"/>`
        }
      }
      return { defs: '', body }
    }

    case 'stripes': {
      const lines = []
      for (let x = -H; x < W + H; x += 45) {
        lines.push(
          `<line x1="${x}" y1="0" x2="${x + H}" y2="${H}" stroke="${stroke}" stroke-width="1.5"/>`
        )
      }
      return { defs: '', body: lines.join('') }
    }

    case 'circles': {
      let body = ''
      for (let x = 60; x < W; x += 120) {
        for (let y = 60; y < H; y += 120) {
          body += `<circle cx="${x}" cy="${y}" r="28" fill="none" stroke="${stroke}" stroke-width="1"/>`
        }
      }
      return { defs: '', body }
    }

    case 'coins': {
      let body = ''
      for (let x = 50; x < W; x += 90) {
        for (let y = 50; y < H; y += 90) {
          body += `<circle cx="${x}" cy="${y}" r="14" fill="none" stroke="${stroke}" stroke-width="1"/>`
          body += `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${stroke}" stroke-width="1"/>`
        }
      }
      return { defs: '', body }
    }

    case 'hexagons': {
      let body = ''
      for (let x = 40; x < W; x += 70) {
        for (let y = 40; y < H; y += 70) {
          const pts = []
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i - Math.PI / 6
            pts.push(`${x + 18 * Math.cos(a)},${y + 18 * Math.sin(a)}`)
          }
          body += `<polygon points="${pts.join(' ')}" fill="none" stroke="${stroke}" stroke-width="1"/>`
        }
      }
      return { defs: '', body }
    }

    case 'petals': {
      let body = ''
      for (let x = 50; x < W; x += 100) {
        for (let y = 50; y < H; y += 100) {
          body += `<ellipse cx="${x}" cy="${y}" rx="10" ry="5" transform="rotate(45 ${x} ${y})" fill="none" stroke="${stroke}" stroke-width="1"/>`
          body += `<ellipse cx="${x}" cy="${y}" rx="10" ry="5" transform="rotate(-45 ${x} ${y})" fill="none" stroke="${stroke}" stroke-width="1"/>`
        }
      }
      return { defs: '', body }
    }

    case 'panels': {
      let body = ''
      for (let x = 0; x < W; x += 120) {
        body += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${stroke}" stroke-width="1.5"/>`
      }
      for (let y = 0; y < H; y += 120) {
        body += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${stroke}" stroke-width="1.5"/>`
      }
      return { defs: '', body }
    }

    case 'waves': {
      let body = ''
      for (let y = 0; y < H; y += 30) {
        const pts = []
        for (let x = 0; x < W; x += 20) {
          const wy = y + Math.sin(x / 40) * 8
          pts.push(`${x},${wy}`)
        }
        body += `<polyline points="${pts.join(' ')}" fill="none" stroke="${stroke}" stroke-width="1"/>`
      }
      return { defs: '', body }
    }

    case 'splatter': {
      let body = ''
      for (let i = 0; i < 40; i++) {
        const x = (i * 137) % W
        const y = (i * 89) % H
        const r = ((i * 7) % 5) + 1
        body += `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`
      }
      return { defs: '', body }
    }

    case 'neurons': {
      let body = ''
      for (let i = 0; i < 20; i++) {
        const x1 = (i * 71) % W
        const y1 = (i * 53) % H
        const x2 = (i * 131 + 200) % W
        const y2 = (i * 97 + 150) % H
        body += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1"/>`
        body += `<circle cx="${x1}" cy="${y1}" r="3" fill="${fill}"/>`
        body += `<circle cx="${x2}" cy="${y2}" r="3" fill="${fill}"/>`
      }
      return { defs: '', body }
    }

    case 'crowns': {
      let body = ''
      for (let x = 60; x < W; x += 140) {
        for (let y = 60; y < H; y += 140) {
          body += `<polygon points="${x - 15},${y + 10} ${x - 10},${y - 8} ${x},${y + 2} ${x + 10},${y - 8} ${x + 15},${y + 10}" fill="none" stroke="${stroke}" stroke-width="1.5"/>`
        }
      }
      return { defs: '', body }
    }

    case 'grid':
    default: {
      let body = ''
      for (let x = 0; x < W; x += 40) {
        body += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${stroke}" stroke-width="1"/>`
      }
      for (let y = 0; y < H; y += 40) {
        body += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${stroke}" stroke-width="1"/>`
      }
      return { defs: '', body }
    }
  }
}


/* -------------------------------------------------------------------------- */
/* VICE — character card                                                      */
/* -------------------------------------------------------------------------- */

const CAREER_THEMES = {
  assassin:   { accent: '#ef4444', tag: '🗡️ ASSASSIN',   sigil: '☠' },
  hacker:     { accent: '#06b6d4', tag: '🧠 HACKER',     sigil: '◈' },
  face:       { accent: '#a78bfa', tag: '🎭 FACE',       sigil: '♛' },
  smuggler:   { accent: '#fbbf24', tag: '🏴‍☠️ SMUGGLER', sigil: '⚓' },
  enforcer:   { accent: '#f97316', tag: '⚔️ ENFORCER',   sigil: '⚔' },
  none:       { accent: '#94a3b8', tag: 'UNASSIGNED',     sigil: '○' }
}

export async function viceCard({
  name = 'Operator',
  level = 1,
  xp = 0,
  hp = 100,
  maxHp = 100,
  energy = 100,
  maxEnergy = 100,
  nerve = 20,
  maxNerve = 20,
  strength = 5,
  agility = 5,
  tech = 5,
  cool = 5,
  credits = 0,
  bank = 0,
  aura = 0,
  kills = 0,
  deaths = 0,
  robberies = 0,
  busted = 0,
  career = 'none',
  factionName = null,
  hospitalUntil = null,
  jailUntil = null,
  avatarUrl = null
}) {
  const W = 900
  const H = 640

  const theme = CAREER_THEMES[career] || CAREER_THEMES.none

  /* -------------------------------------------
   * Bar renderer — returns an SVG bar block
   * ----------------------------------------- */
  const bar = (x, y, w, value, max, color) => {
    const pct = Math.max(0, Math.min(1, value / Math.max(1, max)))
    const fill = w * pct
    return `
      <rect x="${x}" y="${y}" width="${w}" height="12" rx="6"
        fill="#ffffff" fill-opacity="0.06"/>
      <rect x="${x}" y="${y}" width="${fill}" height="12" rx="6"
        fill="${color}"/>
    `
  }

  /* -------------------------------------------
   * Stats block — 4 stat tiles
   * ----------------------------------------- */
  const statTile = (x, y, label, value, color) => `
    <rect x="${x}" y="${y}" width="190" height="72" rx="12"
      fill="#ffffff" fill-opacity="0.04"
      stroke="${color}" stroke-opacity="0.35" stroke-width="1"/>
    <text x="${x + 18}" y="${y + 30}" fill="${color}"
      font-family="Arial,sans-serif" font-size="14" font-weight="700"
      letter-spacing="1.5">${esc(label)}</text>
    <text x="${x + 18}" y="${y + 58}" fill="#ffffff"
      font-family="Arial,sans-serif" font-size="28" font-weight="800">${value}</text>
  `

  /* -------------------------------------------
   * Status indicators
   * ----------------------------------------- */
  const now = Date.now()
  const inHospital = hospitalUntil && new Date(hospitalUntil).getTime() > now
  const inJail = jailUntil && new Date(jailUntil).getTime() > now

  const statusChips = []

  if (inHospital) {
    const remain = Math.ceil((new Date(hospitalUntil).getTime() - now) / 60000)
    statusChips.push(
      `<rect x="60" y="492" width="240" height="34" rx="17"
        fill="#ef4444" fill-opacity="0.18"
        stroke="#ef4444" stroke-opacity="0.6" stroke-width="1"/>
       <text x="180" y="514" fill="#ef4444"
        font-family="Arial,sans-serif" font-size="14" font-weight="700"
        text-anchor="middle">🏥 HOSPITALIZED · ${remain}m</text>`
    )
  }

  if (inJail) {
    const remain = Math.ceil((new Date(jailUntil).getTime() - now) / 60000)
    statusChips.push(
      `<rect x="60" y="492" width="240" height="34" rx="17"
        fill="#fbbf24" fill-opacity="0.18"
        stroke="#fbbf24" stroke-opacity="0.6" stroke-width="1"/>
       <text x="180" y="514" fill="#fbbf24"
        font-family="Arial,sans-serif" font-size="14" font-weight="700"
        text-anchor="middle">🚔 JAILED · ${remain}m</text>`
    )
  }

  if (!inHospital && !inJail) {
    statusChips.push(
      `<rect x="60" y="492" width="200" height="34" rx="17"
        fill="#4ade80" fill-opacity="0.18"
        stroke="#4ade80" stroke-opacity="0.6" stroke-width="1"/>
       <text x="160" y="514" fill="#4ade80"
        font-family="Arial,sans-serif" font-size="14" font-weight="700"
        text-anchor="middle">● ACTIVE</text>`
    )
  }

  /* -------------------------------------------
   * XP progress bar (small, top right)
   * ----------------------------------------- */
  const xpForNextLevel = level * 100
  const xpPct = Math.min(1, xp / xpForNextLevel)

  /* -------------------------------------------
   * Avatar circle (top right)
   * ----------------------------------------- */
  const avatarSvg = avatarUrl
    ? `
      <clipPath id="avatarClip">
        <circle cx="${W - 100}" cy="100" r="52"/>
      </clipPath>
      <image href="${esc(avatarUrl)}" x="${W - 152}" y="48"
        width="104" height="104"
        preserveAspectRatio="xMidYMid slice"
        clip-path="url(#avatarClip)"/>
      <circle cx="${W - 100}" cy="100" r="52" fill="none"
        stroke="${theme.accent}" stroke-width="3"/>
    `
    : `
      <circle cx="${W - 100}" cy="100" r="52" fill="${theme.accent}" fill-opacity="0.15"/>
      <circle cx="${W - 100}" cy="100" r="52" fill="none"
        stroke="${theme.accent}" stroke-width="3"/>
      <text x="${W - 100}" y="122" fill="${theme.accent}"
        font-family="Arial,sans-serif" font-size="44" font-weight="800"
        text-anchor="middle">${esc(String(name).charAt(0).toUpperCase())}</text>
    `

  /* -------------------------------------------
   * Full SVG
   * ----------------------------------------- */
  const svgDoc = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#05050a"/>
          <stop offset="0.5" stop-color="#0a0a14"/>
          <stop offset="1" stop-color="#12101d"/>
        </linearGradient>
        <linearGradient id="leftGlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${theme.accent}" stop-opacity="0.4"/>
          <stop offset="1" stop-color="${theme.accent}" stop-opacity="0"/>
        </linearGradient>
      </defs>

      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect x="0" y="0" width="80" height="${H}" fill="url(#leftGlow)"/>
      <rect x="0" y="0" width="${W}" height="4" fill="${theme.accent}"/>

      <!-- Corner brackets -->
      <path d="M 24 44 L 24 24 L 44 24" fill="none"
        stroke="${theme.accent}" stroke-opacity="0.5" stroke-width="2"/>
      <path d="M ${W - 44} ${H - 24} L ${W - 24} ${H - 24} L ${W - 24} ${H - 44}"
        fill="none" stroke="${theme.accent}" stroke-opacity="0.5" stroke-width="2"/>

      <!-- Career tag -->
      <rect x="60" y="60" width="${String(theme.tag).length * 12 + 30}" height="34" rx="17"
        fill="${theme.accent}" fill-opacity="0.15"
        stroke="${theme.accent}" stroke-opacity="0.6" stroke-width="1.5"/>
      <text x="${60 + (String(theme.tag).length * 12 + 30) / 2}" y="82"
        fill="${theme.accent}" font-family="Arial,sans-serif"
        font-size="14" font-weight="700" text-anchor="middle"
        letter-spacing="1.2">${esc(theme.tag)}</text>

      <!-- Avatar -->
      ${avatarSvg}

      <!-- Name -->
      <text x="60" y="160" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="42" font-weight="800">${esc(name)}</text>

      <!-- Level + XP -->
      <text x="60" y="200" fill="#b9b9c8"
        font-family="Arial,sans-serif" font-size="18">Level ${level}</text>
      <text x="${W - 60}" y="200" fill="#b9b9c8"
        font-family="Arial,sans-serif" font-size="16" text-anchor="end">
        ${xp} / ${xpForNextLevel} XP
      </text>

      <!-- XP bar -->
      <rect x="60" y="212" width="${W - 120}" height="8" rx="4"
        fill="#ffffff" fill-opacity="0.06"/>
      <rect x="60" y="212" width="${(W - 120) * xpPct}" height="8" rx="4"
        fill="${theme.accent}"/>

      <!-- HP bar -->
      <text x="60" y="266" fill="#b9b9c8"
        font-family="Arial,sans-serif" font-size="14" font-weight="600"
        letter-spacing="1.2">HP</text>
      <text x="${W - 60}" y="266" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="14" text-anchor="end">
        ${hp} / ${maxHp}
      </text>
      ${bar(60, 276, W - 120, hp, maxHp, '#ef4444')}

      <!-- Energy bar -->
      <text x="60" y="322" fill="#b9b9c8"
        font-family="Arial,sans-serif" font-size="14" font-weight="600"
        letter-spacing="1.2">ENERGY</text>
      <text x="${W - 60}" y="322" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="14" text-anchor="end">
        ${energy} / ${maxEnergy}
      </text>
      ${bar(60, 332, W - 120, energy, maxEnergy, '#fbbf24')}

      <!-- Nerve bar -->
      <text x="60" y="378" fill="#b9b9c8"
        font-family="Arial,sans-serif" font-size="14" font-weight="600"
        letter-spacing="1.2">NERVE</text>
      <text x="${W - 60}" y="378" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="14" text-anchor="end">
        ${nerve} / ${maxNerve}
      </text>
      ${bar(60, 388, W - 120, nerve, maxNerve, '#06b6d4')}

      <!-- Stats -->
      ${statTile(60, 420, 'STR', strength, '#ef4444')}
      ${statTile(265, 420, 'AGI', agility, '#fbbf24')}
      ${statTile(470, 420, 'TECH', tech, '#06b6d4')}
      ${statTile(675, 420, 'COOL', cool, '#a78bfa')}

      <!-- Status chips -->
      ${statusChips.join('')}

      <!-- Credits + Aura -->
      <text x="${W - 60}" y="514" fill="#fbbf24"
        font-family="Arial,sans-serif" font-size="20" font-weight="700"
        text-anchor="end">${credits.toLocaleString()} XC</text>
      <text x="${W - 60}" y="540" fill="#b9b9c8"
        font-family="Arial,sans-serif" font-size="14"
        text-anchor="end">Bank: ${bank.toLocaleString()} · Aura: ${aura}</text>

      <!-- Combat stats footer -->
      <text x="60" y="${H - 60}" fill="#6b6b80"
        font-family="Arial,sans-serif" font-size="13">KILLS</text>
      <text x="60" y="${H - 38}" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="22" font-weight="700">${kills}</text>

      <text x="180" y="${H - 60}" fill="#6b6b80"
        font-family="Arial,sans-serif" font-size="13">ROBBERIES</text>
      <text x="180" y="${H - 38}" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="22" font-weight="700">${robberies}</text>

      <text x="340" y="${H - 60}" fill="#6b6b80"
        font-family="Arial,sans-serif" font-size="13">BUSTED</text>
      <text x="340" y="${H - 38}" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="22" font-weight="700">${busted}</text>

      <text x="470" y="${H - 60}" fill="#6b6b80"
        font-family="Arial,sans-serif" font-size="13">DEATHS</text>
      <text x="470" y="${H - 38}" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="22" font-weight="700">${deaths}</text>

      <!-- Faction -->
      ${factionName ? `
      <text x="${W - 60}" y="${H - 60}" fill="#6b6b80"
        font-family="Arial,sans-serif" font-size="13" text-anchor="end">CREW</text>
      <text x="${W - 60}" y="${H - 38}" fill="${theme.accent}"
        font-family="Arial,sans-serif" font-size="20" font-weight="700"
        text-anchor="end">${esc(factionName)}</text>
      ` : ''}
    </svg>
  `

  return sharp(Buffer.from(svgDoc)).png().toBuffer()
}

/* -------------------------------------------------------------------------- */
/* VICE — crew card                                                           */
/* -------------------------------------------------------------------------- */

export async function crewCard({
  name,
  level = 1,
  reputation = 0,
  bank = 0,
  warsWon = 0,
  warsLost = 0,
  leaderName = 'Unknown',
  memberCount = 1,
  maxMembers = 30
}) {
  const W = 900
  const H = 500

  const accent = '#a78bfa'
  const glow = '#7854d8'

  const repForNextLevel = level * 500
  const repPct = Math.min(1, reputation / Math.max(1, repForNextLevel))

  const memberPct = Math.min(1, memberCount / maxMembers)

  const svgDoc = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#07060f"/>
          <stop offset="0.5" stop-color="#0d0b18"/>
          <stop offset="1" stop-color="#18112e"/>
        </linearGradient>
        <linearGradient id="leftGlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="${glow}" stop-opacity="0.45"/>
          <stop offset="1" stop-color="${glow}" stop-opacity="0"/>
        </linearGradient>
      </defs>

      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect x="0" y="0" width="80" height="${H}" fill="url(#leftGlow)"/>
      <rect x="0" y="0" width="${W}" height="4" fill="${accent}"/>

      <path d="M 24 44 L 24 24 L 44 24" fill="none"
        stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/>
      <path d="M ${W - 44} ${H - 24} L ${W - 24} ${H - 24} L ${W - 24} ${H - 44}"
        fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/>

      <text x="60" y="60" fill="${accent}"
        font-family="Arial,sans-serif" font-size="13" font-weight="700"
        letter-spacing="2">CREW</text>

      <text x="60" y="120" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="52" font-weight="800">${esc(name)}</text>

      <text x="60" y="155" fill="#b9b9c8"
        font-family="Arial,sans-serif" font-size="16">
        Led by ${esc(leaderName)}
      </text>

      <text x="${W - 60}" y="100" fill="${accent}"
        font-family="Arial,sans-serif" font-size="44" font-weight="800"
        text-anchor="end">LV ${level}</text>

      <text x="${W - 60}" y="130" fill="#6b6b80"
        font-family="Arial,sans-serif" font-size="13"
        text-anchor="end" letter-spacing="1.5">LEVEL</text>

      <!-- Reputation bar -->
      <text x="60" y="215" fill="#b9b9c8"
        font-family="Arial,sans-serif" font-size="14" font-weight="600"
        letter-spacing="1.2">REPUTATION</text>
      <text x="${W - 60}" y="215" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="14" text-anchor="end">
        ${reputation} / ${repForNextLevel}
      </text>
      <rect x="60" y="225" width="${W - 120}" height="12" rx="6"
        fill="#ffffff" fill-opacity="0.06"/>
      <rect x="60" y="225" width="${(W - 120) * repPct}" height="12" rx="6"
        fill="${accent}"/>

      <!-- Member bar -->
      <text x="60" y="275" fill="#b9b9c8"
        font-family="Arial,sans-serif" font-size="14" font-weight="600"
        letter-spacing="1.2">MEMBERS</text>
      <text x="${W - 60}" y="275" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="14" text-anchor="end">
        ${memberCount} / ${maxMembers}
      </text>
      <rect x="60" y="285" width="${W - 120}" height="12" rx="6"
        fill="#ffffff" fill-opacity="0.06"/>
      <rect x="60" y="285" width="${(W - 120) * memberPct}" height="12" rx="6"
        fill="#fbbf24"/>

      <!-- Bank -->
      <text x="60" y="355" fill="#6b6b80"
        font-family="Arial,sans-serif" font-size="13" letter-spacing="1.5">CREW BANK</text>
      <text x="60" y="392" fill="#fbbf24"
        font-family="Arial,sans-serif" font-size="34" font-weight="800">${bank.toLocaleString()}</text>
      <text x="60" y="415" fill="#6b6b80"
        font-family="Arial,sans-serif" font-size="14">XC</text>

      <!-- War record -->
      <text x="${W - 200}" y="355" fill="#6b6b80"
        font-family="Arial,sans-serif" font-size="13" letter-spacing="1.5">WAR RECORD</text>
      <text x="${W - 200}" y="392" fill="#4ade80"
        font-family="Arial,sans-serif" font-size="34" font-weight="800">${warsWon}</text>
      <text x="${W - 160}" y="392" fill="#6b6b80"
        font-family="Arial,sans-serif" font-size="28">/</text>
      <text x="${W - 130}" y="392" fill="#ef4444"
        font-family="Arial,sans-serif" font-size="34" font-weight="800">${warsLost}</text>

      <text x="${W - 60}" y="${H - 30}" fill="#5a5a70"
        font-family="Arial,sans-serif" font-size="14" text-anchor="end">
        X: VICE · Crew Card
      </text>
    </svg>
  `

  return sharp(Buffer.from(svgDoc)).png().toBuffer()
}

/* -------------------------------------------------------------------------- */
/* VICE — war card                                                            */
/* -------------------------------------------------------------------------- */

export async function warCard({
  attackerName,
  defenderName,
  attackerScore = 0,
  defenderScore = 0,
  territoryName = 'Unclaimed Territory',
  hoursRemaining = 0,
  minutesRemaining = 0
}) {
  const W = 900
  const H = 500

  const total = Math.max(1, attackerScore + defenderScore)
  const attackerPct = attackerScore / total
  const defenderPct = defenderScore / total

  const barW = W - 120
  const attackerBarW = barW * attackerPct

  const attackerWinning = attackerScore > defenderScore
  const defenderWinning = defenderScore > attackerScore
  const isTied = attackerScore === defenderScore

  const attackerColor = attackerWinning ? '#4ade80' : '#a78bfa'
  const defenderColor = defenderWinning ? '#4ade80' : '#ef4444'

  const svgDoc = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#0a0608"/>
          <stop offset="0.5" stop-color="#120810"/>
          <stop offset="1" stop-color="#1a0a14"/>
        </linearGradient>
      </defs>

      <rect width="${W}" height="${H}" fill="url(#bg)"/>
      <rect x="0" y="0" width="${W}" height="4" fill="#ef4444"/>
      <rect x="0" y="${H - 2}" width="${W}" height="2" fill="#ef4444" fill-opacity="0.4"/>

      <path d="M 24 44 L 24 24 L 44 24" fill="none"
        stroke="#ef4444" stroke-opacity="0.5" stroke-width="2"/>
      <path d="M ${W - 44} ${H - 24} L ${W - 24} ${H - 24} L ${W - 24} ${H - 44}"
        fill="none" stroke="#ef4444" stroke-opacity="0.5" stroke-width="2"/>

      <text x="60" y="60" fill="#ef4444"
        font-family="Arial,sans-serif" font-size="13" font-weight="700"
        letter-spacing="2">TERRITORY WAR</text>

      <text x="${W / 2}" y="120" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="34" font-weight="800"
        text-anchor="middle">${esc(territoryName)}</text>

      <text x="${W / 2}" y="150" fill="#b9b9c8"
        font-family="Arial,sans-serif" font-size="14"
        text-anchor="middle">Time remaining · ${hoursRemaining}h ${minutesRemaining}m</text>

      <!-- VS block -->
      <text x="60" y="215" fill="${attackerColor}"
        font-family="Arial,sans-serif" font-size="28" font-weight="800">${esc(attackerName)}</text>
      <text x="60" y="255" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="48" font-weight="800">${attackerScore.toLocaleString()}</text>

      <text x="${W / 2}" y="245" fill="#6b6b80"
        font-family="Arial,sans-serif" font-size="36" font-weight="800"
        text-anchor="middle">VS</text>

      <text x="${W - 60}" y="215" fill="${defenderColor}"
        font-family="Arial,sans-serif" font-size="28" font-weight="800"
        text-anchor="end">${esc(defenderName)}</text>
      <text x="${W - 60}" y="255" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="48" font-weight="800"
        text-anchor="end">${defenderScore.toLocaleString()}</text>

      <!-- Progress bar -->
      <rect x="60" y="295" width="${barW}" height="20" rx="10"
        fill="#ffffff" fill-opacity="0.06"/>
      <rect x="60" y="295" width="${attackerBarW}" height="20" rx="10"
        fill="${attackerColor}"/>
      <rect x="${60 + attackerBarW}" y="295" width="${barW - attackerBarW}" height="20" rx="10"
        fill="${defenderColor}" fill-opacity="0.85"/>

      <!-- Status -->
      ${isTied
        ? `<text x="${W / 2}" y="370" fill="#fbbf24"
             font-family="Arial,sans-serif" font-size="20" font-weight="700"
             text-anchor="middle">DEADLOCK — scores tied</text>`
        : attackerWinning
          ? `<text x="${W / 2}" y="370" fill="${attackerColor}"
               font-family="Arial,sans-serif" font-size="20" font-weight="700"
               text-anchor="middle">${esc(attackerName)} is winning</text>`
          : `<text x="${W / 2}" y="370" fill="${defenderColor}"
               font-family="Arial,sans-serif" font-size="20" font-weight="700"
               text-anchor="middle">${esc(defenderName)} is winning</text>`
      }

      <text x="60" y="${H - 60}" fill="#6b6b80"
        font-family="Arial,sans-serif" font-size="13" letter-spacing="1.5">ATTACK</text>
      <text x="60" y="${H - 30}" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="18"
        font-weight="700">.war attack</text>

      <text x="${W - 60}" y="${H - 60}" fill="#6b6b80"
        font-family="Arial,sans-serif" font-size="13"
        text-anchor="end" letter-spacing="1.5">STATUS</text>
      <text x="${W - 60}" y="${H - 30}" fill="#ffffff"
        font-family="Arial,sans-serif" font-size="18" font-weight="700"
        text-anchor="end">.war status</text>
    </svg>
  `

  return sharp(Buffer.from(svgDoc)).png().toBuffer()
}

/* -------------------------------------------------------------------------- */
/* Game boards                                                                */
/* -------------------------------------------------------------------------- */

/*
 * Shared frame. Draws the outer panel with title, subtitle,
 * and a colored accent that depends on the game.
 */
function gameFrame({
  width,
  height,
  title,
  subtitle,
  accent = '#5bc0eb',
  body = ''
}) {
  return `
    <defs>
      <linearGradient id="gameBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#08080d"/>
        <stop offset="0.5" stop-color="#0d0d15"/>
        <stop offset="1" stop-color="#12121d"/>
      </linearGradient>
      <linearGradient id="gameGlow" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${accent}" stop-opacity="0.5"/>
        <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <rect width="${width}" height="${height}" fill="url(#gameBg)"/>
    <rect x="0" y="0" width="60" height="${height}" fill="url(#gameGlow)"/>
    <rect x="0" y="0" width="${width}" height="4" fill="${accent}"/>

    <path d="M 24 44 L 24 24 L 44 24" fill="none"
      stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/>
    <path d="M ${width - 44} ${height - 24} L ${width - 24} ${height - 24} L ${width - 24} ${height - 44}"
      fill="none" stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/>

    <text x="60" y="58" fill="${accent}"
      font-family="Arial,sans-serif" font-size="13" font-weight="700"
      letter-spacing="2">${escapeSvg(title)}</text>

    <text x="60" y="90" fill="#ffffff"
      font-family="Arial,sans-serif" font-size="28" font-weight="800">${escapeSvg(subtitle)}</text>

    ${body}

    <text x="${width - 40}" y="${height - 20}" fill="#5a5a70"
      font-family="Arial,sans-serif" font-size="13" text-anchor="end">
      X · VICE
    </text>
  `
}

function escapeSvg(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/* -------------------------------------------------------------------------- */
/* Tic tac toe                                                                */
/* -------------------------------------------------------------------------- */

export async function tictactoeBoard({
  cells,
  currentTurn,
  winner = null,
  draw = false
}) {
  const W = 900
  const H = 700

  const cellSize = 160
  const gap = 20
  const boardW = cellSize * 3 + gap * 2
  const boardX = (W - boardW) / 2
  const boardY = 180

  let body = ''

  /* Winning line highlight */
  const winningLines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ]

  let winningCells = new Set()
  if (winner !== null) {
    for (const line of winningLines) {
      const [a, b, c] = line
      if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
        winningCells = new Set(line)
        break
      }
    }
  }

  for (let i = 0; i < 9; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = boardX + col * (cellSize + gap)
    const y = boardY + row * (cellSize + gap)

    const isWinning = winningCells.has(i)
    const value = cells[i]

    const fill = isWinning
      ? 'rgba(74, 222, 128, 0.18)'
      : 'rgba(255, 255, 255, 0.04)'

    const stroke = isWinning
      ? '#4ade80'
      : '#5bc0eb'

    const strokeOpacity = isWinning ? '0.9' : '0.3'

    body += `
      <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="16"
        fill="${fill}"
        stroke="${stroke}" stroke-opacity="${strokeOpacity}" stroke-width="${isWinning ? 3 : 1.5}"/>
    `

    if (value === 'X') {
      body += `
        <text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 30}"
          fill="#5bc0eb"
          font-family="Arial,sans-serif" font-size="110" font-weight="800"
          text-anchor="middle">X</text>
      `
    } else if (value === 'O') {
      body += `
        <text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 30}"
          fill="#fbbf24"
          font-family="Arial,sans-serif" font-size="110" font-weight="800"
          text-anchor="middle">O</text>
      `
    } else {
      /* Show the cell number so players know what to react with */
      body += `
        <text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 25}"
          fill="#3a3a50"
          font-family="Arial,sans-serif" font-size="72" font-weight="700"
          text-anchor="middle">${i + 1}</text>
      `
    }
  }

  /* Status line below the board */
  let statusText = ''
  if (winner !== null) {
    statusText = winner === 'X' ? 'X wins!' : 'O wins!'
  } else if (draw) {
    statusText = 'Draw.'
  } else {
    statusText = `Turn: ${currentTurn} — react with 1-9 or type .tictactoe <n>`
  }

  body += `
    <text x="${W / 2}" y="${boardY + boardW + 70}"
      fill="#ffffff"
      font-family="Arial,sans-serif" font-size="22" font-weight="700"
      text-anchor="middle">${escapeSvg(statusText)}</text>
  `

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${gameFrame({
        width: W,
        height: H,
        title: 'TIC · TAC · TOE',
        subtitle: 'X vs O',
        accent: '#5bc0eb',
        body
      })}
    </svg>
  `

  return sharp(Buffer.from(svg)).png().toBuffer()
}

/* -------------------------------------------------------------------------- */
/* Connect 4                                                                  */
/* -------------------------------------------------------------------------- */

export async function connect4Board({
  board,
  currentTurn,
  winner = null,
  draw = false,
  lastDrop = null
}) {
  const W = 900
  const H = 780

  const cellSize = 90
  const gap = 8
  const boardW = cellSize * 7 + gap * 6
  const boardH = cellSize * 6 + gap * 5
  const boardX = (W - boardW) / 2
  const boardY = 180

  let body = ''

  /* Board background */
  body += `
    <rect x="${boardX - 16}" y="${boardY - 16}"
      width="${boardW + 32}" height="${boardH + 32}" rx="20"
      fill="rgba(255,255,255,0.03)"
      stroke="#5bc0eb" stroke-opacity="0.3" stroke-width="1.5"/>
  `

  /* Column number labels above the board */
  for (let c = 0; c < 7; c++) {
    const x = boardX + c * (cellSize + gap) + cellSize / 2
    body += `
      <text x="${x}" y="${boardY - 30}"
        fill="#5bc0eb"
        font-family="Arial,sans-serif" font-size="28" font-weight="700"
        text-anchor="middle">${c + 1}</text>
    `
  }

  /* Cells */
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const x = boardX + c * (cellSize + gap)
      const y = boardY + r * (cellSize + gap)
      const value = board[r][c]

      const isLastDrop =
        lastDrop &&
        lastDrop.row === r &&
        lastDrop.col === c

      let fill = '#0a0a12'
      let stroke = '#2a2a3a'

      if (value === 'R') {
        fill = '#ef4444'
        stroke = isLastDrop ? '#ffffff' : '#991b1b'
      } else if (value === 'Y') {
        fill = '#fbbf24'
        stroke = isLastDrop ? '#ffffff' : '#a16207'
      }

      body += `
        <circle cx="${x + cellSize / 2}" cy="${y + cellSize / 2}"
          r="${cellSize / 2 - 4}"
          fill="${fill}"
          stroke="${stroke}" stroke-width="${isLastDrop ? 4 : 2}"/>
      `
    }
  }

  let statusText = ''
  if (winner !== null) {
    statusText = winner === 'R' ? 'Red wins!' : 'Yellow wins!'
  } else if (draw) {
    statusText = 'Draw — board full.'
  } else {
    statusText = `Turn: ${currentTurn} — react 1-7 or type .connect4 <n>`
  }

  body += `
    <text x="${W / 2}" y="${boardY + boardH + 70}"
      fill="#ffffff"
      font-family="Arial,sans-serif" font-size="22" font-weight="700"
      text-anchor="middle">${escapeSvg(statusText)}</text>
  `

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${gameFrame({
        width: W,
        height: H,
        title: 'CONNECT · 4',
        subtitle: 'Red vs Yellow',
        accent: '#ef4444',
        body
      })}
    </svg>
  `

  return sharp(Buffer.from(svg)).png().toBuffer()
}

/* -------------------------------------------------------------------------- */
/* Slots                                                                      */
/* -------------------------------------------------------------------------- */

export async function slotReel({ symbols, spinning = false }) {
  const W = 900
  const H = 540

  const reelW = 200
  const reelH = 240
  const gap = 30
  const totalW = reelW * 3 + gap * 2
  const startX = (W - totalW) / 2
  const startY = 180

  let body = ''

  const colors = {
    '🍒': '#dc2626',
    '🍋': '#eab308',
    '🍇': '#7c3aed',
    '⭐': '#fbbf24',
    '💎': '#06b6d4',
    '7️⃣': '#ef4444'
  }

  for (let i = 0; i < 3; i++) {
    const x = startX + i * (reelW + gap)
    const symbol = symbols[i] || '?'

    const color = colors[symbol] || '#5bc0eb'

    /* Reel background */
    body += `
      <rect x="${x}" y="${startY}" width="${reelW}" height="${reelH}" rx="20"
        fill="rgba(255,255,255,0.05)"
        stroke="${color}" stroke-opacity="0.4" stroke-width="2"/>
    `

    if (spinning) {
      /* Motion blur effect */
      body += `
        <text x="${x + reelW / 2}" y="${startY + reelH / 2 + 20}"
          fill="${color}" fill-opacity="0.3"
          font-family="Arial,sans-serif" font-size="100" font-weight="800"
          text-anchor="middle">?</text>
      `
    } else {
      /* Symbol */
      body += `
        <text x="${x + reelW / 2}" y="${startY + reelH / 2 + 40}"
          fill="#ffffff"
          font-family="Arial,sans-serif" font-size="140" font-weight="800"
          text-anchor="middle">${escapeSvg(symbol)}</text>
      `
    }
  }

  const subtitle = spinning
    ? 'Spinning…'
    : symbols.join(' · ')

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${gameFrame({
        width: W,
        height: H,
        title: 'SLOT · MACHINE',
        subtitle,
        accent: '#ec4899',
        body
      })}
    </svg>
  `

  return sharp(Buffer.from(svg)).png().toBuffer()
}

export async function slotResult({ symbols, net, cost, winnings }) {
  const W = 900
  const H = 540

  const reelW = 200
  const reelH = 240
  const gap = 30
  const totalW = reelW * 3 + gap * 2
  const startX = (W - totalW) / 2
  const startY = 150

  let body = ''

  const colors = {
    '🍒': '#dc2626',
    '🍋': '#eab308',
    '🍇': '#7c3aed',
    '⭐': '#fbbf24',
    '💎': '#06b6d4',
    '7️⃣': '#ef4444'
  }

  const allSame = symbols[0] === symbols[1] && symbols[1] === symbols[2]
  const isWin = net > 0

  for (let i = 0; i < 3; i++) {
    const x = startX + i * (reelW + gap)
    const symbol = symbols[i]
    const color = colors[symbol] || '#5bc0eb'

    const isWinningSymbol = allSame && isWin

    body += `
      <rect x="${x}" y="${startY}" width="${reelW}" height="${reelH}" rx="20"
        fill="${isWinningSymbol ? 'rgba(74, 222, 128, 0.15)' : 'rgba(255,255,255,0.05)'}"
        stroke="${isWinningSymbol ? '#4ade80' : color}"
        stroke-opacity="${isWinningSymbol ? '0.9' : '0.4'}"
        stroke-width="${isWinningSymbol ? 3 : 2}"/>
    `

    body += `
      <text x="${x + reelW / 2}" y="${startY + reelH / 2 + 40}"
        fill="#ffffff"
        font-family="Arial,sans-serif" font-size="140" font-weight="800"
        text-anchor="middle">${escapeSvg(symbol)}</text>
    `
  }

  /* Result line */
  let resultText = ''
  let resultColor = '#94a3b8'

  if (net > 0) {
    resultText = `JACKPOT · +${net} XC`
    resultColor = '#4ade80'
  } else if (net === 0) {
    resultText = `Broke even · +${winnings} XC back`
    resultColor = '#fbbf24'
  } else {
    resultText = `Lost · ${net} XC`
    resultColor = '#ef4444'
  }

  body += `
    <text x="${W / 2}" y="${startY + reelH + 70}"
      fill="${resultColor}"
      font-family="Arial,sans-serif" font-size="32" font-weight="800"
      text-anchor="middle">${escapeSvg(resultText)}</text>
  `

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${gameFrame({
        width: W,
        height: H,
        title: 'SLOT · MACHINE',
        subtitle: symbols.join(' · '),
        accent: isWin ? '#4ade80' : '#ec4899',
        body
      })}
    </svg>
  `

  return sharp(Buffer.from(svg)).png().toBuffer()
}

/* -------------------------------------------------------------------------- */
/* Wordle                                                                     */
/* -------------------------------------------------------------------------- */

export async function wordleGrid({
  guesses,
  target,
  wordLength,
  attemptsLeft,
  won = false,
  lost = false
}) {
  const W = 900
  const H = 760

  const cellSize = 70
  const gap = 8
  const gridW = cellSize * wordLength + gap * (wordLength - 1)
  const startX = (W - gridW) / 2
  const startY = 180

  let body = ''

  const evaluate = (guess, target) => {
    const result = new Array(guess.length).fill('gray')
    const remaining = target.split('')

    /* First pass: exact matches */
    for (let i = 0; i < guess.length; i++) {
      if (guess[i] === target[i]) {
        result[i] = 'green'
        remaining[i] = null
      }
    }

    /* Second pass: present elsewhere */
    for (let i = 0; i < guess.length; i++) {
      if (result[i] === 'green') continue
      const idx = remaining.indexOf(guess[i])
      if (idx >= 0) {
        result[i] = 'yellow'
        remaining[idx] = null
      }
    }

    return result
  }

  const colorMap = {
    green: { fill: 'rgba(74, 222, 128, 0.2)', stroke: '#4ade80', text: '#4ade80' },
    yellow: { fill: 'rgba(251, 191, 36, 0.2)', stroke: '#fbbf24', text: '#fbbf24' },
    gray: { fill: 'rgba(255, 255, 255, 0.05)', stroke: '#4a4a5a', text: '#9a9aae' }
  }

  for (let row = 0; row < guesses.length; row++) {
    const guess = guesses[row]
    const result = evaluate(guess, target)

    for (let col = 0; col < wordLength; col++) {
      const x = startX + col * (cellSize + gap)
      const y = startY + row * (cellSize + gap)

      const letter = guess[col] || ''
      const hint = result[col]
      const theme = colorMap[hint]

      body += `
        <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="8"
          fill="${theme.fill}"
          stroke="${theme.stroke}" stroke-width="2"/>
        <text x="${x + cellSize / 2}" y="${y + cellSize / 2 + 12}"
          fill="${theme.text}"
          font-family="Arial,sans-serif" font-size="36" font-weight="800"
          text-anchor="middle">${escapeSvg(letter.toUpperCase())}</text>
      `
    }
  }

  /* Status line */
  let statusText = ''
  let statusColor = '#ffffff'

  if (won) {
    statusText = `Solved in ${guesses.length}!`
    statusColor = '#4ade80'
  } else if (lost) {
    statusText = `Word was: ${target.toUpperCase()}`
    statusColor = '#ef4444'
  } else {
    statusText = `${attemptsLeft} attempts left — type .wordle <word>`
    statusColor = '#fbbf24'
  }

  body += `
    <text x="${W / 2}" y="${startY + guesses.length * (cellSize + gap) + 60}"
      fill="${statusColor}"
      font-family="Arial,sans-serif" font-size="24" font-weight="700"
      text-anchor="middle">${escapeSvg(statusText)}</text>
  `

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${gameFrame({
        width: W,
        height: H,
        title: 'WORD · GAME',
        subtitle: `${wordLength} letters`,
        accent: won ? '#4ade80' : '#a78bfa',
        body
      })}
    </svg>
  `

  return sharp(Buffer.from(svg)).png().toBuffer()
}

/* -------------------------------------------------------------------------- */
/* Coin flip                                                                  */
/* -------------------------------------------------------------------------- */

export async function coinFlip({ side = null, spinning = false }) {
  const W = 900
  const H = 540

  const cx = W / 2
  const cy = 320
  const r = 130

  let body = ''

  if (spinning) {
    body += `
      <circle cx="${cx}" cy="${cy}" r="${r}"
        fill="rgba(251, 191, 36, 0.15)"
        stroke="#fbbf24" stroke-opacity="0.5" stroke-width="3"/>
      <text x="${cx}" y="${cy + 20}"
        fill="#fbbf24" fill-opacity="0.5"
        font-family="Arial,sans-serif" font-size="80" font-weight="800"
        text-anchor="middle">?</text>
    `
  } else {
    const isHeads = side === 'heads'
    const color = isHeads ? '#fbbf24' : '#5bc0eb'
    const label = isHeads ? 'HEADS' : 'TAILS'

    body += `
      <circle cx="${cx}" cy="${cy}" r="${r}"
        fill="rgba(251, 191, 36, 0.1)"
        stroke="${color}" stroke-width="4"/>
      <text x="${cx}" y="${cy + 20}"
        fill="${color}"
        font-family="Arial,sans-serif" font-size="72" font-weight="800"
        text-anchor="middle">${label}</text>
    `
  }

  const subtitle = spinning ? 'Flipping…' : side ? side.toUpperCase() : '—'

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
      ${gameFrame({
        width: W,
        height: H,
        title: 'COIN · FLIP',
        subtitle,
        accent: '#fbbf24',
        body
      })}
    </svg>
  `

  return sharp(Buffer.from(svg)).png().toBuffer()
}