const norm = v => String(v || '').trim().toLowerCase()

/*
 * Normalize a phone-like value to digits only.
 *
 *   "+233 50 083 5166" -> "233500835166"
 *   "233500835166"     -> "233500835166"
 */
const digits = v => String(v || '').replace(/\D/g, '')

/*
 * Extract the user part of a JID.
 *
 *   "233500835166@s.whatsapp.net" -> "233500835166"
 *   "233500835166:12@s.whatsapp.net" -> "233500835166"
 *   "abcd-1234@lid" -> "abcd-1234"
 */
const jidUser = v => {
  const s = String(v || '').trim()
  if (!s) return ''
  const at = s.indexOf('@')
  const beforeAt = at === -1 ? s : s.slice(0, at)
  const colon = beforeAt.indexOf(':')
  return colon === -1 ? beforeAt : beforeAt.slice(0, colon)
}

/*
 * Build the full set of owner identifiers from env.
 *
 * We gather every form so any of them can match:
 *   - raw JID
 *   - raw number (digits only)
 *   - username (lowercase)
 *   - LID
 */
export function configuredOwnerIdentifiers() {
  const raw = [
    process.env.X_OWNER_JID,
    process.env.X_OWNER_LID,
    process.env.X_OWNER_USERNAME,
    process.env.X_OWNER_NUMBER,
  ].filter(Boolean)

  const out = new Set()

  for (const value of raw) {
    const s = String(value).trim()
    if (!s) continue

    out.add(norm(s))

    const user = jidUser(s)
    if (user) {
      out.add(norm(user))
      out.add(digits(user))
    }

    const d = digits(s)
    if (d) out.add(d)
  }

  /*
   * Remove empties.
   */
  out.delete('')
  out.delete('null')
  out.delete('undefined')

  return out
}

/*
 * Build the full set of candidate identifiers for a sender.
 */
export function candidateIdentityValues(identity = {}) {
  const raw = [
    identity.jid,
    identity.lid,
    identity.ownerJid,
    identity.phoneNumber,
    identity.phone,
    identity.username,
    identity.displayName,
    identity.pushName,
    identity.participantAlt,
    identity.remoteJidAlt,
  ].filter(Boolean)

  const out = new Set()

  const addCandidate = (value) => {
    if (!value) return

    const s = String(value).trim()
    if (!s) return

    const normalized = norm(s)
    if (normalized) out.add(normalized)

    const lidUser = jidUser(s)
    if (lidUser) {
      const userNormalized = norm(lidUser)
      if (userNormalized) out.add(userNormalized)

      const userDigits = digits(lidUser)
      if (userDigits) out.add(userDigits)
    }

    const digitsOnly = digits(s)
    if (digitsOnly) out.add(digitsOnly)

    if (String(s).includes('@')) {
      const bare = String(s).split('@')[0]
      if (bare) {
        const bareNormalized = norm(bare)
        if (bareNormalized) out.add(bareNormalized)

        const bareDigits = digits(bare)
        if (bareDigits) out.add(bareDigits)
      }
    }

    if (String(s).includes('@lid')) {
      const lidDigits = digits(String(s).split('@')[0])
      if (lidDigits) out.add(lidDigits)
    }
  }

  for (const value of raw) {
    addCandidate(value)
  }

  out.delete('')
  out.delete('null')
  out.delete('undefined')

  return out
}

/*
 * True when any candidate matches any configured owner identifier.
 */
export function isOwner(identity) {
  const configured = configuredOwnerIdentifiers()
  if (!configured.size) return false

  const candidates = candidateIdentityValues(identity)
  const rawLid = identity?.lid || null
  const rawJid = identity?.jid || null

  const addNormalizedCandidate = (value) => {
    if (!value) return

    const s = String(value).trim()
    if (!s) return

    candidates.add(norm(s))

    const user = jidUser(s)
    if (user) {
      candidates.add(norm(user))
      const userDigits = digits(user)
      if (userDigits) candidates.add(userDigits)
    }

    const digitsOnly = digits(s)
    if (digitsOnly) candidates.add(digitsOnly)
  }

  if (rawLid) addNormalizedCandidate(rawLid)
  if (rawJid) addNormalizedCandidate(rawJid)

  if (process.env.X_OWNER_LID) {
    const ownerLid = norm(process.env.X_OWNER_LID)
    if (ownerLid && rawLid && ownerLid === norm(rawLid)) return true
    if (ownerLid && rawJid && ownerLid === norm(rawJid)) return true
  }

  if (process.env.X_OWNER_NUMBER) {
    const ownerNumber = digits(process.env.X_OWNER_NUMBER)
    if (ownerNumber) {
      const lidDigits = rawLid ? digits(String(rawLid).split('@')[0]) : ''
      const jidDigits = rawJid ? digits(String(rawJid).split('@')[0]) : ''

      if (lidDigits && lidDigits === ownerNumber) return true
      if (jidDigits && jidDigits === ownerNumber) return true

      candidates.add(ownerNumber)
    }
  }

  for (const value of candidates) {
    if (configured.has(value)) return true
  }

  return false
}

/*
 * Extract a rich identity from an incoming Baileys message.
 *
 * Every field Baileys exposes is captured so owner detection
 * can match regardless of whether WhatsApp delivers a phone
 * JID, a LID, or a participantAlt form.
 */
export function identityFromMessage(message) {
  const key = message?.key || {}

  const ctx =
    message?.message?.extendedTextMessage?.contextInfo ||
    message?.message?.imageMessage?.contextInfo ||
    message?.message?.videoMessage?.contextInfo ||
    message?.message?.audioMessage?.contextInfo ||
    {}

  const jid =
    key.participant ||
    ctx.participant ||
    key.remoteJid ||
    null

  const participantAlt =
    key.participantAlt ||
    key.remoteJidAlt ||
    ctx.participantAlt ||
    null

  const phoneJid =
    (participantAlt && !String(participantAlt).includes('@lid') ? participantAlt : null) ||
    (jid && !String(jid).includes('@lid') ? jid : null)

  const pushName =
    message?.pushName ||
    ctx?.pushName ||
    null

  const username =
    message?.username ||
    key?.username ||
    key?.participantUsername ||
    ctx?.username ||
    null

  const phoneNumber =
    jidUser(phoneJid) ||
    jidUser(jid) ||
    null

  return {
    jid,
    lid:
      (jid && String(jid).includes('@lid') ? jid : null) ||
      (participantAlt && String(participantAlt).includes('@lid') ? participantAlt : null),
    participantAlt,
    remoteJidAlt: key.remoteJidAlt || null,
    ownerJid: phoneJid || null,
    username,
    phoneNumber,
    displayName: pushName,
    pushName,
  }
}

export function roleFor({ identity, member }) {
  const enriched = {
    ...identity,
    username:
      identity?.username ||
      member?.username ||
      null,
  }

  if (isOwner(enriched)) return 'owner'
  if (member?.role === 'superadmin') return 'group_admin'
  if (member?.role === 'admin') return 'moderator'
  return 'member'
}

export function can(role, required) {
  const rank = {
    member: 0,
    moderator: 2,
    group_admin: 3,
    bot_admin: 4,
    owner: 5,
  }
  return (rank[role] || 0) >= (rank[required] || 0)
}