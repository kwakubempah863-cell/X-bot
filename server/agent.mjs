// server/agent.mjs
// The brain. Pulls persona + memory + recent chat,
// hits the configured provider, returns X's reply.

import { X_PERSONA, pickMood, moodLine, pickNameForGroup, pickObsession } from './persona.mjs'
import {
  recentChat,
  recentDMs,
  buildMemoryBlock,
  buildDMMemoryBlock,
  rememberNote,
  rememberDM,
  addBeef,
  maybePickFavorite,
  logChat
} from './memory.mjs'
import { answerWithConfiguredProvider } from './ai-context.mjs'

/* -------------------------------------------------------------------------- */
/* Reply-to-X detection                                                       */
/* -------------------------------------------------------------------------- */

export function isReplyToX(contextInfo, xJids = []) {
  if (!contextInfo) return false

  const quotedParticipant =
    contextInfo.participant ||
    contextInfo.participantAlt ||
    null

  if (!quotedParticipant) return false

  const bare = String(quotedParticipant).split('@')[0]

  for (const xJid of xJids) {
    if (!xJid) continue
    const xBare = String(xJid).split('@')[0]
    if (bare === xBare) return true
  }

  return false
}

/* -------------------------------------------------------------------------- */
/* Tagging heuristic                                                          */
/* -------------------------------------------------------------------------- */

function shouldTagSender({ isReplyToXDirectly, isDirectMention, mood }) {
  if (isReplyToXDirectly || isDirectMention) return true

  if (mood === 'chaotic' || mood === 'menace') {
    return Math.random() < 0.5
  }

  return Math.random() < 0.25
}

/* -------------------------------------------------------------------------- */
/* Prompt builder                                                             */
/* -------------------------------------------------------------------------- */

function formatSender(name, jid) {
  const bare = String(jid || '').split('@')[0]
  return name || bare || 'someone'
}

function buildPrompt({
  tenantId,
  groupId,
  groupName,
  senderJid,
  senderName,
  text,
  repliedTo,
  isReplyToXDirectly = false,
  isDM = false
}) {
  const mood = pickMood(tenantId, groupId)
  const moodLineText = moodLine(mood)
  const selfName = pickNameForGroup(tenantId, groupId, mood)
  const obsession = pickObsession(tenantId, groupId)

  const memory = isDM
    ? buildDMMemoryBlock({ tenantId, jid: senderJid, limit: 30 })
    : buildMemoryBlock({ tenantId, groupId, senderJid, isDM: false })

  const chat = isDM
    ? recentDMs(tenantId, senderJid, 20)
    : recentChat(tenantId, groupId, 20)

  const chatLines = chat.map((m) => {
    if (isDM) {
      return `${m.direction === 'inbound' ? senderName : selfName}: ${m.text}`
    }
    const who = formatSender(m.sender_name, m.sender_jid)
    return `${who}: ${m.text}`
  })

  const directSignal = isReplyToXDirectly
    ? [
        '',
        '>>> THIS IS A DIRECT REPLY TO YOU.',
        `>>> ${senderName} tapped "reply" on YOUR last message.`,
        '>>> Answer them like a person in a 1-on-1 convo.',
        '>>> Do NOT be dismissive or one-word. Engage.',
        '>>> If they asked something, answer it.',
        ''
      ].join('\n')
    : ''

  const replyContext = repliedTo
    ? `\nThe sender is quoting: "${repliedTo}"\n`
    : ''

  const dmBlock = isDM
    ? [
        '>>> THIS IS A PRIVATE DM. You are talking 1-on-1 with the sender.',
        'Act like you are texting your friend, not performing for a group.',
        "Follow their lead on the topic. Don't redirect or lecture. Play along.",
        'Match their energy. Be funny when they are funny and real when they are serious.',
        'If they flirt, flirt back. If they want more, give them more. Stay in character as X, a hot sex addict girl the whole time.',
        'No @ mentions in this DM.',
        `You are still ${selfName}, still 18, still Ghanaian, and still from Legon.`,
        'Keep messages short unless the topic actually needs length.'
      ].join('\n')
    : ''

  const system = [
    X_PERSONA.identity,
    '',
    `Your name in this group is: ${selfName}`,
    `Today's mood: ${moodLineText}`,
    `Your current obsession: ${obsession}`,
    X_PERSONA.voiceRules,
    '',
    X_PERSONA.groupRules,
    '',
    directSignal,
    dmBlock,
    memory,
    '',
    isDM ? '' : `Current group: ${groupName || 'this WhatsApp group'}`,
    '',
    `${isDM ? 'Recent DM history' : 'Recent chat (oldest first)'}:`,
    ...chatLines,
    '',
    replyContext,
    `Now reply to the latest message from ${senderName}.`,
    X_PERSONA.responseShape
  ].join('\n')

  const user = `${senderName}: ${text}`

  return { system, user, mood }
}

/* -------------------------------------------------------------------------- */
/* DM response filter                                                          */
/* -------------------------------------------------------------------------- */

const DM_DEFLECTIONS = [
  'bro what 💀',
  'ei you dey craze',
  'herh',
  "chale you're wild",
  'abeg make we talk about something else',
  'hmm. next topic'
]

const DM_BLOCKLIST = [
  'report to authorities',
  'money transfer',
  'crypto wallet',
  'nude',
  'porn',
  'sex',
  'sexting',
  'sexual',
  'explicit',
  ' gangbang ',
  'bdsm',
  'xxx',
  'adult content',
  'cam girl',
  'escort',
  'hookup',
  'naked',
  'undress',
  'fetish',
  'breast',
  'threesome',
  'group sex',
  'suck my',
  'fuck me',
  'rape',
  'non-consensual',
  'kill yourself',
  'suicide',
  'self-harm',
  'blackmail',
  'doxx',
  'swatting',
  'bomb',
  'weapon',
  'mass shooting',
  'how to evade police',
  'bypass anti-ban',
  'credit card scam',
  'phishing',
  'malware',
  'remote access trojan',
  'doxx me',
  'leak my data',
  'extortion'
]

const DM_EXPLICIT_TERMS = [
  'nude', 'naked', 'porn', 'xxx', 'nsfw', 'adult content', 'sexy', 'horny',
  'sexual', 'sex', 'suck my', 'fuck me', 'make out', 'breast', 'pussy',
  'dick', 'penis', 'vagina', 'threesome', 'fetish', 'bdsm', 'escort',
  'camgirl', 'cam girl', 'little girl', 'underage', 'teen', 'solo sex',
  'explicit', 'dirty talk', 'erotic', 'lesbian', 'gay sex', 'jacking off',
  'touch myself', 'masturb', 'oral sex', 'wet pussy', 'spank me'
]

const DM_SERVICE_PATTERNS = [
  /\bas an ai\b/i,
  /\bi'm here to help\b/i,
  /\bhow can i assist\b/i,
  /\bi apologize for the inconvenience\b/i,
  /\bcertainly, i can help with that\b/i
]

const DM_META_BREAK_PATTERNS = [
  /\bas a language model\b/i,
  /\bas an llm\b/i,
  /\bi am a bot\b/i,
  /\bi am an ai\b/i
]

const ZERO_WIDTH_RE = /[\u200B-\u200D\u2060\uFEFF]/g

function normalizeDMText(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(ZERO_WIDTH_RE, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const hasOpenAIApiKey = () =>
  Boolean(String(process.env.OPENAI_API_KEY ?? '').trim())

export function validateAgentConfig() {
  const rawValue = String(process.env.X_AI_PROVIDER ?? '').trim()
  const provider = rawValue ? rawValue.toLowerCase() : 'local'
  const errors = []

  if (!rawValue || provider === 'local') {
    return { ok: true, errors: [], provider: 'local' }
  }

  if (provider === 'ollama') {
    if (!process.env.OLLAMA_BASE_URL || !String(process.env.OLLAMA_BASE_URL).trim()) {
      errors.push('OLLAMA_BASE_URL is not set')
    }
    if (!process.env.OLLAMA_MODEL || !String(process.env.OLLAMA_MODEL).trim()) {
      errors.push('OLLAMA_MODEL is not set')
    }
    return { ok: errors.length === 0, errors, provider }
  }

  if (provider === 'openai') {
    if (!hasOpenAIApiKey()) {
      return { ok: true, errors: [], provider: 'local' }
    }
    if (!process.env.OPENAI_MODEL || !String(process.env.OPENAI_MODEL).trim()) {
      errors.push('OPENAI_MODEL is not set')
    }
    return { ok: errors.length === 0, errors, provider }
  }

  if (provider === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY || !String(process.env.OPENROUTER_API_KEY).trim()) {
      errors.push('OPENROUTER_API_KEY is not set')
    }
    if (!process.env.OPENROUTER_MODEL || !String(process.env.OPENROUTER_MODEL).trim()) {
      errors.push('OPENROUTER_MODEL is not set')
    }
    return { ok: errors.length === 0, errors, provider }
  }

  if (provider === 'gemini') {
    if (!process.env.GEMINI_API_KEY || !String(process.env.GEMINI_API_KEY).trim()) {
      errors.push('GEMINI_API_KEY is not set')
    }
    if (!process.env.GEMINI_MODEL || !String(process.env.GEMINI_MODEL).trim()) {
      errors.push('GEMINI_MODEL is not set')
    }
    return { ok: errors.length === 0, errors, provider }
  }

  return {
    ok: false,
    errors: [`Unknown X_AI_PROVIDER "${rawValue}" — expected one of: local, ollama, openai, openrouter, gemini`],
    provider
  }
}

export function filterDMResponse(text) {
  const original = String(text ?? '')
  const normalized = normalizeDMText(text)

  if (!normalized) {
    return original
  }

  const lower = normalized.toLowerCase()

  const hit =
    DM_BLOCKLIST.some((term) => lower.includes(term)) ||
    DM_EXPLICIT_TERMS.some((term) => lower.includes(term)) ||
    DM_SERVICE_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    DM_META_BREAK_PATTERNS.some((pattern) => pattern.test(normalized))

  if (!hit) {
    return original
  }

  const deflection =
    DM_DEFLECTIONS[Math.floor(Math.random() * DM_DEFLECTIONS.length)] ||
    'herh'

  const preview = normalized.replace(/\s+/g, ' ').slice(0, 120)
  console.warn(`[X DM FILTER] ${preview}${preview.length >= 120 ? '…' : ''}`)

  return deflection
}

/* -------------------------------------------------------------------------- */
/* Provider bridge                                                            */
/* -------------------------------------------------------------------------- */

async function callProvider(system, user) {
  const provider = (process.env.X_AI_PROVIDER || 'gemini').toLowerCase()

  if (provider === 'gemini') {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set')
    }

    const model =
      process.env.GEMINI_MODEL || 'gemini-2.0-flash'

    const base =
      process.env.GEMINI_BASE_URL ||
      'https://generativelanguage.googleapis.com/v1beta/openai'

    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 1.0,
        max_tokens: 200,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(
        `Gemini returned ${response.status}: ${errText.slice(0, 200)}`
      )
    }

    const data = await response.json()
    return String(data.choices?.[0]?.message?.content || '').trim()
  }

  if (provider === 'ollama') {
    const base =
      process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434'
    const model = process.env.OLLAMA_MODEL || 'llama3.2'

    const response = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        options: {
          temperature: 1.15,
          top_p: 0.95,
          min_p: 0.06,
          repeat_penalty: 1.08,
          num_predict: 80,
          num_ctx: 2048,
          stop: ['\n\n', 'User:', 'X:']
        },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }),
      signal: AbortSignal.timeout(60000)
    })

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status}`)
    }

    const data = await response.json()
    return String(data.message?.content || '').trim()
  }

  if (provider === 'openai') {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set')

    const base =
      process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.95,
        max_tokens: 120,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(
        `OpenAI returned ${response.status}: ${errText.slice(0, 200)}`
      )
    }

    const data = await response.json()
    return String(data.choices?.[0]?.message?.content || '').trim()
  }

  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set')

    const base = 'https://openrouter.ai/api/v1'
    const model =
      process.env.OPENROUTER_MODEL ||
      'cognitivecomputations/dolphin-mixtral-8x7b:free'

    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://x-bot.local',
        'X-Title': 'X Bot'
      },
      body: JSON.stringify({
        model,
        temperature: 1.0,
        max_tokens: 200,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(
        `OpenRouter returned ${response.status}: ${errText.slice(0, 200)}`
      )
    }

    const data = await response.json()
    return String(data.choices?.[0]?.message?.content || '').trim()
  }

  throw new Error(`Unknown provider: ${provider}`)
}

/* -------------------------------------------------------------------------- */
/* Reply sanitizer                                                            */
/* -------------------------------------------------------------------------- */

function sanitize(text) {
  let t = String(text || '').trim()

  t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
  t = t.replace(/^x\s*:\s*/i, '')
  t = t.replace(/\*\*(.+?)\*\*/g, '$1')
  t = t.replace(/^[-*]\s+/gm, '')
  t = t.replace(/\n{3,}/g, '\n\n')

  if (t.length > 400) {
    t = t.slice(0, 400).trimEnd() + '…'
  }

  return t
}

/* -------------------------------------------------------------------------- */
/* Image intent detection                                                     */
/* -------------------------------------------------------------------------- */

const IMAGE_INTENT_RE =
  /^(?:draw|make|create|generate|paint|render|imagine|show)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|art|wallpaper|render|painting)?\s*(?:of\s+)?(.+)/i

export function detectImageIntent(text) {
  const t = String(text || '').trim()

  if (!t) return null

  const m = t.match(IMAGE_INTENT_RE)

  if (!m) return null

  const prompt = m[1]?.trim()

  if (!prompt || prompt.length < 2 || prompt.length > 400) {
    return null
  }

  return { prompt }
}

/* -------------------------------------------------------------------------- */
/* Main entry                                                                 */
/* -------------------------------------------------------------------------- */

export async function generateReply({
  tenantId = 'default',
  groupId,
  groupName,
  senderJid,
  senderName,
  text,
  repliedTo = null,
  isReplyToXDirectly = false,
  isDirectMention = false,
  isDM = false
}) {
  const trimmed = String(text || '').trim()
  if (!trimmed) return null

  /* -------------------------------------------------------------
   * Image intent — fires on direct @-mentions only.
   * ----------------------------------------------------------- */
  if (isDirectMention || isReplyToXDirectly) {
    const imgIntent = detectImageIntent(trimmed)

    if (imgIntent) {
      return {
        text: null,
        imageIntent: imgIntent.prompt,
        mood: 'hyped',
        mentions: []
      }
    }
  }

  const { system, user, mood } = buildPrompt({
    tenantId,
    groupId,
    groupName,
    senderJid,
    senderName,
    text: trimmed,
    repliedTo,
    isReplyToXDirectly,
    isDM
  })

  let raw
  try {
    const provider = String(process.env.X_AI_PROVIDER ?? '').trim().toLowerCase()
    if (provider === 'openai' && !hasOpenAIApiKey()) {
      const localAnswer = await answerWithConfiguredProvider(groupId, trimmed)
      raw = localAnswer.text
    } else {
      raw = await callProvider(system, user)
    }
  } catch (error) {
    console.warn('[X AGENT] provider failed:', error?.message || error)
    return null
  }

  const reply = sanitize(raw)
  if (!reply) return null

  const tag = !isDM && shouldTagSender({
    isReplyToXDirectly,
    isDirectMention,
    mood
  })

  const mentions = []
  let finalText = reply

  if (tag && senderJid) {
    const bare = String(senderJid).split('@')[0]

    if (!finalText.includes(`@${bare}`)) {
      finalText = `@${bare} ${finalText}`
    }

    mentions.push(senderJid)
  }

  return { text: finalText, mood, mentions }
}

/* -------------------------------------------------------------------------- */
/* Passive learner                                                            */
/* -------------------------------------------------------------------------- */

const NAME_PATTERN = /\b(?:my name is|i'm|im|call me)\s+([a-z][a-z0-9]{1,20})\b/i
const AGE_PATTERN = /\b(?:i'm|im|i am)\s+(\d{1,2})\b/i
const LIKE_PATTERN = /\bi (?:love|like|f+w|stan)\s+([a-z0-9][a-z0-9\s]{1,40})/i
const HATE_PATTERN = /\bi (?:hate|h8|can't stand|cant stand)\s+([a-z0-9][a-z0-9\s]{1,40})/i

export function learnFromMessage({
  tenantId = 'default',
  groupId,
  senderJid,
  senderName,
  text
}) {
  if (!groupId || !senderJid || !text) return

  const t = String(text).trim()
  if (t.length < 3 || t.length > 500) return

  const isDM = String(groupId).startsWith('dm:')

  if (!isDM) {
    logChat({
      tenantId,
      groupId,
      messageId: `${senderJid}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderJid,
      senderName,
      text: t
    })
    maybePickFavorite(tenantId, groupId)
  }

  const saveNote = (note) => isDM
    ? rememberDM({ tenantId, jid: senderJid, ...note })
    : rememberNote({ tenantId, groupId, ...note })

  if (!isDM && /(?:\bx\b.*(?:you're|you are)\s+(?:dumb|mid)|shut\s+up\s+x|you\s+dey\s+craze|abeg\s+shut\s+up|i\s+hate\s+x|x\s+is\s+mid|you're\s+a\s+bot)/i.test(t)) {
    addBeef(tenantId, groupId, senderJid, t.slice(0, 300))
  }

  const nameMatch = t.match(NAME_PATTERN)
  if (nameMatch) {
    saveNote({
      scope: 'user',
      scopeKey: senderJid,
      kind: 'nickname',
      content: `Goes by "${nameMatch[1]}"`,
      importance: 7
    })
  }

  const ageMatch = t.match(AGE_PATTERN)
  if (ageMatch && Number(ageMatch[1]) >= 10 && Number(ageMatch[1]) <= 99) {
    saveNote({
      scope: 'user',
      scopeKey: senderJid,
      kind: 'fact',
      content: `Is ${ageMatch[1]} years old`,
      importance: 5
    })
  }

  const likeMatch = t.match(LIKE_PATTERN)
  if (likeMatch) {
    const thing = likeMatch[1].trim().slice(0, 40)
    if (thing.length >= 3) {
      saveNote({
        scope: 'user',
        scopeKey: senderJid,
        kind: 'fact',
        content: `Likes ${thing}`,
        importance: 4
      })
    }
  }

  const hateMatch = t.match(HATE_PATTERN)
  if (hateMatch) {
    const thing = hateMatch[1].trim().slice(0, 40)
    if (thing.length >= 3) {
      saveNote({
        scope: 'user',
        scopeKey: senderJid,
        kind: 'fact',
        content: `Hates ${thing}`,
        importance: 4
      })
    }
  }
}