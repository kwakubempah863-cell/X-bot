/* -------------------------------------------------------------------------- */
/* Action registry — META-backed with optional giffycdn enrichment            */
/* -------------------------------------------------------------------------- */

const GIFFY_INDEX_URL =
  'https://raw.githubusercontent.com/iceefruit/giffycdn/main/index.json'

const DEFAULT_BASE =
  'https://raw.githubusercontent.com/iceefruit/giffycdn/main'

/*
 * Cached registry. Populated on first call to getActions().
 */
let _registry = null

/*
 * Verb + emoji for every registered action category.
 * Template: "{sender} {verb} {target} {emoji}"
 */
const META = {
  airkiss:     { verb: 'blows a kiss to',        emoji: '😘' },
  angrystare:  { verb: 'stares angrily at',      emoji: '😤' },
  bite:        { verb: 'bites',                  emoji: '🦷' },
  bleh:        { verb: 'sticks tongue out at',   emoji: '😝' },
  brofist:     { verb: 'brofists',               emoji: '🤜' },
  celebrate:   { verb: 'celebrates with',        emoji: '🎉' },
  cheers:      { verb: 'cheers with',            emoji: '🥂' },
  clap:        { verb: 'claps for',              emoji: '👏' },
  confused:    { verb: 'is confused by',         emoji: '😕' },
  cool:        { verb: 'gives a cool nod to',    emoji: '😎' },
  cry:         { verb: 'cries with',             emoji: '😭' },
  cuddle:      { verb: 'cuddles',                emoji: '🥰' },
  dance:       { verb: 'dances with',            emoji: '💃' },
  drool:       { verb: 'drools over',            emoji: '🤤' },
  evillaugh:   { verb: 'laughs evilly at',       emoji: '😈' },
  facepalm:    { verb: 'facepalms at',           emoji: '🤦' },
  handhold:    { verb: 'holds hands with',       emoji: '🤝' },
  happy:       { verb: 'is happy with',          emoji: '😊' },
  headbang:    { verb: 'headbangs with',         emoji: '🤘' },
  hug:         { verb: 'hugs',                   emoji: '🤗' },
  kiss:        { verb: 'kisses',                 emoji: '💋' },
  laugh:       { verb: 'laughs with',            emoji: '😂' },
  lick:        { verb: 'licks',                  emoji: '👅' },
  love:        { verb: 'loves',                  emoji: '❤️' },
  mad:         { verb: 'is mad at',              emoji: '😠' },
  nervous:     { verb: 'is nervous around',      emoji: '😰' },
  nom:         { verb: 'noms on',                emoji: '🍽️' },
  nuzzle:      { verb: 'nuzzles',                emoji: '🥺' },
  nyah:        { verb: 'teases',                 emoji: '😼' },
  pat:         { verb: 'pats',                   emoji: '👋' },
  peek:        { verb: 'peeks at',               emoji: '👀' },
  pinch:       { verb: 'pinches',                emoji: '🤏' },
  poke:        { verb: 'pokes',                  emoji: '👉' },
  pout:        { verb: 'pouts at',               emoji: '😾' },
  punch:       { verb: 'punches',                emoji: '👊' },
  sad:         { verb: 'is sad for',             emoji: '😢' },
  scared:      { verb: 'is scared of',           emoji: '😨' },
  shout:       { verb: 'shouts at',              emoji: '📢' },
  shrug:       { verb: 'shrugs at',              emoji: '🤷' },
  shy:         { verb: 'is shy around',          emoji: '😳' },
  sigh:        { verb: 'sighs at',               emoji: '😮‍💨' },
  sip:         { verb: 'sips with',              emoji: '☕' },
  slap:        { verb: 'slaps',                  emoji: '👋' },
  sleep:       { verb: 'sleeps beside',          emoji: '😴' },
  slowclap:    { verb: 'slowly claps for',       emoji: '👏' },
  smack:       { verb: 'smacks',                 emoji: '💥' },
  smile:       { verb: 'smiles at',              emoji: '😊' },
  sneeze:      { verb: 'sneezes on',             emoji: '🤧' },
  sorry:       { verb: 'apologizes to',          emoji: '🙏' },
  stare:       { verb: 'stares at',              emoji: '👁️' },
  surprised:   { verb: 'is surprised by',        emoji: '😲' },
  sweat:       { verb: 'sweats at',              emoji: '💧' },
  thumbsup:    { verb: 'gives a thumbs up to',   emoji: '👍' },
  tickle:      { verb: 'tickles',                emoji: '🤣' },
  tired:       { verb: 'is tired with',          emoji: '😩' },
  wave:        { verb: 'waves at',               emoji: '👋' },
  wink:        { verb: 'winks at',               emoji: '😉' },
  woah:        { verb: 'is amazed by',           emoji: '🤩' },
  yawn:        { verb: 'yawns at',               emoji: '🥱' },
  yay:         { verb: 'cheers for',             emoji: '🙌' },
  yes:         { verb: 'agrees with',               emoji: '✅' },
  annoy:       { verb: 'annoys',                    emoji: '😤' },
  bother:      { verb: 'bothers',                   emoji: '🪰' },
  poke2:       { verb: 'pokes',                     emoji: '👉' },
  prod:        { verb: 'prods',                     emoji: '🫵' },
  nudge:       { verb: 'nudges',                    emoji: '🤏' },
  interrupt:   { verb: 'interrupts',                emoji: '🛑' },
  nag:         { verb: 'nags',                      emoji: '😾' },
  pester:      { verb: 'pesters',                   emoji: '🐝' },
  tease2:      { verb: 'teases',                    emoji: '😼' },
  sass:        { verb: 'sasses',                    emoji: '💅' },
  marry:       { verb: 'marries',                   emoji: '💍' },
  wed:         { verb: 'weds',                      emoji: '👰' },
  propose2:    { verb: 'proposes to',               emoji: '💐' },
  kiss2:       { verb: 'kisses',                    emoji: '💋' },
  smooch:      { verb: 'smooches',                  emoji: '💋' },
  flirt2:      { verb: 'flirts with',               emoji: '😘' },
  blush:       { verb: 'blushes at',                emoji: '😳' },
  hug2:        { verb: 'hugs',                      emoji: '🤗' },
  cuddle2:     { verb: 'cuddles',                   emoji: '🥰' },
  snuggle2:    { verb: 'snuggles',                  emoji: '💞' },
  holdhands:   { verb: 'holds hands with',          emoji: '🤝' },
  date2:       { verb: 'goes on a date with',       emoji: '🌹' },
  serenade:    { verb: 'serenades',                 emoji: '🎶' },
  simp:        { verb: 'simps for',                 emoji: '🥺' },
  cry2:        { verb: 'cries at',                  emoji: '😭' },
  sob:         { verb: 'sobs over',                 emoji: '😢' },
  laugh2:      { verb: 'laughs at',                 emoji: '🤣' },
  giggle:      { verb: 'giggles at',                emoji: '🤭' },
  smirk:       { verb: 'smirks at',                 emoji: '😏' },
  rage:        { verb: 'rages at',                  emoji: '😡' },
  fume:        { verb: 'fumes at',                  emoji: '💢' },
  sulk:        { verb: 'sulks at',                  emoji: '😒' },
  pout2:       { verb: 'pouts at',                  emoji: '😤' },
  scream2:     { verb: 'screams at',                emoji: '😱' },
  yawn2:       { verb: 'yawns at',                  emoji: '🥱' },
  sigh2:       { verb: 'sighs at',                  emoji: '😮‍💨' },
  shrug2:      { verb: 'shrugs at',                 emoji: '🤷' },
  facepalm2:   { verb: 'facepalms at',              emoji: '🤦' },
  thumbsdown:  { verb: 'gives a thumbs down to',    emoji: '👎' },
  thumbsup2:   { verb: 'gives a thumbs up to',      emoji: '👍' },
  salute2:     { verb: 'salutes',                   emoji: '🫡' },
  bow2:        { verb: 'bows to',                   emoji: '🙇' },
  praise:      { verb: 'praises',                   emoji: '🙌' },
  feed2:       { verb: 'feeds',                     emoji: '🍜' },
  cook:        { verb: 'cooks for',                 emoji: '🍳' },
  eat3:        { verb: 'eats with',                 emoji: '🍽️' },
  drink2:      { verb: 'drinks with',               emoji: '🥤' },
  cheers2:     { verb: 'cheers with',               emoji: '🍻' },
  toast:       { verb: 'toasts with',               emoji: '🥂' },
  share:       { verb: 'shares food with',          emoji: '🍱' },
  dance3:      { verb: 'dances with',               emoji: '💃' },
  sing2:       { verb: 'sings to',                  emoji: '🎤' },
  sleep2:      { verb: 'sleeps beside',             emoji: '😴' },
  wakeup2:     { verb: 'wakes',                     emoji: '⏰' },
  stretch:     { verb: 'stretches with',            emoji: '🤸' },
  pose:        { verb: 'poses with',                emoji: '💁' },
  flex:        { verb: 'flexes on',                 emoji: '💪' },
  spin:        { verb: 'spins',                     emoji: '🌀' },
  roll:        { verb: 'rolls toward',              emoji: '🎳' },
  cartwheel:   { verb: 'cartwheels for',            emoji: '🤸' },
  backflip:    { verb: 'backflips over',            emoji: '🤸' },
  stare2:      { verb: 'stares at',                 emoji: '👁️' },
  judge:       { verb: 'judges',                    emoji: '⚖️' },
  haunt:       { verb: 'haunts',                    emoji: '👻' },
  possess:     { verb: 'possesses',                 emoji: '👹' },
  summon2:     { verb: 'summons against',           emoji: '🔮' },
  banish:      { verb: 'banishes',                  emoji: '🌫️' },
  hex:         { verb: 'hexes',                     emoji: '🧿' },
  bless:       { verb: 'blesses',                   emoji: '✨' }
}

const FALLBACK_QUERIES = {
  airkiss: 'anime blowing a kiss',
  angrystare: 'anime angry stare',
  brofist: 'anime brofist',
  evillaugh: 'anime evil laugh',
  handhold: 'anime holding hands',
  headbang: 'anime headbanging',
  slowclap: 'anime slow clap',
  surprised: 'anime surprised reaction',
  annoy: 'anime annoyed',
  bother: 'anime bothering',
  poke2: 'anime poke',
  prod: 'anime nudge',
  nudge: 'anime nudge',
  interrupt: 'anime interruption',
  nag: 'anime nagging',
  pester: 'anime pestering',
  tease2: 'anime teasing',
  marry: 'anime wedding',
  wed: 'anime wedding',
  propose2: 'anime proposal',
  kiss2: 'anime kiss',
  smooch: 'anime smooch',
  flirt2: 'anime flirting',
  blush: 'anime blush',
  hug2: 'anime hug',
  cuddle2: 'anime cuddle',
  snuggle2: 'anime snuggle',
  holdhands: 'anime holding hands',
  date2: 'anime date',
  serenade: 'anime serenade',
  simp: 'anime simp',
  cry2: 'anime crying',
  sob: 'anime sobbing',
  laugh2: 'anime laughing',
  giggle: 'anime giggle',
  smirk: 'anime smirk',
  rage: 'anime rage',
  fume: 'anime fuming',
  sulk: 'anime sulking',
  pout2: 'anime pout',
  scream2: 'anime screaming',
  yawn2: 'anime yawn',
  sigh2: 'anime sigh',
  shrug2: 'anime shrug',
  facepalm2: 'anime facepalm',
  thumbsdown: 'anime thumbs down',
  thumbsup2: 'anime thumbs up',
  salute2: 'anime salute',
  bow2: 'anime bow',
  praise: 'anime praise',
  feed2: 'anime feeding',
  cook: 'anime cooking',
  eat3: 'anime eating together',
  drink2: 'anime drinking',
  cheers2: 'anime cheers',
  toast: 'anime toast',
  share: 'anime sharing food',
  dance3: 'anime dance',
  sing2: 'anime singing',
  sleep2: 'anime sleeping together',
  wakeup2: 'anime waking up',
  stretch: 'anime stretching',
  pose: 'anime pose',
  flex: 'anime flex',
  spin: 'anime spin',
  roll: 'anime rolling',
  cartwheel: 'anime cartwheel',
  backflip: 'anime backflip',
  stare2: 'anime staring',
  judge: 'anime judging',
  haunt: 'anime ghost haunting',
  possess: 'anime possession',
  summon2: 'anime summoning',
  banish: 'anime banishing',
  hex: 'anime hex',
  bless: 'anime blessing'
}

export const GIF_FALLBACKS = Object.fromEntries(
  Object.keys(META).map((category) => [
    category,
    FALLBACK_QUERIES[category] || `anime ${category}`
  ])
)

export function buildGifChain(action) {
  const candidates = []
  const giffy = giffyUrl(action)

  candidates.push({
    source: 'giffycdn',
    url: giffy,
    category: action?.category || action?.name
  })

  if (action?.name) {
    candidates.push({
      source: 'nekos',
      category: action.name,
      dynamic: true
    })
  }

  const query =
    GIF_FALLBACKS[action?.name] ||
    `anime ${action?.name || 'action'}`
  candidates.push({ source: 'giphy', query })

  candidates.push({
    source: 'placeholder',
    url:
      `https://placehold.co/480x270/1a1a1a/ffffff?text=` +
      encodeURIComponent(action?.name || 'anime')
  })

  return candidates
}

function fallbackMeta(category) {
  return { verb: `${category}s`, emoji: '🎬' }
}

/*
 * Fetch the giffycdn index once and build the action list.
 * Returns { name, verb, emoji, category, count, baseUrl, selfOnly }.
 */
export async function getActions() {
  if (_registry) return _registry

  const actions = Object.entries(META).map(([name, meta]) => ({
    name,
    verb: meta.verb,
    emoji: meta.emoji,
    category: name,
    count: 0,
    baseUrl: DEFAULT_BASE,
    nekos: null,
    selfOnly: false
  }))

  let index = null
  try {
    const res = await fetch(GIFFY_INDEX_URL, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    })

    if (res.ok) {
      index = await res.json()
    } else {
      console.warn(
        `[X ACTIONS] giffycdn index returned ${res.status}, using META only.`
      )
    }
  } catch (error) {
    console.warn(
      '[X ACTIONS] giffycdn index fetch failed, using META only:',
      error?.message || error
    )
  }

  if (index) {
    const categories = index?.categories || {}
    const baseUrl = index?.base_url || DEFAULT_BASE
    const byName = new Map(actions.map((action) => [action.name, action]))

    for (const [category, count] of Object.entries(categories)) {
      if (byName.has(category)) {
        const entry = byName.get(category)
        entry.category = category
        entry.count = Number(count) || 0
        entry.baseUrl = baseUrl
      } else {
        const meta = fallbackMeta(category)
        const entry = {
          name: category,
          verb: meta.verb,
          emoji: meta.emoji,
          category,
          count: Number(count) || 0,
          baseUrl,
          nekos: null,
          selfOnly: false
        }
        actions.push(entry)
        byName.set(category, entry)
      }
    }
  }

  _registry = actions

  console.log(
    `[X ACTIONS] Loaded ${actions.length} categories ` +
    `(${index ? 'META + giffycdn' : 'META only'}).`
  )

  return actions
}

/*
 * Build a random GIF URL for a giffycdn-backed action.
 * Returns null if the action lacks category/count metadata
 * (i.e. it came from the fallback list).
 */
export function giffyUrl(action) {
  if (!action?.category) return null
  if (!action?.count || action.count <= 0) return null

  const base = action.baseUrl || DEFAULT_BASE
  const n = Math.floor(Math.random() * action.count) + 1

  return `${base}/${action.category}/${n}.gif`
}