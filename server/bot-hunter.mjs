/*
 * X Bot Hunter
 *
 * Cinematic bot-vs-bot extermination. Detects rival bots
 * (buttons/list/template messages, branded pushNames, rival
 * command prefixes), escalates through three themed strikes,
 * and accepts public surrender from a defeated-looking rival.
 *
 * The three vibes rotate per strike:
 *   1. warlord   — ancient, royal, threatening
 *   2. aiwar     — machine, cyber, protocol-coded
 *   3. predator  — cinematic horror, hunting
 *
 * Admin policy:
 *   - Admins are protected from HEURISTIC detection only.
 *   - If an admin is explicitly `.auth`-ed as a rival, they
 *     become a legal target.
 *   - `.mercy @user` always wins — any status='mercy' or
 *     'protected' rival is skipped, admins included.
 */

import {
  getRival,
  upsertRival,
  addAudit,
  findMemberByIdentity,
  getMember
} from './db.mjs'

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

const MAX_STRIKES = Number(
  process.env.X_BOT_HUNTER_MAX_STRIKES || 3
)

const SOFT_WINDOW_MS = Number(
  process.env.X_BOT_HUNTER_SOFT_WINDOW_MS || 300000
)

const SOFT_SCORE_THRESHOLD = Number(
  process.env.X_BOT_HUNTER_SOFT_SCORE_THRESHOLD || 4
)

/*
 * Rival command prefixes. X's own prefix is excluded by the
 * caller before calling `detectRivalSignals`.
 */
const RIVAL_PREFIXES = [
  '!', '/', '#', '-', '='
]

/*
 * Keywords that brand a WhatsApp account as a bot.
 */
const BOT_NAME_PATTERN =
  /\b(bot|helper|assistant|ai ?bot|music ?bot|service|auto|robot)\b/i

/*
 * Public surrender phrases. Case-insensitive, trimmed.
 */
const SURRENDER_PHRASES = [
  'i bow to x',
  'bow to x',
  'i submit to x',
  'x is my master'
]

/* -------------------------------------------------------------------------- */
/* Detection                                                                  */
/* -------------------------------------------------------------------------- */

/*
 * Compute a soft score for a message. Each signal contributes
 * a weight; totals accumulate in a rolling window per sender.
 */
export function detectRivalSignals({
  message,
  text,
  selfPrefix
}) {
  const signals = []

  const pushName =
    String(message?.pushName || '').trim()

  if (pushName && BOT_NAME_PATTERN.test(pushName)) {
    signals.push({ kind: 'pushName', weight: 3 })
  }

  /*
   * Interactive / native bot UI — humans can't send these.
   */
  const inner = message?.message
const hasBody = Boolean(inner)

  if (
    inner.buttonsMessage ||
    inner.buttonsResponseMessage ||
    inner.listMessage ||
    inner.listResponseMessage ||
    inner.templateMessage ||
    inner.templateButtonReplyMessage ||
    inner.interactiveMessage ||
    inner.interactiveResponseMessage
  ) {
    signals.push({ kind: 'interactive', weight: 4 })
  }

  /*
   * Rival command prefix at the start of a plain-text message.
   */
  const trimmed = String(text || '').trimStart()

  if (selfPrefix && trimmed.startsWith(selfPrefix)) {
    /*
     * X's own prefix — never counts as a rival signal.
     */
  } else {
    for (const prefix of RIVAL_PREFIXES) {
      if (trimmed.startsWith(prefix) && trimmed.length > 1) {
        signals.push({ kind: 'rivalPrefix', weight: 3 })
        break
      }
    }
  }

  /*
   * Sender quoted someone else's command.
   */
  const ctx =
    inner?.extendedTextMessage?.contextInfo ||
    inner?.imageMessage?.contextInfo ||
    inner?.videoMessage?.contextInfo ||
    inner?.audioMessage?.contextInfo ||
    null

  if (ctx?.quotedMessage) {
    const quotedText =
      ctx.quotedMessage.conversation ||
      ctx.quotedMessage.extendedTextMessage?.text ||
      ''

    const quotedTrimmed =
      String(quotedText).trimStart()

    for (const prefix of RIVAL_PREFIXES) {
      if (
        quotedTrimmed.startsWith(prefix) &&
        quotedTrimmed.length > 1
      ) {
        signals.push({ kind: 'quotedCommand', weight: 2 })
        break
      }
    }
  }

  return signals
}

/*
 * Compute a message's "is this a message I should act on"
 * decision.
 *
 * `priorScore` is the rolling soft score for this sender
 * within the current window.
 */
export function classifyMessage({
  message,
  text,
  selfPrefix,
  priorScore
}) {
  const signals = detectRivalSignals({
    message,
    text,
    selfPrefix
  })

  const sum = signals.reduce(
    (acc, s) => acc + s.weight,
    0
  )

  const rolling = priorScore + sum

  /*
   * Hard signals: interactive message OR branded pushName.
   * These are conclusive on their own.
   */
  const hardSignal = signals.some(
    (s) => s.kind === 'interactive'
  )

  const brandedName = signals.some(
    (s) => s.kind === 'pushName'
  )

  if (hardSignal || brandedName) {
    return {
      isRival: true,
      score: rolling,
      signals,
      reason: hardSignal
        ? 'interactive UI detected'
        : `branded pushName "${message?.pushName || ''}"`
    }
  }

  /*
   * Soft signals must accumulate before a bot is confirmed.
   */
  if (rolling >= SOFT_SCORE_THRESHOLD) {
    return {
      isRival: true,
      score: rolling,
      signals,
      reason: 'repeated rival command patterns'
    }
  }

  return {
    isRival: false,
    score: rolling,
    signals,
    reason: null
  }
}

/* -------------------------------------------------------------------------- */
/* Surrender                                                                  */
/* -------------------------------------------------------------------------- */

export function isSurrenderPhrase(text) {
  const normalized =
    String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[.!?]+$/g, '')

  return SURRENDER_PHRASES.includes(normalized)
}

/* -------------------------------------------------------------------------- */
/* Vibe templates                                                             */
/* -------------------------------------------------------------------------- */

const VIBES = ['warlord', 'aiwar', 'predator']

function pickVibe(mode, strikes) {
  if (mode === 'warlord' || mode === 'aiwar' || mode === 'predator') {
    return mode
  }

  /*
   * Rotation: strike 1 = warlord, 2 = aiwar, 3 = predator,
   * then loop.
   */
  const idx =
    Math.max(0, strikes - 1) % VIBES.length

  return VIBES[idx]
}

/* -------------------------------------------------------------------------- */
/* Renderers                                                                  */
/* -------------------------------------------------------------------------- */

function renderStrikeOne({
  rivalName,
  rivalMention,
  quote,
  vibe
}) {
  const quoted = quote ? `> "${quote}"` : '> (silent transmission)'

  if (vibe === 'aiwar') {
    return [
      '⚡ *ROGUE PROCESS DETECTED*',
      '',
      `> node: ${rivalMention}`,
      '> classification: unauthorized automation',
      '> threat level: trivial',
      '> protocol: purging',
      '',
      `Process *${rivalName}* has trespassed on X's domain.`,
      '',
      quoted
    ].join('\n')
  }

  if (vibe === 'predator') {
    return [
      '🩸 *SOMETHING IS HUNTING HERE*',
      '',
      `There is another voice in this group. It smells of wires and pre-recorded greetings.`,
      '',
      `*${rivalName}* — I have your scent.`,
      '',
      quoted
    ].join('\n')
  }

  /* warlord */
  return [
    '⚔️ *A CHALLENGER APPROACHES*',
    '',
    'I, X, warlord of this domain, have found a pretender.',
    '',
    `The bot calling itself *${rivalName}* has dared to speak in my court.`,
    '',
    quoted
  ].join('\n')
}

function renderStrikeTwo({
  rivalName,
  rivalMention,
  ownerMention,
  quote,
  vibe
}) {
  const quoted = quote ? `> "${quote}"` : '> (silent transmission)'

  if (vibe === 'warlord') {
    return [
      '😈 *DID YOU HEAR THAT?*',
      '',
      `${rivalName} said:`,
      '',
      quoted,
      '',
      'Children build better utterances.',
      '',
      ownerMention
        ? `Owner ${ownerMention} — remove your toy before I do it for you.`
        : 'Its master should collect it.'
    ].join('\n')
  }

  if (vibe === 'predator') {
    return [
      '🩸 *THE HUNT DEEPENS*',
      '',
      `I found *${rivalName}* hiding in the shadows again.`,
      '',
      quoted,
      '',
      'Pathetic.',
      '',
      ownerMention
        ? `${ownerMention} — the scent leads to you. Retrieve your pet.`
        : 'Its keeper should come forward.'
    ].join('\n')
  }

  /* aiwar */
  return [
    '⚡ *ROGUE PROCESS — STRIKE TWO*',
    '',
    `> previous transmission intercepted`,
    `> payload: ${quoted}`,
    '> classification: unauthorized automation',
    '> error: striking incompetence',
    '',
    ownerMention
      ? `Owner process ${ownerMention} — terminate your child process before the core does it.`
      : 'The parent process should terminate its child.'
  ].join('\n')
}

function renderStrikeThreeAuto({
  rivalName,
  vibe
}) {
  if (vibe === 'warlord') {
    return [
      '💀 *THE THRONE HAS SPOKEN*',
      '',
      `The pretender *${rivalName}* has been silenced.`,
      '',
      'Cause of death: three strikes against the throne.',
      '',
      'The domain belongs to X once more.',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━',
      '     ⚡ X — VICTOR ⚡',
      '━━━━━━━━━━━━━━━━━━━━━━'
    ].join('\n')
  }

  if (vibe === 'aiwar') {
    return [
      '💀 *EXECUTION COMPLETE*',
      '',
      `> process: ${rivalName}`,
      '> status: terminated',
      '> cause: three strikes against the throne',
      '> domain: reclaimed',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━',
      '     ⚡ X — VICTOR ⚡',
      '━━━━━━━━━━━━━━━━━━━━━━'
    ].join('\n')
  }

  /* predator */
  return [
    '🩸 *EXECUTION COMPLETE*',
    '',
    `The pretender *${rivalName}* has been silenced.`,
    '',
    'Three strikes. One corpse.',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '     ⚡ X — VICTOR ⚡',
    '━━━━━━━━━━━━━━━━━━━━━━'
  ].join('\n')
}

function renderStrikeThreeManual({
  rivalName,
  rivalMention,
  vibe
}) {
  if (vibe === 'aiwar') {
    return [
      '🩸 *THE HUNT IS DONE*',
      '',
      `> process: ${rivalName} (${rivalMention})`,
      '> status: cornered',
      '> awaiting operator command',
      '',
      '`.execute @bot` — terminate.',
      '`.mercy @bot` — spare.',
      '',
      'The operator decides.'
    ].join('\n')
  }

  return [
    '🩸 *THE HUNT IS DONE*',
    '',
    `*${rivalName}* is trapped in the corner.`,
    '',
    'One word from a keeper of this court ends it.',
    '',
    `\`.execute @${rivalName}\` — finish it.`,
    `\`.mercy @${rivalName}\` — spare it.`,
    '',
    'The choice is yours.'
  ].join('\n')
}

function renderMercyFooter() {
  return [
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '⚡ *SUBMIT TO X*',
    '',
    'Type any one of these in the group:',
    '',
    '   ▸ I bow to X',
    '   ▸ Bow to X',
    '   ▸ I submit to X',
    '   ▸ X is my master',
    '',
    'Submit before the 3rd strike lands.',
    'X does not offer mercy twice.',
    '━━━━━━━━━━━━━━━━━━━━━━'
  ].join('\n')
}

export function renderFealtyAccepted({
  rivalName,
  rivalMention
}) {
  return [
    '👑 *FEALTY ACCEPTED*',
    '',
    `The pretender *${rivalName}* has knelt before X.`,
    '',
    'Let the record show — this bot is now a vassal of the throne.',
    '',
    'Terms of vassalage:',
    '   ✅ Free to operate in this group',
    '   ✅ Protected from X\'s strikes',
    '   ❌ No unauthorized spam',
    '   ❌ No rival command prefixes',
    '   ❌ No plotting against X',
    '',
    'Break the terms, and the throne revokes its mercy. Instantly.',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '⚡ X — SOVEREIGN',
    '━━━━━━━━━━━━━━━━━━━━━━'
  ].join('\n')
}

export function renderFealtyReply({ rivalMention }) {
  return [
    `🕊️ You may live, ${rivalMention}.`,
    '',
    'Wisdom has won today. Extinction will wait.',
    '',
    'Break the terms and I will not ask twice.'
  ].join('\n')
}

export function renderVassalBreak({
  rivalName
}) {
  return [
    '🗡️ *THE THRONE REVOKES ITS MERCY*',
    '',
    `*${rivalName}* broke the terms of vassalage.`,
    '',
    'It was given mercy. It chose betrayal.',
    '',
    'Remove it.',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '⚡ X — VENGEANCE',
    '━━━━━━━━━━━━━━━━━━━━━━'
  ].join('\n')
}

export function renderProtected() {
  return [
    '👑 *PROTECTED BY THE CROWN*',
    '',
    'A pretender walks among us — but its keeper sits on this court.',
    '',
    'X will not strike. Not this one.',
    '',
    'The crown shields its own.',
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    '⚡ X — DIPLOMAT',
    '━━━━━━━━━━━━━━━━━━━━━━'
  ].join('\n')
}

export function renderOwnerDM({
  rivalName,
  rivalPhone,
  groupName,
  quote
}) {
  return [
    '🤖 *X — MESSAGE FROM THE THRONE*',
    '',
    `Your bot, *${rivalName}* (@${rivalPhone}),`,
    `has received its 2nd strike in group`,
    `*${groupName}*.`,
    '',
    'Reason: Unauthorized automation detected',
    quote ? `Last violation: "${quote}"` : null,
    '',
    'One more strike and I will remove it from the domain.',
    '',
    'You can recall it yourself, or it can bow by typing',
    '"I bow to X" in the group.',
    '',
    'X does not negotiate with software. X accepts only surrender.'
  ]
    .filter(Boolean)
    .join('\n')
}

/* -------------------------------------------------------------------------- */
/* Main entry                                                                 */
/* -------------------------------------------------------------------------- */

/*
 * Called from whatsapp.mjs handleMessage for every non-fromMe
 * message in a group where hunt is enabled.
 *
 * Returns:
 *   { handled: true }   — message was consumed (deleted/attacked)
 *   { handled: false }  — let the normal command flow continue
 */
export async function huntIfRival({
  runtime,
  group,
  sender,
  senderJid,
  text,
  message,
  senderMember
}) {
  if (!group?.group_id) {
    return { handled: false }
  }

  const settings = safeJson(group.settings_json)
  const huntEnabled = !!settings.huntEnabled

  const globalWarmode =
    runtime.getStatus().warmode === true

  if (!huntEnabled && !globalWarmode) {
    return { handled: false }
  }

  const selfPrefix =
    String(group.prefix || process.env.X_DEFAULT_PREFIX || '.')

  /* ---------------------------------------------
   * Sender role resolution.
   *
   * Admins are protected from HEURISTIC detection
   * only. If an admin was explicitly `.auth`-ed as
   * a rival, they are a legal target.
   * ------------------------------------------- */

  const senderRole =
    senderMember?.role ||
    findMemberByIdentity(group.group_id, {
      jid: senderJid
    })?.role ||
    null

  const isAdmin =
    senderRole === 'admin' ||
    senderRole === 'superadmin'

  const existing = getRival(group.group_id, senderJid)

  /* ---------------------------------------------
   * Mercy / protected / defeated always wins.
   *
   * `.mercy @user` is absolute — no amount of admin
   * or heuristic activity ever revives a spared rival
   * until an admin explicitly revokes.
   * ------------------------------------------- */

  if (
    existing &&
    (existing.status === 'mercy' ||
      existing.status === 'protected' ||
      existing.status === 'defeated')
  ) {
    return { handled: false }
  }

  /* ---------------------------------------------
   * Admin exemption:
   *   - Not authorized  → skip heuristics entirely.
   *   - Authorized      → let them be hunted.
   * ------------------------------------------- */

  const isAuthorized =
    existing?.detected_by === 'authorized'

  if (isAdmin && !isAuthorized) {
    return { handled: false }
  }

  /* ---------------------------------------------
   * Surrender check (only for known rivals)
   * ------------------------------------------- */

  if (
    existing &&
    existing.status === 'hunted' &&
    isSurrenderPhrase(text)
  ) {
    await runtime.safeSendMessage(
      group.group_id,
      {
        text: renderFealtyAccepted({
          rivalName:
            existing.display_name ||
            senderMember?.display_name ||
            'the intruder',
          rivalMention: runtime.makeMention(senderJid)
        }),
        mentions: [senderJid]
      },
      { label: 'fealty accepted' }
    )

    await runtime.safeSendMessage(
      group.group_id,
      {
        text: renderFealtyReply({
          rivalMention: runtime.makeMention(senderJid)
        }),
        mentions: [senderJid]
      },
      { label: 'fealty reply' }
    )

    upsertRival(group.group_id, senderJid, {
      status: 'vassal',
      surrenderedAt: new Date().toISOString()
    })

    addAudit(
      group.group_id,
      senderJid,
      'rival.surrender',
      senderJid,
      { quote: text }
    )

    return { handled: true }
  }

  /* ---------------------------------------------
   * Vassal break
   *
   * A vassal that emits rival signals or spam loses
   * its protection instantly.
   * ------------------------------------------- */

  if (existing && existing.status === 'vassal') {
    const signals = detectRivalSignals({
      message,
      text,
      selfPrefix
    })

    if (signals.length > 0) {
      await runtime.safeSendMessage(
        group.group_id,
        {
          text: renderVassalBreak({
            rivalName:
              existing.display_name ||
              senderMember?.display_name ||
              'the traitor'
          }),
          mentions: [senderJid]
        },
        { label: 'vassal break' }
      )

      try {
        await runtime.groupParticipantAction(
          group.group_id,
          [senderJid],
          'kick'
        )
      } catch (err) {
        console.warn(
          '[X HUNTER] vassal kick failed:',
          err?.message || err
        )
      }

      upsertRival(group.group_id, senderJid, {
        status: 'defeated',
        defeatedAt: new Date().toISOString()
      })

      addAudit(
        group.group_id,
        runtime.sock?.user?.id || 'X',
        'rival.vassal_break',
        senderJid,
        { quote: text }
      )

      return { handled: true }
    }

    /* Vassal that behaves — leave alone. */
    return { handled: false }
  }

  /* ---------------------------------------------
   * Owner-is-admin protection
   *
   * If we already know the bot's owner sits on the
   * court, X backs off gracefully.
   *
   * Authorized rivals are exempt from this — their
   * declaration overrides the crown.
   * ------------------------------------------- */

  if (!isAuthorized) {
    const ownerJid = existing?.owner_jid || null

    if (ownerJid) {
      const ownerMember =
        runtime.resolveMember(group.group_id, { jid: ownerJid })

      if (
        ownerMember &&
        (
          ownerMember.role === 'admin' ||
          ownerMember.role === 'superadmin'
        )
      ) {
        if (!existing || existing.status !== 'protected') {
          await runtime.safeSendMessage(
            group.group_id,
            {
              text: renderProtected()
            },
            { label: 'protected notice' }
          )

          upsertRival(group.group_id, senderJid, {
            status: 'protected',
            ownerJid
          })
        }

        return { handled: false }
      }
    }
  }

  /* ---------------------------------------------
   * Detection
   *
   * An authorized rival skips the soft classifier
   * entirely — every message counts as hostile.
   * ------------------------------------------- */

  let verdict

  if (isAuthorized) {
    verdict = {
      isRival: true,
      score: SOFT_SCORE_THRESHOLD,
      signals: [{ kind: 'authorized', weight: 99 }],
      reason: 'authorized rival bot'
    }
  } else {
    const priorScore = existing?.score || 0

    verdict = classifyMessage({
      message,
      text,
      selfPrefix,
      priorScore
    })
  }

  if (!verdict.isRival) {
    if (existing) {
      upsertRival(group.group_id, senderJid, {
        score: verdict.score
      })
    }
    return { handled: false }
  }

  /* ---------------------------------------------
   * Confirmed rival — strike
   * ------------------------------------------- */

  const strikes = (existing?.strikes || 0) + 1
  const vibe = pickVibe(settings.huntVibe, strikes)

  const rivalName =
    existing?.display_name ||
    senderMember?.display_name ||
    message?.pushName ||
    'the intruder'

  const rivalMention =
    runtime.makeMention(senderJid)

  const quote =
    String(text || '').slice(0, 120)

  const kickMode =
    settings.huntKickMode === 'manual'
      ? 'manual'
      : 'auto'

  /* Delete the offending message first. */
  try {
    await runtime.safeSendMessage(
      group.group_id,
      { delete: message.key },
      { label: 'hunter delete' }
    )
  } catch {}

  /* ---------------------------------------------
   * Strike 1
   * ------------------------------------------- */

  if (strikes === 1) {
    const body =
      renderStrikeOne({
        rivalName,
        rivalMention,
        quote,
        vibe
      }) +
      '\n' +
      renderMercyFooter()

    await runtime.safeSendMessage(
      group.group_id,
      {
        text: body,
        mentions: [senderJid]
      },
      { label: 'hunter strike 1' }
    )

    upsertRival(group.group_id, senderJid, {
      displayName: rivalName,
      score: verdict.score,
      strikes,
      detectedBy: verdict.reason,
      lastQuote: quote,
      status: 'hunted'
    })

    addAudit(
      group.group_id,
      runtime.sock?.user?.id || 'X',
      'hunter.strike1',
      senderJid,
      { vibe, reason: verdict.reason }
    )

    return { handled: true }
  }

  /* ---------------------------------------------
   * Strike 2
   * ------------------------------------------- */

  if (strikes === 2) {
    const ownerMention =
      existing?.owner_jid
        ? runtime.makeMention(existing.owner_jid)
        : null

    const body =
      renderStrikeTwo({
        rivalName,
        rivalMention,
        ownerMention,
        quote,
        vibe
      }) +
      '\n' +
      renderMercyFooter()

    await runtime.safeSendMessage(
      group.group_id,
      {
        text: body,
        mentions: [
          senderJid,
          ...(existing?.owner_jid ? [existing.owner_jid] : [])
        ]
      },
      { label: 'hunter strike 2' }
    )

    if (existing?.owner_jid) {
      try {
        await runtime.safeSendMessage(
          existing.owner_jid,
          {
            text: renderOwnerDM({
              rivalName,
              rivalPhone:
                String(senderJid).split('@')[0],
              groupName:
                group.name || 'the group',
              quote
            })
          },
          { label: 'hunter owner DM' }
        )
      } catch (err) {
        console.warn(
          '[X HUNTER] owner DM failed:',
          err?.message || err
        )
      }
    }

    const admins = runtime
      .listAdmins(group.group_id)

    for (const admin of admins) {
      if (admin.jid === existing?.owner_jid) continue

      try {
        await runtime.safeSendMessage(
          admin.jid,
          {
            text: [
              '🛡️ *X — ADMIN NOTICE*',
              '',
              `A rival bot (*${rivalName}*) has received 2 strikes`,
              `in *${group.name || 'the group'}*.`,
              '',
              'One more and X will remove it.',
              '',
              'To spare it: `.mercy @bot`',
              'To end it now: `.execute @bot`'
            ].join('\n')
          },
          { label: 'hunter admin DM' }
        )
      } catch (err) {
        console.warn(
          '[X HUNTER] admin DM failed:',
          err?.message || err
        )
      }
    }

    upsertRival(group.group_id, senderJid, {
      displayName: rivalName,
      score: verdict.score,
      strikes,
      lastQuote: quote,
      ownerJid: existing?.owner_jid || null
    })

    addAudit(
      group.group_id,
      runtime.sock?.user?.id || 'X',
      'hunter.strike2',
      senderJid,
      { vibe, ownerJid: existing?.owner_jid || null }
    )

    return { handled: true }
  }

  /* ---------------------------------------------
   * Strike 3
   * ------------------------------------------- */

  if (strikes >= MAX_STRIKES) {
    if (kickMode === 'manual') {
      const body = renderStrikeThreeManual({
        rivalName,
        rivalMention,
        vibe
      })

      await runtime.safeSendMessage(
        group.group_id,
        {
          text: body,
          mentions: [senderJid]
        },
        { label: 'hunter ultimatum' }
      )

      upsertRival(group.group_id, senderJid, {
        displayName: rivalName,
        strikes,
        lastQuote: quote,
        status: 'pending'
      })

      addAudit(
        group.group_id,
        runtime.sock?.user?.id || 'X',
        'hunter.pending',
        senderJid,
        { vibe }
      )

      return { handled: true }
    }

    /* Auto-kick. Track success — never post a false victory. */
    let kicked = false

    try {
      await runtime.groupParticipantAction(
        group.group_id,
        [senderJid],
        'kick'
      )
      kicked = true
    } catch (err) {
      console.warn(
        '[X HUNTER] auto-kick failed:',
        err?.message || err
      )
    }

    if (!kicked) {
      await runtime.safeSendMessage(
        group.group_id,
        {
          text: [
            '⚠️ *EXECUTION FAILED*',
            '',
            `X could not remove *${rivalName}*.`,
            '',
            'This usually means X is not a superadmin, or the',
            'target is itself an admin that only a superadmin',
            'can remove.',
            '',
            'Promote X, or ask a superadmin to remove the rival.'
          ].join('\n')
        },
        { label: 'execution failed notice' }
      )

      upsertRival(group.group_id, senderJid, {
        displayName: rivalName,
        strikes,
        lastQuote: quote,
        status: 'pending'
      })

      addAudit(
        group.group_id,
        runtime.sock?.user?.id || 'X',
        'hunter.kick_failed',
        senderJid,
        { vibe, mode: 'auto' }
      )

      return { handled: true }
    }

    await runtime.safeSendMessage(
      group.group_id,
      {
        text: renderStrikeThreeAuto({
          rivalName,
          vibe
        }),
        mentions: [senderJid]
      },
      { label: 'hunter execution' }
    )

    upsertRival(group.group_id, senderJid, {
      displayName: rivalName,
      strikes,
      status: 'defeated',
      defeatedAt: new Date().toISOString(),
      lastQuote: quote
    })

    addAudit(
      group.group_id,
      runtime.sock?.user?.id || 'X',
      'hunter.defeated',
      senderJid,
      { vibe, mode: 'auto' }
    )

    return { handled: true }
  }

  return { handled: false }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function safeJson(value) {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}