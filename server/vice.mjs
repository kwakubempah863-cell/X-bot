import db, {
  getViceCharacter,
  createViceCharacter,
  updateViceCharacter,
  getViceFactionForMember,
  createViceFaction,
  getViceFaction,
  getViceFactionByName,
  listViceFactions,
  getViceFactionMembers,
  listViceTerritories,
  getViceTerritory,
  updateTerritoryOwner,
  createViceWar,
  getViceWar,
  getActiveWarForFaction,
  listActiveWars,
  updateViceWar,
  addWarContribution,
  listWarParticipants,
  getActiveViceSeason,
  createViceSeason
} from './db.mjs'

/* -------------------------------------------------------------------------- */
/* X: VICE — game engine                                                      */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

export const CAREER_REQUIREMENTS = {
  assassin: { level: 5, description: 'Burst damage, executioner of the weak' },
  hacker:   { level: 5, description: 'Breach systems, drain banks' },
  face:     { level: 5, description: 'Social engineering, recruitment' },
  smuggler: { level: 5, description: 'Cargo runs, black market perks' },
  enforcer: { level: 5, description: 'Tank damage, force taunts' }
}

export const CAREER_SWITCH_COST = 5000
export const CAREER_SWITCH_LEVEL = 20
export const CAREER_SWITCH_COOLDOWN_MS = 24 * 60 * 60 * 1000

export const ENERGY_TICK_MS = 5 * 60 * 1000
export const ENERGY_PER_TICK = 10

export const NERVE_TICK_MS = 15 * 60 * 1000
export const NERVE_PER_TICK = 1

export const HP_REGEN_TICK_MS = 5 * 60 * 1000
export const HP_REGEN_PER_TICK = 5

export const HOSPITAL_DURATION_MS = 30 * 60 * 1000
export const JAIL_DURATION_MS = 15 * 60 * 1000

export const DEATH_WALLET_LOSS = 0.05

/* -------------------------------------------------------------------------- */
/* Character lifecycle                                                        */
/* -------------------------------------------------------------------------- */

/*
 * Load a character with time-based regen applied.
 * Regen is computed lazily — only when the character is
 * read — so we don't need a cron loop.
 */
export function loadCharacter(tenantId, groupId, jid) {
  let char = getViceCharacter(tenantId, groupId, jid)

  if (!char) {
    char = createViceCharacter(tenantId, groupId, jid)
  }

  if (!char) return null

  return applyRegen(tenantId, groupId, jid, char)
}

/*
 * Regenerate HP, energy, and nerve based on elapsed
 * time since last tick. Stores new values in the DB.
 */
export function applyRegen(tenantId, groupId, jid, char) {
  const now = Date.now()

  const patch = {}
  let dirty = false

  /* --- HP --- */
  const lastHp = char.last_energy_tick
    ? new Date(char.last_energy_tick).getTime()
    : new Date(char.updated_at || now).getTime()

  const hpTicks = Math.floor((now - lastHp) / HP_REGEN_TICK_MS)

  if (hpTicks > 0 && char.hp < char.max_hp) {
    const gained = hpTicks * HP_REGEN_PER_TICK
    patch.hp = Math.min(char.max_hp, char.hp + gained)
    dirty = true
  }

  /* --- Energy --- */
  const lastEnergy = char.last_energy_tick
    ? new Date(char.last_energy_tick).getTime()
    : now

  const energyTicks = Math.floor((now - lastEnergy) / ENERGY_TICK_MS)

  if (energyTicks > 0 && char.energy < char.max_energy) {
    const gained = energyTicks * ENERGY_PER_TICK
    patch.energy = Math.min(char.max_energy, char.energy + gained)
    patch.last_energy_tick = new Date(
      lastEnergy + energyTicks * ENERGY_TICK_MS
    ).toISOString()
    dirty = true
  }

  /* --- Nerve --- */
  const lastNerve = char.last_nerve_tick
    ? new Date(char.last_nerve_tick).getTime()
    : now

  const nerveTicks = Math.floor((now - lastNerve) / NERVE_TICK_MS)

  if (nerveTicks > 0 && char.nerve < char.max_nerve) {
    const gained = nerveTicks * NERVE_PER_TICK
    patch.nerve = Math.min(char.max_nerve, char.nerve + gained)
    patch.last_nerve_tick = new Date(
      lastNerve + nerveTicks * NERVE_TICK_MS
    ).toISOString()
    dirty = true
  }

  /* --- Clear expired hospital / jail --- */
  if (char.hospital_until && new Date(char.hospital_until).getTime() <= now) {
    patch.hospital_until = null
    dirty = true
  }

  if (char.jail_until && new Date(char.jail_until).getTime() <= now) {
    patch.jail_until = null
    dirty = true
  }

  if (!dirty) return char

  return updateViceCharacter(tenantId, groupId, jid, patch)
}

/* -------------------------------------------------------------------------- */
/* State checks                                                               */
/* -------------------------------------------------------------------------- */

export function isHospitalized(char) {
  if (!char?.hospital_until) return false
  return new Date(char.hospital_until).getTime() > Date.now()
}

export function isJailed(char) {
  if (!char?.jail_until) return false
  return new Date(char.jail_until).getTime() > Date.now()
}

export function hospitalRemaining(char) {
  if (!isHospitalized(char)) return 0
  return Math.ceil(
    (new Date(char.hospital_until).getTime() - Date.now()) / 60000
  )
}

export function jailRemaining(char) {
  if (!isJailed(char)) return 0
  return Math.ceil(
    (new Date(char.jail_until).getTime() - Date.now()) / 60000
  )
}

/*
 * Returns a block message when the character cannot
 * perform an action, or null if they can.
 */
export function checkBlocked(char) {
  if (isHospitalized(char)) {
    return [
      '🏥 *HOSPITALIZED*',
      '',
      `You are in the hospital for another *${hospitalRemaining(char)} minute(s)*.`,
      '',
      'Use `.heal` to pay for early release.'
    ].join('\n')
  }

  if (isJailed(char)) {
    return [
      '🚔 *JAILED*',
      '',
      `You are locked up for another *${jailRemaining(char)} minute(s)*.`,
      '',
      'Use `.bail` to pay bail.'
    ].join('\n')
  }

  return null
}

/* -------------------------------------------------------------------------- */
/* Resource spenders                                                          */
/* -------------------------------------------------------------------------- */

/*
 * Spend energy / nerve. Returns true on success, false
 * when the character doesn't have enough.
 */
export function spendEnergy(tenantId, groupId, jid, amount) {
  const char = getViceCharacter(tenantId, groupId, jid)
  if (!char) return false
  if (char.energy < amount) return false

  updateViceCharacter(tenantId, groupId, jid, {
    energy: char.energy - amount
  })

  return true
}

export function spendNerve(tenantId, groupId, jid, amount) {
  const char = getViceCharacter(tenantId, groupId, jid)
  if (!char) return false
  if (char.nerve < amount) return false

  updateViceCharacter(tenantId, groupId, jid, {
    nerve: char.nerve - amount
  })

  return true
}

/* -------------------------------------------------------------------------- */
/* XP + level                                                                 */
/* -------------------------------------------------------------------------- */

export function xpForLevel(level) {
  return level * 100
}

export function awardXP(tenantId, groupId, jid, amount) {
  const char = getViceCharacter(tenantId, groupId, jid)
  if (!char) return null

  let xp = char.xp + amount
  let level = char.level
  let leveled = false

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level)
    level++
    leveled = true
  }

  updateViceCharacter(tenantId, groupId, jid, { xp, level })

  return { leveled, level, xp }
}

/* -------------------------------------------------------------------------- */
/* Career                                                                     */
/* -------------------------------------------------------------------------- */

export function canChooseCareer(char) {
  return char.level >= CAREER_REQUIREMENTS.assassin.level
}

export function canSwitchCareer(char) {
  if (char.level < CAREER_SWITCH_LEVEL) {
    return { ok: false, reason: `Level ${CAREER_SWITCH_LEVEL}+ required to switch.` }
  }

  const cooldowns = JSON.parse(char.cooldowns_json || '{}')
  const lastSwitch = cooldowns.career_switch

  if (lastSwitch) {
    const elapsed = Date.now() - new Date(lastSwitch).getTime()
    if (elapsed < CAREER_SWITCH_COOLDOWN_MS) {
      const hours = Math.ceil(
        (CAREER_SWITCH_COOLDOWN_MS - elapsed) / 3600000
      )
      return { ok: false, reason: `Career switch locked for ${hours}h.` }
    }
  }

  if (char.credits < CAREER_SWITCH_COST) {
    return {
      ok: false,
      reason: `Switch costs ${CAREER_SWITCH_COST} XC. You have ${char.credits}.`
    }
  }

  return { ok: true }
}

export function setCareer(tenantId, groupId, jid, career, options = {}) {
  const { switched = false } = options
  const char = getViceCharacter(tenantId, groupId, jid)
  if (!char) return null

  const patch = { career }

  if (switched) {
    patch.credits = char.credits - CAREER_SWITCH_COST

    const cooldowns = JSON.parse(char.cooldowns_json || '{}')
    cooldowns.career_switch = new Date().toISOString()
    patch.cooldowns_json = JSON.stringify(cooldowns)
  }

  return updateViceCharacter(tenantId, groupId, jid, patch)
}

/* -------------------------------------------------------------------------- */
/* Hospital / jail                                                            */
/* -------------------------------------------------------------------------- */

export function hospitalize(tenantId, groupId, jid, minutes = 30) {
  const until = new Date(Date.now() + minutes * 60000).toISOString()
  return updateViceCharacter(tenantId, groupId, jid, { hospital_until: until, hp: 0 })
}

export function jail(tenantId, groupId, jid, minutes = 15) {
  const until = new Date(Date.now() + minutes * 60000).toISOString()
  return updateViceCharacter(tenantId, groupId, jid, { jail_until: until })
}

export function clearHospital(tenantId, groupId, jid) {
  return updateViceCharacter(tenantId, groupId, jid, { hospital_until: null, hp: 50 })
}

export function clearJail(tenantId, groupId, jid) {
  return updateViceCharacter(tenantId, groupId, jid, { jail_until: null })
}

/* -------------------------------------------------------------------------- */
/* Cooldowns                                                                  */
/* -------------------------------------------------------------------------- */

export function isOnCooldown(char, key, ms) {
  const cooldowns = JSON.parse(char.cooldowns_json || '{}')
  const last = cooldowns[key]
  if (!last) return { onCooldown: false }

  const elapsed = Date.now() - new Date(last).getTime()
  if (elapsed >= ms) return { onCooldown: false }

  return {
    onCooldown: true,
    remaining: Math.ceil((ms - elapsed) / 1000)
  }
}

export function setCooldown(tenantId, groupId, jid, key) {
  const char = getViceCharacter(tenantId, groupId, jid)
  if (!char) return

  const cooldowns = JSON.parse(char.cooldowns_json || '{}')
  cooldowns[key] = new Date().toISOString()

  updateViceCharacter(tenantId, groupId, jid, {
    cooldowns_json: JSON.stringify(cooldowns)
  })
}

/* -------------------------------------------------------------------------- */
/* VICE — territory bonus resolver                                           */
/* -------------------------------------------------------------------------- */

/*
 * Returns a faction's bonuses based on what territories
 * they currently own. Only active crew members benefit.
 */
export function getTerritoryBonuses(tenantId, groupId, jid) {
  const faction = getViceFactionForMember(tenantId, jid, groupId)

  const bonuses = {
    creditsMult: 1,
    heistMult: 1,
    strengthBonus: 0,
    techBonus: 0,
    luckBonus: 0,
    auraPerWeek: 0
  }

  if (!faction) return bonuses

  const territories = listViceTerritories()

  for (const t of territories) {
    if (t.current_owner_faction_id !== faction.id) continue

    switch (t.bonus_type) {
      case 'credits':
        bonuses.creditsMult += t.bonus_value
        break
      case 'heist':
        bonuses.heistMult += t.bonus_value
        break
      case 'strength':
        bonuses.strengthBonus += t.bonus_value * 100
        break
      case 'tech':
        bonuses.techBonus += t.bonus_value * 100
        break
      case 'luck':
        bonuses.luckBonus += t.bonus_value
        break
      case 'aura':
        bonuses.auraPerWeek += t.bonus_value
        break
    }
  }

  return bonuses
}

/* -------------------------------------------------------------------------- */
/* VICE — crime actions                                                       */
/* -------------------------------------------------------------------------- */

import crypto from 'node:crypto'

const rint = (min, max) =>
  crypto.randomInt(min, max + 1)

/*
 * Cooldown durations per action. Override via env if you
 * want to tune later without a code change.
 */
export const CRIME_COOLDOWNS = {
  grind:   Number(process.env.VICE_CD_GRIND_MS)   || 30 * 1000,
  rob:     Number(process.env.VICE_CD_ROB_MS)     || 5 * 60 * 1000,
  smuggle: Number(process.env.VICE_CD_SMUGGLE_MS) || 15 * 60 * 1000
}

/* -------------------------------------------------------------------------- */
/* .grind — safe, low reward, low cost                                        */
/* -------------------------------------------------------------------------- */

export function grind({ tenantId, groupId, jid }) {
  const char = loadCharacter(tenantId, groupId, jid)
  if (!char) return { error: 'Could not load character.' }

  const blocked = checkBlocked(char)
  if (blocked) return { error: blocked }

  const cd = isOnCooldown(char, 'grind', CRIME_COOLDOWNS.grind)
  if (cd.onCooldown) {
    return { error: `⏳ Wait *${cd.remaining}s* before grinding again.` }
  }

  if (char.energy < 10) {
    return {
      error: [
        '⚡ *NOT ENOUGH ENERGY*',
        '',
        `You have ${char.energy}/100. Grinding costs 10.`,
        'Energy regenerates +10 every 5 minutes.'
      ].join('\n')
    }
  }

  /* -------------------------------------------
   * Reward scaling — career modifier
   * ----------------------------------------- */
    let base = rint(40, 90)
  let xp = 8

  if (char.career === 'smuggler') {
    base = Math.floor(base * 1.5)
    xp = Math.floor(xp * 1.2)
  }

  if (char.career === 'hacker') {
    base = Math.floor(base * 1.15)
    xp = Math.floor(xp * 1.1)
  }

  /* Territory bonus */
  const bonuses = getTerritoryBonuses(tenantId, groupId, jid)
  base = Math.floor(base * bonuses.creditsMult)

  /* Career credit bonus */
  updateViceCharacter(tenantId, groupId, jid, {
    credits: char.credits + base,
    energy: char.energy - 10,
    last_energy_tick: char.last_energy_tick || new Date().toISOString()
  })

  const xpResult = awardXP(tenantId, groupId, jid, xp)

  setCooldown(tenantId, groupId, jid, 'grind')

  return {
    type: 'grind',
    earned: base,
    xp,
    leveled: xpResult?.leveled || false,
    level: xpResult?.level || char.level,
    flavor: grindFlavor(char.career)
  }
}

function grindFlavor(career) {
  const pools = {
    assassin: [
      'Contracted a low-tier hit. Clean work.',
      'Collected a debt from a corner dealer.',
      'Staked out a target for two hours. Paid on delivery.'
    ],
    hacker: [
      'Skimmed microtransactions from a shell corp.',
      'Flipped stolen data on the dark web.',
      'Bypassed a minor firewall for a client.'
    ],
    face: [
      'Talked a merchant into a "favor".',
      'Sold a fake ID to a desperate runner.',
      'Ran a short con on a tourist.'
    ],
    smuggler: [
      'Moved a crate through three checkpoints.',
      'Dropped a package for a dock foreman.',
      'Rode a hoverbike across the river with cargo.'
    ],
    enforcer: [
      'Shook down a shop for protection money.',
      'Broke up a bar fight on the boss’s orders.',
      'Escorted a courier through hostile turf.'
    ]
  }

  const pool = pools[career] || [
    'Ran errands for a fixer.',
    'Sold scrap from the junkyard.',
    'Did courier work across the district.',
    'Took a shift at a grimy bar.',
    'Collected scrap metal from a wreck.'
  ]

  return pool[rint(0, pool.length - 1)]
}

/* -------------------------------------------------------------------------- */
/* .rob @user — moderate risk, moderate reward                                 */
/* -------------------------------------------------------------------------- */

export function rob({ tenantId, groupId, jid, targetJid }) {
  if (!targetJid) return { error: 'Mention someone to rob.' }
  if (targetJid === jid) return { error: 'You cannot rob yourself.' }

  const char = loadCharacter(tenantId, groupId, jid)
  const target = loadCharacter(tenantId, groupId, targetJid)

  if (!char) return { error: 'Could not load your character.' }
  if (!target) return { error: 'Target not synchronized yet.' }

  const blocked = checkBlocked(char)
  if (blocked) return { error: blocked }

  const cd = isOnCooldown(char, 'rob', CRIME_COOLDOWNS.rob)
  if (cd.onCooldown) {
    return { error: `⏳ Wait *${cd.remaining}s* before robbing again.` }
  }

  if (char.nerve < 15) {
    return {
      error: [
        '🧠 *NOT ENOUGH NERVE*',
        '',
        `You have ${char.nerve}/20. Robbing costs 15.`,
        'Nerve regenerates +1 every 15 minutes.'
      ].join('\n')
    }
  }

  if (target.credits < 50) {
    return `❌ Target is too broke to rob. They have ${target.credits} XC.`
  }

  /* -------------------------------------------
   * Success formula
   * ----------------------------------------- */
  const baseChance = 0.65
  const agilityFactor = (char.agility - target.agility) * 0.02
  const careerBonus = char.career === 'assassin' ? 0.10 : 0
  const hackerBonus = char.career === 'hacker' ? 0.05 : 0

  const successChance = Math.max(
    0.15,
    Math.min(
      0.92,
      baseChance + agilityFactor + careerBonus + hackerBonus
    )
  )

  const roll = Math.random()
  const success = roll < successChance

  /* -------------------------------------------
   * Bust branch
   * ----------------------------------------- */
  if (!success) {
    const bustedUntil = new Date(
      Date.now() + JAIL_DURATION_MS
    ).toISOString()

    updateViceCharacter(tenantId, groupId, jid, {
      nerve: char.nerve - 15,
      busted: char.busted + 1,
      jail_until: bustedUntil
    })

    setCooldown(tenantId, groupId, jid, 'rob')

    return {
      type: 'rob',
      success: false,
      jailedFor: 15,
      flavor: 'Alarms blared. You were grabbed before you could run.'
    }
  }

  /* -------------------------------------------
   * Success branch
   * ----------------------------------------- */
  const stealPct = rint(5, 15) / 100
  const stolen = Math.max(50, Math.floor(target.credits * stealPct))

  const xp = 15

  updateViceCharacter(tenantId, groupId, jid, {
    credits: char.credits + stolen,
    nerve: char.nerve - 15,
    robberies: char.robberies + 1
  })

  updateViceCharacter(tenantId, groupId, targetJid, {
    credits: Math.max(0, target.credits - stolen)
  })

  const xpResult = awardXP(tenantId, groupId, jid, xp)

  setCooldown(tenantId, groupId, jid, 'rob')

  return {
    type: 'rob',
    success: true,
    stolen,
    xp,
    leveled: xpResult?.leveled || false,
    level: xpResult?.level || char.level,
    target: targetJid,
    flavor: 'You slipped into their pocket and vanished into the crowd.'
  }
}

/* -------------------------------------------------------------------------- */
/* .smuggle — high risk, high reward                                           */
/* -------------------------------------------------------------------------- */

export function smuggle({ tenantId, groupId, jid }) {
  const char = loadCharacter(tenantId, groupId, jid)
  if (!char) return { error: 'Could not load character.' }

  const blocked = checkBlocked(char)
  if (blocked) return { error: blocked }

  const cd = isOnCooldown(char, 'smuggle', CRIME_COOLDOWNS.smuggle)
  if (cd.onCooldown) {
    return { error: `⏳ Wait *${cd.remaining}s* before smuggling again.` }
  }

  if (char.energy < 25) {
    return {
      error: [
        '⚡ *NOT ENOUGH ENERGY*',
        '',
        `You have ${char.energy}/100. Smuggling costs 25.`
      ].join('\n')
    }
  }

  /* -------------------------------------------
   * Success chance
   * ----------------------------------------- */
  const baseChance = 0.55
  const techFactor = char.tech * 0.015
  const smugglerBonus = char.career === 'smuggler' ? 0.15 : 0
  const hackerBonus = char.career === 'hacker' ? 0.08 : 0

  const successChance = Math.max(
    0.10,
    Math.min(
      0.90,
      baseChance + techFactor + smugglerBonus + hackerBonus
    )
  )

  const roll = Math.random()
  const success = roll < successChance

  /* -------------------------------------------
   * Bust branch
   * ----------------------------------------- */
  if (!success) {
    const lostCredits = Math.floor(char.credits * 0.08)

    updateViceCharacter(tenantId, groupId, jid, {
      credits: Math.max(0, char.credits - lostCredits),
      energy: char.energy - 25,
      busted: char.busted + 1
    })

    setCooldown(tenantId, groupId, jid, 'smuggle')

    return {
      type: 'smuggle',
      success: false,
      lost: lostCredits,
      flavor: 'Customs seized the cargo. You ran — barely.'
    }
  }

  /* -------------------------------------------
   * Success branch
   * ----------------------------------------- */
    let payout = rint(300, 800)

  if (char.career === 'smuggler') {
    payout = Math.floor(payout * 1.4)
  }

  const bonuses = getTerritoryBonuses(tenantId, groupId, jid)
  payout = Math.floor(payout * bonuses.heistMult * bonuses.creditsMult)

  const xp = 25

  updateViceCharacter(tenantId, groupId, jid, {
    credits: char.credits + payout,
    energy: char.energy - 25
  })

  const xpResult = awardXP(tenantId, groupId, jid, xp)

  setCooldown(tenantId, groupId, jid, 'smuggle')

  return {
    type: 'smuggle',
    success: true,
    payout,
    xp,
    leveled: xpResult?.leveled || false,
    level: xpResult?.level || char.level,
    flavor: 'Cargo delivered. No tail. Payment came through cold.'
  }
}

/* -------------------------------------------------------------------------- */
/* VICE — combat                                                              */
/* -------------------------------------------------------------------------- */

export const COMBAT_COOLDOWNS = {
  hit:     Number(process.env.VICE_CD_HIT_MS)     || 60 * 1000,
  stab:    Number(process.env.VICE_CD_STAB_MS)    || 2 * 60 * 1000,
  shoot:   Number(process.env.VICE_CD_SHOOT_MS)   || 3 * 60 * 1000,
  execute: Number(process.env.VICE_CD_EXECUTE_MS) || 5 * 60 * 1000
}

const NEW_PLAYER_PROTECTION_LEVEL = 5

/*
 * Weapon damage table. Ammo is consumed for `shoot`.
 * Damage scales with strength but has a floor and cap.
 */
const ATTACKS = {
  hit: {
    energy: 5,
    baseMin: 10,
    baseMax: 20,
    strengthFactor: 1.0,
    xp: 8,
    verb: 'hits'
  },
  stab: {
    energy: 10,
    baseMin: 20,
    baseMax: 35,
    strengthFactor: 1.3,
    xp: 15,
    verb: 'stabs'
  },
  shoot: {
    energy: 15,
    baseMin: 35,
    baseMax: 60,
    strengthFactor: 1.8,
    xp: 25,
    verb: 'shoots',
    ammo: 1
  },
  execute: {
    energy: 20,
    baseMin: 999,
    baseMax: 999,
    strengthFactor: 0,
    xp: 60,
    verb: 'executes',
    requiresCareer: 'assassin',
    requiresHpBelow: 0.20
  }
}

/* -------------------------------------------------------------------------- */
/* Combat state checks                                                        */
/* -------------------------------------------------------------------------- */

export function canAttack(attacker, target, options = {}) {
  const { allowNewPlayer = false } = options

  if (!attacker || !target) {
    return { ok: false, reason: 'Missing combatant.' }
  }

  if (!allowNewPlayer && target.level < NEW_PLAYER_PROTECTION_LEVEL) {
    return {
      ok: false,
      reason: [
        '🛡️ *NEW PLAYER PROTECTION*',
        '',
        `Level ${target.level} is under protection.`,
        `Combat unlocks at Level ${NEW_PLAYER_PROTECTION_LEVEL}.`
      ].join('\n')
    }
  }

  if (target.pvp_enabled === 0) {
    return {
      ok: false,
      reason: '🕊️ That player has PvP disabled.'
    }
  }

  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/* Core combat resolver                                                       */
/* -------------------------------------------------------------------------- */

export function resolveAttack({
  tenantId,
  groupId,
  attackerJid,
  targetJid,
  attackType
}) {
  const spec = ATTACKS[attackType]

  if (!spec) {
    return { error: `Unknown attack: ${attackType}` }
  }

  if (attackerJid === targetJid) {
    return { error: 'You cannot attack yourself.' }
  }

  let attacker = loadCharacter(tenantId, groupId, attackerJid)
  let target = loadCharacter(tenantId, groupId, targetJid)

  if (!attacker) return { error: 'Attacker has no character.' }
  if (!target) return { error: 'Target has no character.' }

  /* -------------------------------------------
   * Blocked states
   * ----------------------------------------- */
  const blocked = checkBlocked(attacker)
  if (blocked) return { error: blocked }

  if (isHospitalized(target)) {
    return { error: 'Target is already hospitalized.' }
  }

  if (isJailed(target)) {
    return { error: 'Target is already jailed.' }
  }

  /* -------------------------------------------
   * Career requirement
   * ----------------------------------------- */
  if (spec.requiresCareer && attacker.career !== spec.requiresCareer) {
    return {
      error: `🔒 *.${attackType}* is only available to *${spec.requiresCareer}* career.`
    }
  }

  /* -------------------------------------------
   * Execute threshold
   * ----------------------------------------- */
  if (spec.requiresHpBelow) {
    const threshold = target.max_hp * spec.requiresHpBelow

    if (target.hp > threshold) {
      return {
        error: [
          '🎯 *EXECUTE REQUIRES TARGET BELOW ' +
            Math.round(spec.requiresHpBelow * 100) +
            '% HP*',
          '',
          `Target: ${target.hp}/${target.max_hp} HP.`,
          `Threshold: ${Math.floor(threshold)} HP.`
        ].join('\n')
      }
    }
  }

  /* -------------------------------------------
   * PvP gate
   * ----------------------------------------- */
  const gate = canAttack(attacker, target)

  if (!gate.ok) return { error: gate.reason }

  /* -------------------------------------------
   * Cooldown
   * ----------------------------------------- */
  const cd = isOnCooldown(
    attacker,
    attackType,
    COMBAT_COOLDOWNS[attackType]
  )

  if (cd.onCooldown) {
    return { error: `⏳ Wait *${cd.remaining}s* before *.${attackType}* again.` }
  }

  /* -------------------------------------------
   * Resource cost
   * ----------------------------------------- */
  if (attacker.energy < spec.energy) {
    return {
      error: `⚡ Not enough energy. *.${attackType}* costs ${spec.energy}. You have ${attacker.energy}.`
    }
  }

      /* -------------------------------------------
   * Ammo consumption
   * ----------------------------------------- */
  if (spec.ammo) {
    const gear = listViceGear(tenantId, groupId, attackerJid)
    const ammoItems = gear.filter((g) => g.item_id === 'ammo')

    if (ammoItems.length < spec.ammo) {
      return {
        error: [
          '🔫 *NO AMMO*',
          '',
          `You need ${spec.ammo} round(s).`,
          'Buy from the Black Market with `.buy ammo <qty>`.'
        ].join('\n')
      }
    }

    consumeGearItem(tenantId, groupId, attackerJid, 'ammo', spec.ammo)
  }

  /* -------------------------------------------
   * Effective stats with gear
   * ----------------------------------------- */
  const attackerStats = effectiveStats(tenantId, groupId, attackerJid, attacker)
  const targetStats = effectiveStats(tenantId, groupId, targetJid, target)

  /* -------------------------------------------
   * Dodge chance
   * ----------------------------------------- */
  const agiDiff = targetStats.agility - attackerStats.agility
  const dodgeChance = Math.max(0.05, Math.min(0.35, 0.10 + agiDiff * 0.015))

  const dodged = Math.random() < dodgeChance

  /* -------------------------------------------
   * Damage roll
   * ----------------------------------------- */
  let damage = 0
  let crit = false

  if (!dodged) {
    if (attackType === 'execute') {
      damage = target.hp
    } else {
      const base = rint(spec.baseMin, spec.baseMax)
      const strBonus = Math.floor(attackerStats.strength * spec.strengthFactor)
      damage = base + strBonus

      /* Assassin crit chance */
      if (attacker.career === 'assassin' && Math.random() < 0.25) {
        crit = true
        damage = Math.floor(damage * 1.5)
      }
    }
  }

  /* -------------------------------------------
   * Apply damage + update stats
   * ----------------------------------------- */
  const targetNewHp = Math.max(0, target.hp - damage)

  const attackerPatch = {
    energy: attacker.energy - spec.energy
  }

  const targetPatch = {
    hp: targetNewHp
  }

  let leveled = false
  let newAttackerLevel = attacker.level

  if (!dodged) {
    const xpResult = awardXP(tenantId, groupId, attackerJid, spec.xp)
    leveled = xpResult?.leveled || false
    newAttackerLevel = xpResult?.level || attacker.level
  }

  /* -------------------------------------------
   * KO logic
   * ----------------------------------------- */
  let killed = false
  let walletStolen = 0

  if (targetNewHp === 0) {
    killed = true

    const lossAmount = Math.floor(target.credits * DEATH_WALLET_LOSS)

    walletStolen = lossAmount

    targetPatch.credits = Math.max(0, target.credits - lossAmount)
    targetPatch.hospital_until = new Date(
      Date.now() + HOSPITAL_DURATION_MS
    ).toISOString()
    targetPatch.deaths = target.deaths + 1

    attackerPatch.kills = attacker.kills + 1
    attackerPatch.credits = attacker.credits + lossAmount
  }

  updateViceCharacter(tenantId, groupId, attackerJid, attackerPatch)
  updateViceCharacter(tenantId, groupId, targetJid, targetPatch)

  setCooldown(tenantId, groupId, attackerJid, attackType)

  return {
    type: 'combat',
    attackType,
    verb: spec.verb,
    dodged,
    crit,
    damage,
    killed,
    walletStolen,
    xp: dodged ? 0 : spec.xp,
    leveled,
    level: newAttackerLevel,
    targetHp: targetNewHp,
    targetMaxHp: target.max_hp
  }
}


/* -------------------------------------------------------------------------- */
/* PvP toggle helpers                                                         */
/* -------------------------------------------------------------------------- */

export function setPvpSelf(tenantId, groupId, jid, enabled) {
  return updateViceCharacter(tenantId, groupId, jid, {
    pvp_enabled: enabled ? 1 : 0
  })
}


/* -------------------------------------------------------------------------- */
/* VICE — Black Market catalog                                                */
/* -------------------------------------------------------------------------- */

export const SHOP_ITEMS = {
  /* --- Weapons --- */
  knife: {
    id: 'knife', name: '🔪 Street Knife', slot: 'weapon',
    cost: 800, strength: 5, description: '+5 STR'
  },
  bat: {
    id: 'bat', name: '🏏 Steel Bat', slot: 'weapon',
    cost: 1800, strength: 8, description: '+8 STR'
  },
  pistol: {
    id: 'pistol', name: '🔫 Pistol', slot: 'weapon',
    cost: 5000, strength: 10, unlocks: 'shoot', description: '+10 STR · unlocks .shoot'
  },
  smg: {
    id: 'smg', name: '🔫 SMG', slot: 'weapon',
    cost: 12000, strength: 16, unlocks: 'shoot', description: '+16 STR'
  },
  sniper: {
    id: 'sniper', name: '🎯 Sniper Rifle', slot: 'weapon',
    cost: 40000, strength: 25, unlocks: 'shoot', description: '+25 STR'
  },

  /* --- Armor --- */
  jacket: {
    id: 'jacket', name: '🧥 Leather Jacket', slot: 'armor',
    cost: 1200, maxHp: 10, description: '+10 Max HP'
  },
  vest: {
    id: 'vest', name: '🛡️ Kevlar Vest', slot: 'armor',
    cost: 4000, maxHp: 20, description: '+20 Max HP'
  },
  stealth: {
    id: 'stealth', name: '🥷 Stealth Suit', slot: 'armor',
    cost: 12000, agility: 15, description: '+15 AGI'
  },
  exosuit: {
    id: 'exosuit', name: '⚙️ Exosuit', slot: 'armor',
    cost: 30000, maxHp: 40, strength: 10, description: '+40 HP · +10 STR'
  },

  /* --- Tech --- */
  laptop: {
    id: 'laptop', name: '💻 Laptop', slot: 'tech',
    cost: 6000, tech: 15, description: '+15 TECH'
  },
  jammer: {
    id: 'jammer', name: '📡 Signal Jammer', slot: 'tech',
    cost: 20000, tech: 30, description: '+30 TECH · +30% crime escape'
  },
  cyberdeck: {
    id: 'cyberdeck', name: '🧠 Cyberdeck', slot: 'tech',
    cost: 45000, tech: 50, description: '+50 TECH'
  },

  /* --- Vehicles --- */
  bike: {
    id: 'bike', name: '🏍️ Motorbike', slot: 'vehicle',
    cost: 8000, agility: 5, description: '+5 AGI · -20% travel time'
  },
  car: {
    id: 'car', name: '🚗 Sports Car', slot: 'vehicle',
    cost: 15000, agility: 10, description: '+10 AGI · -30% travel time'
  },
  supercar: {
    id: 'supercar', name: '🏎️ Supercar', slot: 'vehicle',
    cost: 40000, agility: 20, description: '+20 AGI'
  },

  /* --- Safehouse --- */
  safehouse: {
    id: 'safehouse', name: '🏠 Safehouse', slot: 'safehouse',
    cost: 25000, heistRisk: -0.5, description: '-50% heist risk'
  },
  fortress: {
    id: 'fortress', name: '🏰 Fortress', slot: 'safehouse',
    cost: 75000, heistRisk: -0.75, maxHp: 20, description: '-75% heist risk · +20 HP'
  },

  /* --- Accessories --- */
  ring: {
    id: 'ring', name: '💎 Diamond Ring', slot: 'accessory',
    cost: 10000, cool: 5, description: '+5 COOL'
  },
  auraprism: {
    id: 'auraprism', name: '✨ Aura Prism', slot: 'accessory',
    cost: 0, auraCost: 50, cool: 10, auraPerDay: 1,
    description: '+10 COOL · +1 Aura/day'
  },

  /* --- Consumables --- */
  ammo: {
    id: 'ammo', name: '🔸 Ammo Round', slot: 'consumable',
    cost: 150, description: '1 round for .shoot', stackable: true
  },
  medkit: {
    id: 'medkit', name: '💊 Medkit', slot: 'consumable',
    cost: 500, description: 'Instant +50 HP', stackable: true
  }
}

export const SLOT_NAMES = {
  weapon: 'Weapons',
  armor: 'Armor',
  tech: 'Tech',
  vehicle: 'Vehicles',
  safehouse: 'Safehouses',
  accessory: 'Accessories',
  consumable: 'Consumables'
}

/* -------------------------------------------------------------------------- */
/* Gear queries                                                               */
/* -------------------------------------------------------------------------- */

export function listViceGear(tenantId, groupId, jid) {
  if (!groupId || !jid) return []
  return db.prepare(`
    SELECT * FROM vice_gear
    WHERE tenant_id=? AND group_id=? AND jid=?
    ORDER BY acquired_at ASC
  `).all(tenantId, groupId, jid)
}

export function consumeGearItem(tenantId, groupId, jid, itemId, count = 1) {
  const rows = db.prepare(`
    SELECT id FROM vice_gear
    WHERE tenant_id=? AND group_id=? AND jid=? AND item_id=?
    ORDER BY acquired_at ASC
    LIMIT ?
  `).all(tenantId, groupId, jid, itemId, count)

  let consumed = 0
  for (const row of rows) {
    db.prepare(`DELETE FROM vice_gear WHERE tenant_id=? AND id=?`).run(tenantId, row.id)
    consumed++
  }
  return { consumed }
}

/* -------------------------------------------------------------------------- */
/* Effective stats with gear bonuses                                          */
/* -------------------------------------------------------------------------- */

export function effectiveStats(tenantId, groupId, jid, char) {
  const gear = listViceGear(tenantId, groupId, jid)

  let strength = char.strength
  let agility = char.agility
  let tech = char.tech
  let cool = char.cool
  let maxHp = char.max_hp
  let heistRiskMod = 0

  for (const item of gear) {
    if (item.equipped !== 1) continue
    const def = SHOP_ITEMS[item.item_id]
    if (!def) continue

    if (def.strength) strength += def.strength
    if (def.agility) agility += def.agility
    if (def.tech) tech += def.tech
    if (def.cool) cool += def.cool
    if (def.maxHp) maxHp += def.maxHp
    if (def.heistRisk) heistRiskMod += def.heistRisk
  }

  /* Territory bonuses */
  const bonuses = getTerritoryBonuses(tenantId, groupId, jid)
  strength += bonuses.strengthBonus
  tech += bonuses.techBonus

  return { strength, agility, tech, cool, maxHp, heistRiskMod }
}

/* -------------------------------------------------------------------------- */
/* Buy / sell / equip                                                         */
/* -------------------------------------------------------------------------- */

export function buyItem(tenantId, groupId, jid, itemId, quantity = 1) {
  const def = SHOP_ITEMS[itemId]
  if (!def) return { error: `Unknown item: ${itemId}` }

  const char = loadCharacter(tenantId, groupId, jid)
  if (!char) return { error: 'No character.' }

  const qty = def.stackable ? Math.max(1, Math.min(99, quantity)) : 1
  const totalCost = def.cost * qty

  /* Aura items */
  if (def.auraCost) {
    if (char.aura < def.auraCost) {
      return { error: `Needs ${def.auraCost} AU. You have ${char.aura}.` }
    }
    updateViceCharacter(tenantId, groupId, jid, {
      aura: char.aura - def.auraCost
    })
  } else {
    if (char.credits < totalCost) {
      return { error: `Needs ${totalCost.toLocaleString()} XC. You have ${char.credits.toLocaleString()}.` }
    }
    updateViceCharacter(tenantId, groupId, jid, {
      credits: char.credits - totalCost
    })
  }

  /* Insert items */
  const timestamp = new Date().toISOString()

  for (let i = 0; i < qty; i++) {
    const id = `gear_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${i}`
    db.prepare(`
      INSERT INTO vice_gear (tenant_id, id, group_id, jid, item_id, slot, equipped, acquired_at)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(tenantId, id, groupId, jid, def.id, def.slot, 0, timestamp)
  }

  return {
    type: 'buy',
    item: def,
    quantity: qty,
    cost: def.auraCost ? 0 : totalCost,
    auraCost: def.auraCost || 0
  }
}

export function sellItem(tenantId, groupId, jid, itemId) {
  const def = SHOP_ITEMS[itemId]
  if (!def) return { error: `Unknown item: ${itemId}` }

  const row = db.prepare(`
    SELECT id FROM vice_gear
    WHERE tenant_id=? AND group_id=? AND jid=? AND item_id=?
    ORDER BY acquired_at ASC
    LIMIT 1
  `).get(tenantId, groupId, jid, itemId)

  if (!row) return { error: `You don't own ${def.name}.` }

  db.prepare(`DELETE FROM vice_gear WHERE tenant_id=? AND id=?`).run(tenantId, row.id)

  const refund = Math.floor(def.cost * 0.5)
  const char = loadCharacter(tenantId, groupId, jid)
  updateViceCharacter(tenantId, groupId, jid, {
    credits: (char?.credits || 0) + refund
  })

  return {
    type: 'sell',
    item: def,
    refund
  }
}

export function equipItem(tenantId, groupId, jid, itemId) {
  const def = SHOP_ITEMS[itemId]
  if (!def) return { error: `Unknown item: ${itemId}` }

  if (def.slot === 'consumable') {
    return { error: 'Consumables cannot be equipped.' }
  }

  const row = db.prepare(`
    SELECT id, equipped FROM vice_gear
    WHERE tenant_id=? AND group_id=? AND jid=? AND item_id=?
    ORDER BY equipped DESC, acquired_at ASC
    LIMIT 1
  `).get(tenantId, groupId, jid, itemId)

  if (!row) return { error: `You don't own ${def.name}.` }

  /* Toggle off if already equipped */
  if (row.equipped === 1) {
    db.prepare(`UPDATE vice_gear SET equipped=0 WHERE tenant_id=? AND id=?`).run(tenantId, row.id)
    return { type: 'equip', item: def, equipped: false }
  }

  /* Unequip anything else in the same slot */
  db.prepare(`
    UPDATE vice_gear
    SET equipped=0
    WHERE tenant_id=? AND group_id=? AND jid=? AND slot=?
  `).run(tenantId, groupId, jid, def.slot)

  db.prepare(`UPDATE vice_gear SET equipped=1 WHERE tenant_id=? AND id=?`).run(tenantId, row.id)

  return { type: 'equip', item: def, equipped: true }
}

export function useConsumable(tenantId, groupId, jid, itemId) {
  if (itemId === 'medkit') {
    const char = loadCharacter(tenantId, groupId, jid)
    if (!char) return { error: 'No character.' }

    const row = db.prepare(`
      SELECT id FROM vice_gear
      WHERE tenant_id=? AND group_id=? AND jid=? AND item_id='medkit'
      LIMIT 1
    `).get(tenantId, groupId, jid)

    if (!row) return { error: 'No medkit in inventory.' }

    db.prepare(`DELETE FROM vice_gear WHERE tenant_id=? AND id=?`).run(tenantId, row.id)

    const healed = Math.min(char.max_hp - char.hp, 50)
    updateViceCharacter(tenantId, groupId, jid, {
      hp: char.hp + healed,
      hospital_until: null
    })

    return { type: 'medkit', healed }
  }

  if (itemId === 'ammo') {
    return { error: 'Ammo is consumed automatically when you .shoot.' }
  }

  return { error: 'That item is not usable.' }
}

/* -------------------------------------------------------------------------- */
/* VICE — crews                                                               */
/* -------------------------------------------------------------------------- */

export const CREW_CREATE_COST = 25000
export const CREW_NAME_MIN = 3
export const CREW_NAME_MAX = 20
export const CREW_MAX_MEMBERS = 30

const CREW_NAME_RE = /^[A-Za-z0-9 _-]+$/

export function validateCrewName(name) {
  const clean = String(name || '').trim()

  if (clean.length < CREW_NAME_MIN) {
    return { ok: false, reason: `Name must be at least ${CREW_NAME_MIN} characters.` }
  }

  if (clean.length > CREW_NAME_MAX) {
    return { ok: false, reason: `Name must be at most ${CREW_NAME_MAX} characters.` }
  }

  if (!CREW_NAME_RE.test(clean)) {
    return { ok: false, reason: 'Name may only contain letters, numbers, spaces, underscores, hyphens.' }
  }

  return { ok: true, name: clean }
}

/* -------------------------------------------------------------------------- */
/* Crew creation                                                              */
/* -------------------------------------------------------------------------- */

export function createCrew(tenantId, groupId, jid, rawName) {
  const char = loadCharacter(tenantId, groupId, jid)
  if (!char) return { error: 'No character.' }

  const existing = getViceFactionForMember(tenantId, jid, groupId)
  if (existing) {
    return { error: `You are already in *${existing.name}*. Leave first.` }
  }

  const check = validateCrewName(rawName)
  if (!check.ok) return { error: check.reason }

  const dup = getViceFactionByName(tenantId, groupId, check.name)
  if (dup) return { error: `A crew named *${dup.name}* already exists.` }

  if (char.credits < CREW_CREATE_COST) {
    return {
      error: `Crew creation costs *${CREW_CREATE_COST.toLocaleString()} XC*. You have ${char.credits.toLocaleString()}.`
    }
  }

  updateViceCharacter(tenantId, groupId, jid, {
    credits: char.credits - CREW_CREATE_COST
  })

  const faction = createViceFaction(tenantId, groupId, check.name, jid)

  return {
    type: 'crew_create',
    faction,
    cost: CREW_CREATE_COST
  }
}

/* -------------------------------------------------------------------------- */
/* Crew join / leave                                                          */
/* -------------------------------------------------------------------------- */

export function joinCrew(tenantId, groupId, jid, name) {
  const char = loadCharacter(tenantId, groupId, jid)
  if (!char) return { error: 'No character.' }

  const existing = getViceFactionForMember(tenantId, jid, groupId)
  if (existing) {
    return { error: `You are already in *${existing.name}*. Leave first.` }
  }

  const faction = getViceFactionByName(tenantId, groupId, name)
  if (!faction) return { error: `No crew named *${name}*.` }

  const members = getViceFactionMembers(tenantId, faction.id)
  if (members.length >= CREW_MAX_MEMBERS) {
    return { error: `*${faction.name}* is full (${CREW_MAX_MEMBERS} members).` }
  }

  const timestamp = new Date().toISOString()

  db.prepare(`
    INSERT INTO vice_faction_members (tenant_id, faction_id, jid, role, joined_at)
    VALUES (?,?,?,?,?)
    ON CONFLICT(tenant_id, faction_id, jid) DO NOTHING
  `).run(tenantId, faction.id, jid, 'member', timestamp)

  return {
    type: 'crew_join',
    faction
  }
}

export function leaveCrew(tenantId, groupId, jid) {
  const faction = getViceFactionForMember(tenantId, jid, groupId)
  if (!faction) return { error: 'You are not in a crew.' }

  const members = getViceFactionMembers(tenantId, faction.id)

  if (members.length === 1) {
    /* Last member leaving — disband */
    db.prepare(`DELETE FROM vice_faction_members WHERE tenant_id=? AND faction_id=?`).run(tenantId, faction.id)
    db.prepare(`DELETE FROM vice_factions WHERE tenant_id=? AND id=?`).run(tenantId, faction.id)

    return {
      type: 'crew_disband',
      faction
    }
  }

  /* Leader leaving — pass leadership to the next officer/member */
  if (faction.leader_jid === jid) {
    const successor = members.find((m) => m.jid !== jid)

    if (successor) {
      db.prepare(`
        UPDATE vice_factions
        SET leader_jid=?, updated_at=?
        WHERE tenant_id=? AND id=?
      `).run(successor.jid, new Date().toISOString(), tenantId, faction.id)

      db.prepare(`
        UPDATE vice_faction_members
        SET role='leader'
        WHERE tenant_id=? AND faction_id=? AND jid=?
      `).run(tenantId, faction.id, successor.jid)
    }
  }

  db.prepare(`
    DELETE FROM vice_faction_members
    WHERE tenant_id=? AND faction_id=? AND jid=?
  `).run(tenantId, faction.id, jid)

  return {
    type: 'crew_leave',
    faction
  }
}

/* -------------------------------------------------------------------------- */
/* Crew roles                                                                 */
/* -------------------------------------------------------------------------- */

export function setCrewMemberRole(tenantId, groupId, actorJid, targetJid, role) {
  const faction = getViceFactionForMember(tenantId, actorJid, groupId)
  if (!faction) return { error: 'You are not in a crew.' }

  if (faction.leader_jid !== actorJid) {
    return { error: 'Only the crew leader can change roles.' }
  }

  if (targetJid === actorJid) {
    return { error: 'You cannot change your own role.' }
  }

  const target = db.prepare(`
    SELECT * FROM vice_faction_members
    WHERE tenant_id=? AND faction_id=? AND jid=?
  `).get(tenantId, faction.id, targetJid)

  if (!target) return { error: 'That member is not in your crew.' }

  if (!['officer', 'member', 'recruit'].includes(role)) {
    return { error: 'Role must be officer, member, or recruit.' }
  }

  db.prepare(`
    UPDATE vice_faction_members
    SET role=?
    WHERE tenant_id=? AND faction_id=? AND jid=?
  `).run(role, tenantId, faction.id, targetJid)

  return {
    type: 'crew_role',
    faction,
    targetJid,
    role
  }
}

/* -------------------------------------------------------------------------- */
/* Crew bank                                                                  */
/* -------------------------------------------------------------------------- */

export function crewDeposit(tenantId, groupId, jid, amount) {
  const faction = getViceFactionForMember(tenantId, jid, groupId)
  if (!faction) return { error: 'You are not in a crew.' }

  const n = Math.floor(Number(amount))
  if (!Number.isFinite(n) || n < 1) {
    return { error: 'Amount must be a positive whole number.' }
  }

  const char = loadCharacter(tenantId, groupId, jid)
  if (!char) return { error: 'No character.' }

  if (char.credits < n) {
    return { error: `You only have ${char.credits.toLocaleString()} XC.` }
  }

  updateViceCharacter(tenantId, groupId, jid, { credits: char.credits - n })

  db.prepare(`
    UPDATE vice_factions
    SET bank=bank+?, updated_at=?
    WHERE tenant_id=? AND id=?
  `).run(n, new Date().toISOString(), tenantId, faction.id)

  return {
    type: 'crew_deposit',
    faction,
    amount: n,
    newBank: faction.bank + n
  }
}

export function crewWithdraw(tenantId, groupId, jid, amount) {
  const faction = getViceFactionForMember(tenantId, jid, groupId)
  if (!faction) return { error: 'You are not in a crew.' }

  if (faction.leader_jid !== jid) {
    /* Only officers or above can withdraw */
    const memberRow = db.prepare(`
      SELECT role FROM vice_faction_members
      WHERE tenant_id=? AND faction_id=? AND jid=?
    `).get(tenantId, faction.id, jid)

    if (!memberRow || !['leader', 'officer'].includes(memberRow.role)) {
      return { error: 'Only leader or officers can withdraw from the crew bank.' }
    }
  }

  const n = Math.floor(Number(amount))
  if (!Number.isFinite(n) || n < 1) {
    return { error: 'Amount must be a positive whole number.' }
  }

  if (faction.bank < n) {
    return { error: `Crew bank has only ${faction.bank.toLocaleString()} XC.` }
  }

  const char = loadCharacter(tenantId, groupId, jid)

  updateViceCharacter(tenantId, groupId, jid, {
    credits: (char?.credits || 0) + n
  })

  db.prepare(`
    UPDATE vice_factions
    SET bank=bank-?, updated_at=?
    WHERE tenant_id=? AND id=?
  `).run(n, new Date().toISOString(), tenantId, faction.id)

  return {
    type: 'crew_withdraw',
    faction,
    amount: n,
    newBank: faction.bank - n
  }
}

/* -------------------------------------------------------------------------- */
/* Crew reputation                                                            */
/* -------------------------------------------------------------------------- */

export function addCrewReputation(tenantId, groupId, jid, amount) {
  const faction = getViceFactionForMember(tenantId, jid, groupId)
  if (!faction) return null

  const newRep = Math.max(0, faction.reputation + amount)

  /* Level scales with reputation: every 500 rep = 1 level, cap 10 */
  const newLevel = Math.min(10, Math.max(1, Math.floor(newRep / 500) + 1))

  db.prepare(`
    UPDATE vice_factions
    SET reputation=?, level=?, updated_at=?
    WHERE tenant_id=? AND id=?
  `).run(newRep, newLevel, new Date().toISOString(), tenantId, faction.id)

  return {
    faction,
    reputation: newRep,
    level: newLevel,
    leveledUp: newLevel > faction.level
  }
}

/* -------------------------------------------------------------------------- */
/* Crew overview                                                              */
/* -------------------------------------------------------------------------- */

export function crewOverview(tenantId, groupId, jid) {
  const faction = getViceFactionForMember(tenantId, jid, groupId)
  if (!faction) return null

  const members = getViceFactionMembers(tenantId, faction.id)

  const enriched = members.map((m) => {
    const char = getViceCharacter(tenantId, groupId, m.jid)
    return {
      jid: m.jid,
      role: m.role,
      joined_at: m.joined_at,
      level: char?.level || 1,
      credits: char?.credits || 0,
      kills: char?.kills || 0,
      deaths: char?.deaths || 0
    }
  })

  return {
    faction,
    members: enriched
  }
}

export function crewLeaderboard(tenantId, groupId) {
  return listViceFactions(tenantId, groupId)
}

/* -------------------------------------------------------------------------- */
/* VICE — territory wars                                                     */
/* -------------------------------------------------------------------------- */

export const WAR_DURATION_HOURS = 48
export const WAR_ATTACK_ENERGY = 20
export const WAR_ATTACK_COOLDOWN_MS = 90 * 1000
export const WAR_ATTACK_DAMAGE_MIN = 50
export const WAR_ATTACK_DAMAGE_MAX = 150

export function declareWar(tenantId, groupId, actorJid, targetCrewName, territoryId = null) {
  const attackerFac = getViceFactionForMember(tenantId, actorJid, groupId)

  if (!attackerFac) {
    return { error: 'You are not in a crew.' }
  }

  if (attackerFac.leader_jid !== actorJid) {
    return { error: 'Only the crew leader can declare war.' }
  }

  const defenderFac = getViceFactionByName(tenantId, groupId, targetCrewName)

  if (!defenderFac) {
    return { error: `No crew named *${targetCrewName}*.` }
  }

  if (defenderFac.id === attackerFac.id) {
    return { error: 'You cannot war yourself.' }
  }

  const active = getActiveWarForFaction(tenantId, groupId, attackerFac.id)

  if (active) {
    return { error: 'Your crew is already in an active war.' }
  }

  const defenderActive = getActiveWarForFaction(tenantId, groupId, defenderFac.id)

  if (defenderActive) {
    return { error: `*${defenderFac.name}* is already in an active war.` }
  }

  if (attackerFac.bank < 10000) {
    return {
      error: `Declaring war requires 10,000 XC in the crew bank. You have ${attackerFac.bank.toLocaleString()}.`
    }
  }

  /* Deduct war cost from bank */
  db.prepare(`
    UPDATE vice_factions
    SET bank=bank-10000, updated_at=?
    WHERE tenant_id=? AND id=?
  `).run(new Date().toISOString(), tenantId, attackerFac.id)

  /* Validate territory */
  let territory = null
  if (territoryId) {
    territory = getViceTerritory(territoryId)
    if (!territory) {
      return { error: `Unknown territory: ${territoryId}` }
    }
  } else {
    /* Auto-pick an unclaimed or enemy-owned territory */
    const territories = listViceTerritories()
    territory = territories.find(
      (t) => t.current_owner_faction_id !== attackerFac.id
    ) || territories[0]
  }

  const war = createViceWar(tenantId, {
    groupId,
    attackerFactionId: attackerFac.id,
    defenderFactionId: defenderFac.id,
    territoryId: territory?.id || null,
    durationHours: WAR_DURATION_HOURS
  })

  return {
    type: 'war_declared',
    war,
    attacker: attackerFac,
    defender: defenderFac,
    territory
  }
}

export function warAttack(tenantId, groupId, jid) {
  const actorFac = getViceFactionForMember(tenantId, jid, groupId)

  if (!actorFac) {
    return { error: 'You are not in a crew.' }
  }

  const war = getActiveWarForFaction(tenantId, groupId, actorFac.id)

  if (!war) {
    return { error: 'Your crew is not in an active war.' }
  }

  /* Check time */
  if (new Date(war.ends_at).getTime() <= Date.now()) {
    return { error: 'This war has ended. Awaiting resolution.' }
  }

  const char = loadCharacter(tenantId, groupId, jid)
  if (!char) return { error: 'No character.' }

  const blocked = checkBlocked(char)
  if (blocked) return { error: blocked }

  if (char.energy < WAR_ATTACK_ENERGY) {
    return {
      error: `⚡ War attacks cost ${WAR_ATTACK_ENERGY} energy. You have ${char.energy}.`
    }
  }

  /* Cooldown */
  const cd = isOnCooldown(char, 'war_attack', WAR_ATTACK_COOLDOWN_MS)
  if (cd.onCooldown) {
    return { error: `⏳ Wait *${cd.remaining}s* before attacking again.` }
  }

  /* Which side are we? */
  const side =
    actorFac.id === war.attacker_faction_id ? 'attacker' : 'defender'

  /* Damage roll */
  const stats = effectiveStats(tenantId, groupId, jid, char)
  const base = rint(WAR_ATTACK_DAMAGE_MIN, WAR_ATTACK_DAMAGE_MAX)
  const strBonus = Math.floor(stats.strength * 1.5)
  const damage = base + strBonus

  /* Update war score */
  const patch = {}
  if (side === 'attacker') {
    patch.attacker_score = war.attacker_score + damage
  } else {
    patch.defender_score = war.defender_score + damage
  }

  updateViceWar(tenantId, war.id, patch)

  /* Track contribution */
  addWarContribution(tenantId, {
    warId: war.id,
    jid,
    factionId: actorFac.id,
    side,
    damage
  })

  /* Spend energy + XP + rep */
  updateViceCharacter(tenantId, groupId, jid, {
    energy: char.energy - WAR_ATTACK_ENERGY
  })

  const xpResult = awardXP(tenantId, groupId, jid, 20)

  addCrewReputation(tenantId, groupId, jid, 2)

  setCooldown(tenantId, groupId, jid, 'war_attack')

  return {
    type: 'war_attack',
    side,
    damage,
    faction: actorFac,
    war: getViceWar(tenantId, war.id),
    xp: 20,
    leveled: xpResult?.leveled || false,
    level: xpResult?.level || char.level
  }
}

export function resolveWar(tenantId, groupId, warId) {
  const war = getViceWar(tenantId, warId)

  if (!war) return { error: 'War not found.' }
  if (war.status !== 'active') return { error: 'War already resolved.' }

  const attacker = getViceFaction(tenantId, war.attacker_faction_id)
  const defender = getViceFaction(tenantId, war.defender_faction_id)

  if (!attacker || !defender) {
    /* Faction disbanded mid-war */
    updateViceWar(tenantId, warId, {
      status: 'aborted',
      resolved_at: new Date().toISOString()
    })
    return { type: 'war_resolved', aborted: true }
  }

  const aScore = war.attacker_score
  const dScore = war.defender_score

  let winner = null
  let loser = null

  if (aScore > dScore) {
    winner = attacker
    loser = defender
  } else if (dScore > aScore) {
    winner = defender
    loser = attacker
  }

  /* Update territory */
  let territory = null
  if (winner && war.territory_id) {
    territory = updateTerritoryOwner(war.territory_id, winner.id)
  }

  /* Update faction records */
  if (winner) {
    db.prepare(`
      UPDATE vice_factions
      SET wars_won=wars_won+1, reputation=reputation+50, updated_at=?
      WHERE tenant_id=? AND id=?
    `).run(new Date().toISOString(), tenantId, winner.id)

    db.prepare(`
      UPDATE vice_factions
      SET wars_lost=wars_lost+1, reputation=MAX(0, reputation-25), updated_at=?
      WHERE tenant_id=? AND id=?
    `).run(new Date().toISOString(), tenantId, loser.id)
  }

  updateViceWar(tenantId, warId, {
    status: 'resolved',
    resolved_at: new Date().toISOString(),
    winner_faction_id: winner?.id || null
  })

  /* Award Aura to winner crew members */
  if (winner) {
    const members = getViceFactionMembers(tenantId, winner.id)
    for (const member of members) {
      const mChar = getViceCharacter(tenantId, groupId, member.jid)
      if (!mChar) continue

      updateViceCharacter(tenantId, groupId, member.jid, {
        aura: mChar.aura + 5
      })
    }
  }

  return {
    type: 'war_resolved',
    war: getViceWar(tenantId, warId),
    winner,
    loser,
    territory,
    attackerScore: aScore,
    defenderScore: dScore,
    isDraw: aScore === dScore
  }
}

export function warStatus(tenantId, groupId, jid) {
  const actorFac = getViceFactionForMember(tenantId, jid, groupId)
  if (!actorFac) return { error: 'You are not in a crew.' }

  const war = getActiveWarForFaction(tenantId, groupId, actorFac.id)
  if (!war) return { error: 'Your crew is not in an active war.' }

  const attacker = getViceFaction(tenantId, war.attacker_faction_id)
  const defender = getViceFaction(tenantId, war.defender_faction_id)
  const territory = war.territory_id ? getViceTerritory(war.territory_id) : null

  const participants = listWarParticipants(tenantId, war.id)

  const timeRemaining = Math.max(
    0,
    new Date(war.ends_at).getTime() - Date.now()
  )

  const hoursRemaining = Math.floor(timeRemaining / 3600000)
  const minutesRemaining = Math.floor((timeRemaining % 3600000) / 60000)

  return {
    war,
    attacker,
    defender,
    territory,
    participants,
    timeRemaining: { hours: hoursRemaining, minutes: minutesRemaining }
  }
}

/*
 * Auto-resolve any wars whose end time has passed.
 * Called lazily on read operations.
 */
export function autoResolveExpiredWars(tenantId, groupId) {
  const activeWars = listActiveWars(tenantId, groupId)
  const now = Date.now()
  const results = []

  for (const war of activeWars) {
    if (new Date(war.ends_at).getTime() <= now) {
      const result = resolveWar(tenantId, groupId, war.id)
      if (result.type === 'war_resolved') {
        results.push(result)
      }
    }
  }

  return results
}

/* -------------------------------------------------------------------------- */
/* VICE — crew invites                                                        */
/* -------------------------------------------------------------------------- */

export function inviteCrewMember(tenantId, groupId, actorJid, targetJid) {
  const faction = getViceFactionForMember(tenantId, actorJid, groupId)

  if (!faction) return { error: 'You are not in a crew.' }

  const roleRow = db.prepare(`
    SELECT role FROM vice_faction_members
    WHERE tenant_id=? AND faction_id=? AND jid=?
  `).get(tenantId, faction.id, actorJid)

  if (!roleRow || !['leader', 'officer'].includes(roleRow.role)) {
    return { error: 'Only leader or officers can invite.' }
  }

  const existing = getViceFactionForMember(tenantId, targetJid, groupId)
  if (existing) {
    return { error: `That user is already in *${existing.name}*.` }
  }

  const members = getViceFactionMembers(tenantId, faction.id)
  if (members.length >= CREW_MAX_MEMBERS) {
    return { error: `Crew is full (${CREW_MAX_MEMBERS}).` }
  }

  const timestamp = new Date().toISOString()

  db.prepare(`
    INSERT INTO vice_faction_members (tenant_id, faction_id, jid, role, joined_at)
    VALUES (?,?,?,?,?)
    ON CONFLICT(tenant_id, faction_id, jid) DO NOTHING
  `).run(tenantId, faction.id, targetJid, 'recruit', timestamp)

  return {
    type: 'crew_invite',
    faction,
    targetJid
  }
}

/* -------------------------------------------------------------------------- */
/* VICE — Aura tick                                                           */
/* -------------------------------------------------------------------------- */

/*
 * Lazy Aura tick. Called on `.vice` load. Grants Aura
 * from owned territories once per week per character.
 * Uses cooldowns_json to remember the last grant.
 */
export function tickAura(tenantId, groupId, jid) {
  const char = getViceCharacter(tenantId, groupId, jid)
  if (!char) return null

  const bonuses = getTerritoryBonuses(tenantId, groupId, jid)
  if (bonuses.auraPerWeek <= 0) return null

  const cooldowns = JSON.parse(char.cooldowns_json || '{}')
  const lastAura = cooldowns.last_aura_tick

  const WEEK_MS = 7 * 24 * 60 * 60 * 1000

  if (lastAura && Date.now() - new Date(lastAura).getTime() < WEEK_MS) {
    return null
  }

  cooldowns.last_aura_tick = new Date().toISOString()

  updateViceCharacter(tenantId, groupId, jid, {
    aura: char.aura + bonuses.auraPerWeek,
    cooldowns_json: JSON.stringify(cooldowns)
  })

  return { granted: bonuses.auraPerWeek }
}

/* -------------------------------------------------------------------------- */
/* VICE — missions                                                            */
/* -------------------------------------------------------------------------- */

export const MISSIONS_TIER_1 = [
  {
    id: 'm1_warmup',
    title: 'The Warm Up',
    brief: 'A fixer wants a package moved. Simple. No questions.',
    energy: 20,
    reward: { credits: [200, 400], xp: 30 },
    career: null
  },
  {
    id: 'm1_shakedown',
    title: 'Shakedown',
    brief: 'A shopkeeper owes money. Collect it, gently.',
    energy: 25,
    reward: { credits: [300, 550], xp: 40 },
    career: null
  },
  {
    id: 'm1_data',
    title: 'Data Haul',
    brief: 'Pull a drive from a corporate courier before the cops do.',
    energy: 30,
    reward: { credits: [400, 700], xp: 50 },
    career: 'hacker'
  },
  {
    id: 'm1_contract',
    title: 'First Contract',
    brief: 'A name, a location, a window. Make it clean.',
    energy: 35,
    reward: { credits: [500, 900], xp: 60 },
    career: 'assassin'
  },
  {
    id: 'm1_run',
    title: 'Midnight Run',
    brief: 'Cargo through three checkpoints. Don’t stop for anyone.',
    energy: 30,
    reward: { credits: [500, 950], xp: 55 },
    career: 'smuggler'
  }
]

export function listMissions(char) {
  return MISSIONS_TIER_1.map((m) => ({
    ...m,
    locked: m.career && char.career !== m.career
  }))
}

export function runMission(tenantId, groupId, jid, missionId) {
  const mission = MISSIONS_TIER_1.find((m) => m.id === missionId)
  if (!mission) return { error: `Unknown mission: ${missionId}` }

  const char = loadCharacter(tenantId, groupId, jid)
  if (!char) return { error: 'No character.' }

  const blocked = checkBlocked(char)
  if (blocked) return { error: blocked }

  if (mission.career && char.career !== mission.career) {
    return {
      error: `🔒 *${mission.title}* is locked to *${mission.career}* career.`
    }
  }

  if (char.energy < mission.energy) {
    return { error: `⚡ Needs ${mission.energy} energy. You have ${char.energy}.` }
  }

  const cooldowns = JSON.parse(char.cooldowns_json || '{}')
  const cdKey = `mission_${mission.id}`
  const last = cooldowns[cdKey]

  const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour per mission

  if (last && Date.now() - new Date(last).getTime() < COOLDOWN_MS) {
    const remain = Math.ceil(
      (COOLDOWN_MS - (Date.now() - new Date(last).getTime())) / 60000
    )
    return { error: `⏳ Mission locked for *${remain}m*.` }
  }

  /* Roll outcome */
  const success = Math.random() < 0.75

  if (!success) {
    updateViceCharacter(tenantId, groupId, jid, {
      energy: char.energy - mission.energy
    })

    cooldowns[cdKey] = new Date().toISOString()

    updateViceCharacter(tenantId, groupId, jid, {
      cooldowns_json: JSON.stringify(cooldowns)
    })

    return {
      type: 'mission_fail',
      mission,
      flavor: 'Wheels fell off the plan. You walked away with nothing.'
    }
  }

  const credits = rint(mission.reward.credits[0], mission.reward.credits[1])
  const xp = mission.reward.xp

  const bonuses = getTerritoryBonuses(tenantId, groupId, jid)
  const totalCredits = Math.floor(credits * bonuses.creditsMult)

  cooldowns[cdKey] = new Date().toISOString()

  updateViceCharacter(tenantId, groupId, jid, {
    credits: char.credits + totalCredits,
    energy: char.energy - mission.energy,
    cooldowns_json: JSON.stringify(cooldowns)
  })

  const xpResult = awardXP(tenantId, groupId, jid, xp)

  return {
    type: 'mission_success',
    mission,
    credits: totalCredits,
    xp,
    leveled: xpResult?.leveled || false,
    level: xpResult?.level || char.level
  }
}

/* -------------------------------------------------------------------------- */
/* VICE — seasons                                                             */
/* -------------------------------------------------------------------------- */

export function ensureSeason(tenantId, groupId) {
  let season = getActiveViceSeason(tenantId, groupId)

  if (season) {
    if (new Date(season.ends_at).getTime() <= Date.now()) {
      /* End season */
      db.prepare(`
        UPDATE vice_seasons SET ended=1 WHERE tenant_id=? AND id=?
      `).run(tenantId, season.id)

      season = null
    }
  }

  if (!season) {
    const next = db.prepare(`
      SELECT COALESCE(MAX(season_number), 0) + 1 AS n
      FROM vice_seasons WHERE tenant_id=? AND group_id=?
    `).get(tenantId, groupId).n

    season = createViceSeason(tenantId, groupId, next, 14)
  }

  return season
}

export function seasonStatus(tenantId, groupId) {
  const season = ensureSeason(tenantId, groupId)

  const timeLeft = Math.max(
    0,
    new Date(season.ends_at).getTime() - Date.now()
  )

  const days = Math.floor(timeLeft / 86400000)
  const hours = Math.floor((timeLeft % 86400000) / 3600000)

  const factions = listViceFactions(tenantId, groupId)

  const ranked = factions.map((f) => ({
    name: f.name,
    level: f.level,
    reputation: f.reputation,
    score: f.reputation + f.level * 100
  })).sort((a, b) => b.score - a.score)

  return {
    season,
    days,
    hours,
    ranked
  }
}

/* -------------------------------------------------------------------------- */
/* Faction lookup                                                             */
/* -------------------------------------------------------------------------- */

export function factionOf(tenantId, groupId, jid) {
  return getViceFactionForMember(tenantId, jid, groupId)
}