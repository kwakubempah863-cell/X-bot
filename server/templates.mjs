export const welcomeStyles = [
  'mysterious',
  'battle',
  'royal',
  'chaotic',
  'god_tier'
]

/*
 * Build a WhatsApp-renderable mention.
 *
 * WhatsApp only renders a mention when the message text contains
 * "@<digits>" where <digits> matches the user portion of a JID that
 * is present in the `mentions` array.
 *
 * Examples:
 *   233500835166@s.whatsapp.net  ->  { text: '@233500835166', jid: '...' }
 *   12345@lid                    ->  { text: '@12345',        jid: '...' }
 *   abc-123@c.us                 ->  { text: '@abc-123',      jid: '...' }
 */
export function createMention(jid) {
  const validJid =
    typeof jid === 'string'
      ? jid.trim()
      : ''

  if (!validJid) {
    return {
      text: '',
      jid: null
    }
  }

  const userPart =
    validJid
      .split('@')[0]
      .split(':')[0]

  if (!userPart) {
    return {
      text: '',
      jid: null
    }
  }

  return {
    text: `@${userPart}`,
    jid: validJid
  }
}

export function mentionPayload(jid) {
  const mention =
    createMention(jid)

  return {
    text:
      mention.text,
    mentions:
      mention.jid
        ? [mention.jid]
        : []
  }
}

export function mentionPayloadMany(jids) {
  const validJids =
    Array.isArray(jids)
      ? jids
          .filter(
            jid =>
              typeof jid === 'string' &&
              jid.trim()
          )
          .map(jid => jid.trim())
      : []

  const mentions = []
  const parts = []

  for (const jid of validJids) {
    const mention =
      createMention(jid)

    if (!mention.jid) {
      continue
    }

    parts.push(mention.text)
    mentions.push(mention.jid)
  }

  return {
    text:
      parts.join(' '),
    mentions
  }
}

const welcomeCopy = {
  mysterious: ({ groupName, user }) => [
    `🌌 DOMAIN: ${groupName}`,
    '',
    '👁️ Something has entered.',
    '',
    'The atmosphere shifted.',
    'The aura changed.',
    'Even the silence noticed.',
    '',
    `⚡ ${user} has arrived.`,
    '',
    '🔮 IDENTIFYING NEW PRESENCE...',
    '',
    'Status: 🟡 UNREGISTERED',
    '',
    'Before you take your place among us,',
    'reveal yourself.',
    '',
    '📸 Your picture',
    '👤 Your name',
    '📍 Location (optional, City/Country)',
    '',
    'Welcome to the domain.'
  ].join('\n'),

  battle: ({ groupName, user }) => [
    `⚔️ ${groupName.toUpperCase()} ARENA ⚔️`,
    '',
    'NEW CHALLENGER DETECTED.',
    '',
    'The gates have opened.',
    '',
    `🔥 ${user} has entered the arena.`,
    '',
    'Power level: UNKNOWN',
    'Aura: UNSTABLE',
    'Rank: UNREGISTERED',
    '',
    'Before the battle begins...',
    '',
    '📸 Show us your face',
    '👤 Tell us your name',
    '📍 Tell us your city/country (optional)',
    '',
    'Welcome, challenger. 😈'
  ].join('\n'),

  royal: ({ groupName, user }) => [
    `👑 ATTENTION, ${groupName.toUpperCase()} 👑`,
    '',
    'A new presence has arrived in the kingdom.',
    '',
    `✨ ${user} ✨`,
    '',
    'The court awaits your introduction.',
    '',
    '📸 Picture',
    '👤 Name',
    '📍 Location (optional, City/Country)',
    '',
    'Take your place among us.'
  ].join('\n'),

  chaotic: ({ groupName, user }) => [
    `🚨 ${groupName.toUpperCase()} SECURITY ALERT 🚨`,
    '',
    'A NEW HUMAN HAS SPAWNED.',
    '',
    `👤 ${user}`,
    '',
    'Identity: Loading...',
    'Aura: Suspicious...',
    'Vibes: Currently under investigation...',
    '',
    'Please submit:',
    '',
    '📸 Face reveal',
    '👤 Name',
    '📍 City/Country (optional)',
    '',
    'X is watching. 👁️😂'
  ].join('\n'),

  god_tier: ({ groupName, user }) => [
    '━━━━━━━━━━━━━━━━━━━━━━',
    `       🌌 ${groupName.toUpperCase()} 🌌`,
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '...',
    '',
    '👁️ A new presence has appeared.',
    '',
    'The atmosphere shifted.',
    'The domain acknowledged it.',
    '',
    `⚡ ${user} has arrived.`,
    '',
    '🔮 STATUS: UNREGISTERED',
    '',
    'Before you disappear into the crowd,',
    'make yourself known.',
    '',
    '📸 FACE',
    '👤 NAME',
    '📍 LOCATION — CITY/COUNTRY (OPTIONAL)',
    '',
    'Welcome to the domain.',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '⚡ X  |  👑 BempsX',
    '━━━━━━━━━━━━━━━━━━━━━━'
  ].join('\n')
}

export function renderWelcomeStyle(style, ctx = {}) {
  const groupName =
    ctx.groupName ||
    'The domain'

  const user =
    ctx.userMention ||
    'A new presence'

  return (
    welcomeCopy[style]?.({ groupName, user }) ||
    welcomeCopy.mysterious({ groupName, user })
  )
}

export const goodbyeStyles = [
  'cinematic',
  'battle',
  'mysterious',
  'royal',
  'chaotic',
  'emotional'
]

const goodbyeCopy = {
  cinematic: ({ groupName, user }) => [
    '━━━━━━━━━━━━━━━━━━━━━━',
    `       🌌 ${groupName.toUpperCase()} DEPARTURE`,
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '...',
    '',
    'The presence has vanished.',
    '',
    `👤 ${user} has left the domain.`,
    '',
    'The atmosphere is quieter now.',
    'One less voice.',
    'One less presence.',
    '',
    '🌑 Status: DEPARTED',
    '⚡ Aura: FADING...',
    '👁️ Trace: LOST',
    '',
    'Whatever happened...',
    'Their chapter here has ended.',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '⚡ X',
    '━━━━━━━━━━━━━━━━━━━━━━'
  ].join('\n'),

  battle: ({ groupName, user }) => [
    `⚔️ ${groupName.toUpperCase()} BATTLEFIELD UPDATE ⚔️`,
    '',
    'The battle has ended.',
    '',
    `💨 ${user} has exited the arena.`,
    '',
    'HP: Unknown',
    'Aura: Fading',
    'Status: 🏃 RETREATED',
    '',
    'Was it strategy?',
    '',
    'Was it fear?',
    '',
    'Was it simply time to leave?',
    '',
    'Only the departed warrior knows. 😭⚔️',
    '',
    'The arena remains...',
    'Waiting for their possible return.'
  ].join('\n'),

  mysterious: ({ groupName, user }) => [
    '👁️ ...',
    '',
    'Something just disappeared.',
    '',
    `⚠️ ${user} has vanished from ${groupName}.`,
    '',
    'No warning.',
    'No explanation.',
    'Just...',
    '',
    'gone.',
    '',
    `🔮 Identity: ${user}`,
    '🌑 Status: DEPARTED',
    '🌀 Last known location: The group',
    '',
    'X will remember the presence.',
    'Maybe they will return.',
    'Maybe they will not. 👁️'
  ].join('\n'),

  royal: ({ groupName, user }) => [
    `👑 THE ${groupName.toUpperCase()} COURT HAS LOST A MEMBER 👑`,
    '',
    `${user} has departed the kingdom.`,
    '',
    'The throne acknowledges your exit.',
    '',
    'May your journey beyond these walls',
    'bring you peace, prosperity, and good Wi-Fi. 😂',
    '',
    'Until our paths cross again...',
    '',
    '⚜️ Farewell.'
  ].join('\n'),

  chaotic: ({ groupName, user }) => [
    `🚨 ${groupName.toUpperCase()} BREAKING NEWS 🚨`,
    '',
    `${user} has LEFT THE GROUP.`,
    '',
    'We repeat:',
    '',
    'THEY HAVE ESCAPED. 💀',
    '',
    'Security footage: ❌ Unavailable',
    'Reason: ❓ Unknown',
    'Destination: 🌍 Somewhere out there...',
    '',
    'Should we mourn?',
    'Should we celebrate?',
    'Should we investigate?',
    '',
    'X is currently processing the situation... 😂'
  ].join('\n'),

  emotional: ({ groupName, user }) => [
    `🌙 SOME GOODBYES ARE QUIET...`,
    '',
    `${user} has left ${groupName}.`,
    '',
    'You have been part of the story,',
    'and although your chapter here has ended,',
    'the memories remain.',
    '',
    'Wherever you are headed next,',
    'take care of yourself. 🤍',
    '',
    'Until we meet again. 👋'
  ].join('\n')
}

export function renderGoodbyeStyle(style, ctx = {}) {
  const groupName =
    ctx.groupName ||
    'the domain'

  const user =
    ctx.userMention ||
    'A presence'

  return (
    goodbyeCopy[style]?.({ groupName, user }) ||
    goodbyeCopy.cinematic({ groupName, user })
  )
}

export function renderTemplate(template, ctx) {
  const humanName =
    ctx.displayName ||
    ctx.username ||
    'New member'

  return String(template || '')
    .replaceAll('{group}', ctx.groupName ?? 'the group')
    .replaceAll('{count}', String(ctx.memberCount ?? 0))
    .replaceAll('{username}', ctx.username || humanName)
    .replaceAll('{name}', humanName)
    .replaceAll('{user}', ctx.userMention || 'A member')
}