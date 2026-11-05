import crypto from 'node:crypto'
import {
  activeGame,
  createGame,
  getGame,
  updateGame,
  closeGames,
  touchMember,
  recordGameResult,
  queueAnonymous,
  popAnonymous,
  anonymousCount,
  setBoardMessageId
} from './db.mjs'

import {
  tictactoeBoard,
  connect4Board,
  slotReel,
  slotResult,
  wordleGrid,
  coinFlip
} from './graphics.mjs'

const VISUAL_GAMES = new Set([
  'tictactoe',
  'connect4',
  'slots',
  'wordle'
])

export async function playGameVisual(args) {
  /*
   * Run the standard playGame, which returns the game
   * state, then decide whether to attach a board image.
   */
  const result = await playGame(args)

  if (!result || result.error) return result

  if (!VISUAL_GAMES.has(result.type)) return result

  try {
    if (result.type === 'tictactoe' || result.type === 'connect4') {
      /* These two return a board array and turn info */
      return await buildBoardResponse(result, args)
    }

    if (result.type === 'slots') {
      return await buildSlotsResponse(result, args)
    }

    if (result.type === 'wordle') {
      return await buildWordleResponse(result, args)
    }
  } catch (error) {
    console.warn(
      `[X VISUAL] board build failed for ${result.type}:`,
      error?.message || error
    )
    /* Fall back to the text result so the game still plays */
    return result
  }

  return result
}

async function buildBoardResponse(result, args) {
  let image

  if (result.type === 'tictactoe') {
    /* result.board is an array of 9 cells: 'X', 'O', or null */
    /* result.turn is the current player's jid */
    /* result.winner (if any) and result.draw */

      image = await tictactoeBoard({
      cells: result.board.map((v) => {
        if (v === '❌') return 'X'
        if (v === '⭕') return 'O'
        return null
      }),
      currentTurn: args.playerJid === result.turn ? 'You' : 'Opponent',
      winner: result.winner === args.playerJid ? 'X' : result.winner ? 'O' : null,
      draw: !!result.draw
    })
  } else if (result.type === 'connect4') {
    /* result.board is a 6x7 2D array. Translate to single-letter tokens */
    const board = result.board.map((row) =>
      row.map((cell) => {
        if (cell === '🔴') return 'R'
        if (cell === '🟡') return 'Y'
        return null
      })
    )

    image = await connect4Board({
      board,
      currentTurn: args.playerJid === result.turn ? 'You' : 'Opponent',
      winner: result.winner === args.playerJid ? 'R' : result.winner ? 'Y' : null,
      draw: !!result.draw,
      lastDrop: null
    })
  }

  return {
    __board: true,
    type: result.type,
    image,
    reactions:
      result.type === 'tictactoe'
        ? ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣']
        : ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣'],
    text: result.winner
      ? result.winner === args.playerJid
        ? 'You won!'
        : 'You lost.'
      : result.draw
      ? 'Draw.'
      : result.turn === args.playerJid
      ? 'Your turn.'
      : 'Waiting for opponent.',
    mentions: [],
    result
  }
}

async function buildSlotsResponse(result, args) {
  /*
   * Slots is a two-image flow: spinning reel, then result.
   * Return the result card with a spinning marker, and let
   * the dispatcher handle the animation.
   */

  const symbols = result.reel || result.symbols || ['🍒', '🍋', '🍇']

  const spinningImage = await slotReel({
    symbols,
    spinning: true
  })

  const resultImage = await slotResult({
    symbols,
    net: result.net || 0,
    cost: result.cost || 20,
    winnings: result.winnings || 0
  })

  return {
    __board: true,
    type: 'slots',
    image: resultImage,
    spinningImage,
    reactions: [],
    text: result.prompt || '',
    mentions: [],
    result
  }
}

async function buildWordleResponse(result, args) {
  /*
   * wordle returns result.pattern (a string with emoji),
   * result.win, result.word, result.attempts.
   * We need the raw guesses + target from the game state.
   */

  const game = activeGame(args.tenantId, args.groupId, 'wordle')

  if (!game) return result

  const state = JSON.parse(game.state_json)

  /* state has { word, attempts } from the wordle function */
  /* We need to reconstruct guesses from something. The
     existing wordle() function doesn't store guesses, so
     board rendering will just show the current pattern. */

  /* Fallback: return the text result — proper guesses
     support comes in B3. */
  return result
}

const rng = (n) => crypto.randomInt(0, n)
const pick = (arr) => arr[rng(arr.length)]
const coin = () => rng(2) === 0

/* -------------------------------------------------------------------------- */
/* Content banks                                                              */
/* -------------------------------------------------------------------------- */

const TRUTHS = [
  'What is the most embarrassing thing you have ever done in public?',
  'Who in this group would you trust with your phone unlocked?',
  'What is the biggest lie you have told to get out of plans?',
  'What is your most irrational fear?',
  'Have you ever pretended to like a gift you hated?',
  'Who was your first crush?',
  'What is the most money you have spent on something useless?',
  'Have you ever cried at a movie? Which one?',
  'What is a secret you have never told anyone here?',
  'What is the pettiest reason you have stopped talking to someone?',
  'Describe your worst haircut.',
  'What is the last thing you searched on your phone?',
  'Who here would you swap lives with for a day?',
  'What is a habit you have that you would never admit in public?',
  'Have you ever stalked an ex on social media?',
  'What is the most childish thing you still do?',
  'What is your guilty pleasure song?',
  'Which group member would survive longest in a zombie apocalypse?',
  'What is the biggest risk you have ever taken?',
  'When was the last time you cried and why?'
]

const DARES = [
  'Send your last three emojis to the group with no context.',
  'Voice note the alphabet as fast as you can.',
  'Type your next message with your eyes closed.',
  'Post a selfie with the worst face you can make.',
  'Text the third person in your contacts "I know what you did."',
  'Say the alphabet backwards in a voice note.',
  'Change your WhatsApp status to something embarrassing for 10 minutes.',
  'Send a voice note singing the chorus of the last song you listened to.',
  'Reveal your most recent screenshot (blur if needed).',
  'Do 10 push-ups right now and voice-confirm.',
  'Describe the person above you in three words.',
  'Send a picture of the messiest part of your room.',
  'Use only emojis to describe your day.',
  'Voice note your best impression of a famous person.',
  'Send a 5-second video of you dancing with no music.',
  'Add a stranger you know only by name.',
  'Post the 5th photo in your gallery.',
  'Voice note a freestyle rap about the group.',
  'Compliment every active member in one message.',
  'Send your most-used emoji 20 times in a row.'
]

const WYR = [
  ['be invisible for a day', 'be able to fly for a day'],
  ['never use social media again', 'never watch a movie again'],
  ['eat only rice for a year', 'eat only beans for a year'],
  ['know when you will die', 'know how you will die'],
  ['date someone rich but boring', 'date someone poor but exciting'],
  ['lose your memory', 'lose your ability to speak'],
  ['live in the past', 'live in the future'],
  ['be the smartest person alive', 'be the funniest person alive'],
  ['always be 10 minutes late', 'always be 20 minutes early'],
  ['have a rewind button', 'have a pause button']
]

const NHIE = [
  'Never have I ever pretended to be sick to skip something.',
  'Never have I ever cried to get out of trouble.',
  'Never have I ever ghosted someone.',
  'Never have I ever lied about my age.',
  'Never have I ever fallen asleep in class or a meeting.',
  'Never have I ever stalked an ex.',
  'Never have I ever eaten food off the floor.',
  'Never have I ever broken something and blamed someone else.',
  'Never have I ever pretended to laugh at a joke I did not get.',
  'Never have I ever told a secret I promised to keep.'
]

const SCRAMBLE_WORDS = [
  'whatsapp', 'konnect', 'anime', 'galaxy', 'python',
  'diamond', 'rocket', 'mystery', 'trophy', 'legend',
  'cyber', 'blade', 'shadow', 'phoenix', 'thunder'
]

const TRIVIA = [
  ['What is the capital of Ghana?', ['Accra', 'Kumasi', 'Tamale', 'Cape Coast'], 0],
  ['Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Jupiter', 'Saturn'], 1],
  ['How many continents are there?', ['5', '6', '7', '8'], 2],
  ['Who wrote Romeo and Juliet?', ['Dickens', 'Shakespeare', 'Tolstoy', 'Hemingway'], 1],
  ['What is the largest ocean?', ['Atlantic', 'Indian', 'Arctic', 'Pacific'], 3],
  ['How many sides does a hexagon have?', ['5', '6', '7', '8'], 1],
  ['What is 12 x 12?', ['124', '132', '144', '154'], 2],
  ['Which country hosted the 2020 Olympics?', ['China', 'Japan', 'Brazil', 'UK'], 1],
  ['What does CPU stand for?', ['Central Process Unit', 'Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility'], 1],
  ['What is the smallest prime number?', ['0', '1', '2', '3'], 2]
]

const SLOT_EMOJIS = ['🍒', '🍋', '🍇', '⭐', '💎', '7️⃣']
const SLOT_PAYOUTS = {
  '💎💎💎': 50,
  '7️⃣7️⃣7️⃣': 30,
  '⭐⭐⭐': 20,
  '🍇🍇🍇': 10,
  '🍋🍋🍋': 8,
  '🍒🍒🍒': 5
}

/* -------------------------------------------------------------------------- */
/* Main dispatcher                                                            */
/* -------------------------------------------------------------------------- */

export function playGame({ tenantId, groupId, type, playerJid, choice, runtime, group, mentions }) {
  switch (type) {
    /* Classic */
    case 'coinflip':      return coinflip({ tenantId, groupId, playerJid, choice })
    case 'dice':          return dice({ tenantId, groupId, playerJid, choice })
    case 'rps':           return rps({ tenantId, groupId, playerJid, choice })
    case 'tictactoe':     return tictactoe({ tenantId, groupId, playerJid, move: choice })
    case 'connect4':      return connect4({ tenantId, groupId, playerJid, column: choice })
    case 'quiz':          return quiz({ tenantId, groupId, playerJid, answer: choice })
    case 'wordle':        return wordle({ tenantId, groupId, playerJid, guess: choice })
    case 'hangman':       return hangman({ tenantId, groupId, playerJid, guess: choice })

    /* New social */
    case 'truth':         return truth({ tenantId, groupId, playerJid, runtime, mentions })
    case 'dare':          return dare({ tenantId, groupId, playerJid, runtime, mentions })
    case 'wyr':           return wyr({ tenantId, groupId, playerJid })
    case 'nhie':          return nhie({ tenantId, groupId, playerJid })
    case 'trivia':        return trivia({ tenantId, groupId, playerJid, answer: choice })

    /* New competitive */
    case 'duel':          return duel({ tenantId, groupId, playerJid, runtime, mentions, group })
    case 'bet':           return bet({ tenantId, groupId, playerJid, choice })
    case 'slots':         return slots({ tenantId, groupId, playerJid })
    case 'scramble':      return scramble({ tenantId, groupId, playerJid, guess: choice })
    case 'number':        return guessNumber({ tenantId, groupId, playerJid, guess: choice })

    /* Anonymous */
    case 'confess':       return confess({ tenantId, groupId, playerJid, content: choice })
    case 'poll':          return poll({ tenantId, groupId, playerJid, runtime, group, mentions })
    case 'ship':          return ship({ tenantId, groupId, playerJid, runtime, mentions })
    case 'match':         return match({ tenantId, groupId, playerJid, runtime, mentions })
    case 'enemy':         return enemy({ tenantId, groupId, playerJid, runtime, mentions })
    case 'vs':            return vs({ tenantId, groupId, playerJid, runtime, mentions })
    case 'shipname':      return shipname({ tenantId, groupId, playerJid, runtime, mentions })

    default:
      throw new Error(`Unsupported game: ${type}`)
  }
}

/* -------------------------------------------------------------------------- */
/* Classic games                                                              */
/* -------------------------------------------------------------------------- */

function coinflip({ tenantId, groupId, playerJid, choice }) {
  const result = coin() ? 'heads' : 'tails'
  const pickValue = String(choice || '').toLowerCase()
  const wagered = pickValue === 'heads' || pickValue === 'tails'

  if (!wagered) {
    return { type: 'coinflip', result, choice: null, win: null }
  }

  const win = pickValue === result
  const delta = win ? { coins: 10, xp: 15, wins: 1 } : { coins: -5, xp: 5, losses: 1 }

  touchMember(tenantId, groupId, playerJid, delta)
  recordGameResult(tenantId, groupId, playerJid, 'coinflip', win ? 'win' : 'loss', win ? 10 : 0)

  return { type: 'coinflip', result, choice: pickValue, win }
}

function dice({ tenantId, groupId, playerJid, choice }) {
  const sides = Math.max(2, Math.min(100, Number(choice) || 6))
  const result = rng(sides) + 1

  touchMember(tenantId, groupId, playerJid, { coins: result, xp: result })
  recordGameResult(tenantId, groupId, playerJid, 'dice', 'win', result)

  return { type: 'dice', sides, result }
}

function rps({ tenantId, groupId, playerJid, choice }) {
  const options = ['rock', 'paper', 'scissors']
  const user = String(choice || '').toLowerCase()

  if (!options.includes(user)) {
    return { type: 'rps', error: 'Choose rock, paper, or scissors.' }
  }

  const bot = pick(options)
  const win = user === bot
    ? null
    : (user === 'rock' && bot === 'scissors') ||
      (user === 'paper' && bot === 'rock') ||
      (user === 'scissors' && bot === 'paper')

  touchMember(tenantId, groupId, playerJid, {
    coins: win === true ? 20 : win === false ? -5 : 5,
    xp: 10,
    wins: win === true ? 1 : 0,
    losses: win === false ? 1 : 0
  })

  recordGameResult(tenantId, groupId, playerJid, 'rps',
    win === true ? 'win' : win === false ? 'loss' : 'draw',
    win === true ? 20 : 0
  )

  return { type: 'rps', user, bot, win }
}

function tictactoe({ tenantId, groupId, playerJid, move }) {
  let game = activeGame(tenantId, groupId, 'tictactoe')
  if (!game) {
    game = createGame(tenantId, {
      groupId,
      type: 'tictactoe',
      createdBy: playerJid,
      state: {
        board: Array(9).fill(null),
        players: [playerJid],
        turn: playerJid,
        symbols: { [playerJid]: '❌' }
      }
    })
  }

  const state = JSON.parse(game.state_json)

  if (!state.players.includes(playerJid)) {
    if (state.players.length >= 2) {
      return { type: 'tictactoe', error: 'This game already has two players.' }
    }
    state.players.push(playerJid)
    state.symbols[playerJid] = '⭕'
  }

  const index = Number(move)
  if (!Number.isInteger(index) || index < 1 || index > 9 || state.board[index - 1]) {
    return { type: 'tictactoe', error: 'Move must be an empty square from 1 to 9.' }
  }

  if (state.turn !== playerJid) {
    return { type: 'tictactoe', error: 'It is not your turn.' }
  }

  state.board[index - 1] = state.symbols[playerJid]
  const winner = checkWinner(state.board)

  if (winner) {
    updateGame(tenantId, game.id, state, 'closed')
    touchMember(tenantId, groupId, playerJid, { coins: 50, xp: 40, wins: 1 })
    recordGameResult(tenantId, groupId, playerJid, 'tictactoe', 'win', 50)
    return { type: 'tictactoe', board: state.board, winner: playerJid }
  }

  if (state.board.every(Boolean)) {
    updateGame(tenantId, game.id, state, 'closed')
    recordGameResult(tenantId, groupId, playerJid, 'tictactoe', 'draw', 0)
    return { type: 'tictactoe', board: state.board, draw: true }
  }

  state.turn = state.players.find((p) => p !== playerJid) || playerJid
  updateGame(tenantId, game.id, state, 'active')

  return { type: 'tictactoe', board: state.board, turn: state.turn }
}

function checkWinner(b) {
  return [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ].some(([a, c, d]) => b[a] && b[a] === b[c] && b[a] === b[d])
}

function connect4({ tenantId, groupId, playerJid, column }) {
  let game = activeGame(tenantId, groupId, 'connect4')
  if (!game) {
    game = createGame(tenantId, {
      groupId,
      type: 'connect4',
      createdBy: playerJid,
      state: {
        board: Array.from({ length: 6 }, () => Array(7).fill(null)),
        players: [playerJid],
        turn: playerJid,
        symbols: { [playerJid]: '🔴' }
      }
    })
  }

  const s = JSON.parse(game.state_json)

  if (!s.players.includes(playerJid)) {
    if (s.players.length >= 2) {
      return { type: 'connect4', error: 'This game already has two players.' }
    }
    s.players.push(playerJid)
    s.symbols[playerJid] = '🟡'
  }

  if (s.turn !== playerJid) {
    return { type: 'connect4', error: 'It is not your turn.' }
  }

  const c = Number(column) - 1
  if (c < 0 || c > 6 || !Number.isInteger(c)) {
    return { type: 'connect4', error: 'Choose a column from 1 to 7.' }
  }

  let r = -1
  for (let i = 5; i >= 0; i--) {
    if (!s.board[i][c]) { r = i; break }
  }

  if (r < 0) return { type: 'connect4', error: 'That column is full.' }

  s.board[r][c] = s.symbols[playerJid]
  const winner = connectWinner(s.board, r, c)

  if (winner) {
    updateGame(tenantId, game.id, s, 'closed')
    touchMember(tenantId, groupId, playerJid, { coins: 100, xp: 80, wins: 1 })
    recordGameResult(tenantId, groupId, playerJid, 'connect4', 'win', 100)
    return { type: 'connect4', board: s.board, winner: playerJid }
  }

  if (s.board.flat().every(Boolean)) {
    updateGame(tenantId, game.id, s, 'closed')
    recordGameResult(tenantId, groupId, playerJid, 'connect4', 'draw', 0)
    return { type: 'connect4', board: s.board, draw: true }
  }

  s.turn = s.players.find((p) => p !== playerJid) || playerJid
  updateGame(tenantId, game.id, s)

  return { type: 'connect4', board: s.board, turn: s.turn }
}

function connectWinner(b, r, c) {
  const v = b[r][c]
  for (const [dr, dc] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    let n = 1
    for (const q of [1, -1]) {
      let rr = r + dr * q, cc = c + dc * q
      while (rr >= 0 && rr < 6 && cc >= 0 && cc < 7 && b[rr][cc] === v) {
        n++; rr += dr * q; cc += dc * q
      }
    }
    if (n >= 4) return true
  }
  return false
}

const QUIZ_BANK = [
  ['What is the capital of Ghana?', 'accra'],
  ['What planet is known as the Red Planet?', 'mars'],
  ['How many sides does a hexagon have?', '6'],
  ['What is 2 + 2?', '4'],
  ['Which ocean is the largest?', 'pacific']
]

function quiz({ tenantId, groupId, playerJid, answer }) {
  let game = activeGame(tenantId, groupId, 'quiz')

  if (!game) {
    const q = pick(QUIZ_BANK)
    game = createGame(tenantId, {
      groupId,
      type: 'quiz',
      createdBy: playerJid,
      state: { question: q[0], answer: q[1] }
    })
    return { type: 'quiz', question: q[0], prompt: 'Reply with .quiz <answer>' }
  }

  const s = JSON.parse(game.state_json)
  const correct = String(answer || '').trim().toLowerCase() === s.answer

  if (correct) {
    updateGame(tenantId, game.id, s, 'closed')
    touchMember(tenantId, groupId, playerJid, { coins: 30, xp: 30, wins: 1 })
    recordGameResult(tenantId, groupId, playerJid, 'quiz', 'win', 30)
    return { type: 'quiz', correct, answer: s.answer, reward: 30 }
  }

  return { type: 'quiz', correct: false, question: s.question }
}

const WORDLE_WORDS = [
  'planet', 'whatsapp', 'konnect', 'anime', 'school',
  'galaxy', 'python', 'teacher', 'diamond', 'rocket'
]

function wordle({ tenantId, groupId, playerJid, guess }) {
  let game = activeGame(tenantId, groupId, 'wordle')

  if (!game) {
    const word = pick(WORDLE_WORDS)
    game = createGame(tenantId, {
      groupId,
      type: 'wordle',
      createdBy: playerJid,
      state: { word, attempts: 0 }
    })
    return { type: 'wordle', prompt: 'Guess a 5–8 letter word with .wordle <guess>' }
  }

  const s = JSON.parse(game.state_json)
  const g = String(guess || '').toLowerCase()

  if (g.length !== s.word.length) {
    return { type: 'wordle', error: `Guess must be ${s.word.length} letters.` }
  }

  s.attempts++

  if (g === s.word) {
    updateGame(tenantId, game.id, s, 'closed')
    touchMember(tenantId, groupId, playerJid, { coins: 60, xp: 50, wins: 1 })
    recordGameResult(tenantId, groupId, playerJid, 'wordle', 'win', 60)
    return { type: 'wordle', win: true, word: s.word, attempts: s.attempts }
  }

  updateGame(tenantId, game.id, s, s.attempts >= 6 ? 'closed' : 'active')

  return {
    type: 'wordle',
    win: false,
    attempts: s.attempts,
    pattern: wordlePattern(s.word, g),
    word: s.attempts >= 6 ? s.word : null
  }
}

function wordlePattern(word, guess) {
  return [...guess].map((c, i) =>
    c === word[i] ? `🟩${c}` : word.includes(c) ? `🟨${c}` : `⬛${c}`
  ).join(' ')
}

const HANGMAN_WORDS = [
  'developer', 'teacher', 'whatsapp', 'konnect', 'javascript',
  'cyberpunk', 'trophy', 'legendary', 'phoenix', 'shadow'
]

function hangman({ tenantId, groupId, playerJid, guess }) {
  let game = activeGame(tenantId, groupId, 'hangman')

  if (!game) {
    const word = pick(HANGMAN_WORDS)
    game = createGame(tenantId, {
      groupId,
      type: 'hangman',
      createdBy: playerJid,
      state: { word, guessed: [], misses: 0 }
    })
    return { type: 'hangman', display: maskWord(word, []), prompt: 'Guess a letter with .hangman <letter>' }
  }

  const s = JSON.parse(game.state_json)
  const g = String(guess || '').toLowerCase().slice(0, 1)

  if (!/^[a-z]$/.test(g)) {
    return { type: 'hangman', error: 'Enter one letter.' }
  }

  if (!s.guessed.includes(g)) {
    s.guessed.push(g)
    if (!s.word.includes(g)) s.misses++
  }

  const display = maskWord(s.word, s.guessed)
  const win = !display.includes('_')

  if (win || s.misses >= 6) {
    updateGame(tenantId, game.id, s, 'closed')
    if (win) {
      touchMember(tenantId, groupId, playerJid, { coins: 50, xp: 40, wins: 1 })
      recordGameResult(tenantId, groupId, playerJid, 'hangman', 'win', 50)
    }
    return { type: 'hangman', display, win, word: s.word, misses: s.misses }
  }

  updateGame(tenantId, game.id, s, 'active')
  return { type: 'hangman', display, misses: s.misses }
}

function maskWord(w, g) {
  return [...w].map((c) => (g.includes(c) ? c : '＿')).join(' ')
}

/* -------------------------------------------------------------------------- */
/* Social games                                                               */
/* -------------------------------------------------------------------------- */

function truth({ tenantId, groupId, playerJid, runtime, mentions }) {
  const target = mentions?.[0] || playerJid
  const question = pick(TRUTHS)

  return {
    type: 'truth',
    target,
    question,
    prompt: [
      '🎭 *TRUTH OR DARE — TRUTH*',
      '',
      `Question for ${runtime?.getMemberDisplayName?.(groupId, target, 'you') || 'you'}:`,
      '',
      `❝ ${question} ❞`,
      '',
      'They must answer. No skipping.'
    ].join('\n')
  }
}

function dare({ tenantId, groupId, playerJid, runtime, mentions }) {
  const target = mentions?.[0] || playerJid
  const challenge = pick(DARES)

  return {
    type: 'dare',
    target,
    challenge,
    prompt: [
      '🎭 *TRUTH OR DARE — DARE*',
      '',
      `Challenge for ${runtime?.getMemberDisplayName?.(groupId, target, 'you') || 'you'}:`,
      '',
      `🔥 ${challenge}`,
      '',
      'Execute within 5 minutes or forfeit 50 KC.'
    ].join('\n')
  }
}

function wyr({ tenantId, groupId, playerJid }) {
  const pair = pick(WYR)

  return {
    type: 'wyr',
    options: pair,
    prompt: [
      '⚖️ *WOULD YOU RATHER?*',
      '',
      `🅰️ ${pair[0]}`,
      '',
      '─── VS ───',
      '',
      `🅱️ ${pair[1]}`,
      '',
      'Reply `.wyr a` or `.wyr b`'
    ].join('\n')
  }
}

function nhie({ tenantId, groupId, playerJid }) {
  const statement = pick(NHIE)

  return {
    type: 'nhie',
    statement,
    prompt: [
      '🙈 *NEVER HAVE I EVER*',
      '',
      statement,
      '',
      'Everyone who HAS done it reacts with 🖐️.',
      'No lying. The group is watching.'
    ].join('\n')
  }
}

function trivia({ tenantId, groupId, playerJid, answer }) {
  let game = activeGame(tenantId, groupId, 'trivia')

  if (!game) {
    const q = pick(TRIVIA)
    game = createGame(tenantId, {
      groupId,
      type: 'trivia',
      createdBy: playerJid,
      state: {
        question: q[0],
        options: q[1],
        answerIndex: q[2],
        startedAt: Date.now()
      }
    })

    const letters = ['🅰️', '🅱️', '🅲', '🅳']
    return {
      type: 'trivia',
      question: q[0],
      options: q[1],
      prompt: [
        '🧠 *TRIVIA*',
        '',
        `❓ ${q[0]}`,
        '',
        ...q[1].map((opt, i) => `${letters[i]} ${opt}`),
        '',
        'Reply `.trivia a|b|c|d`'
      ].join('\n')
    }
  }

  const s = JSON.parse(game.state_json)
  const picked = String(answer || '').trim().toLowerCase()
  const map = { a: 0, b: 1, c: 2, d: 3 }
  const idx = map[picked]

  if (idx === undefined) {
    return { type: 'trivia', error: 'Reply with a, b, c, or d.' }
  }

  if (idx === s.answerIndex) {
    updateGame(tenantId, game.id, s, 'closed')
    touchMember(tenantId, groupId, playerJid, { coins: 40, xp: 35, wins: 1 })
    recordGameResult(tenantId, groupId, playerJid, 'trivia', 'win', 40)
    return {
      type: 'trivia',
      correct: true,
      answer: s.options[s.answerIndex],
      reward: 40
    }
  }

  updateGame(tenantId, game.id, s, 'closed')
  recordGameResult(tenantId, groupId, playerJid, 'trivia', 'loss', 0)
  return {
    type: 'trivia',
    correct: false,
    answer: s.options[s.answerIndex]
  }
}

/* -------------------------------------------------------------------------- */
/* Competitive games                                                          */
/* -------------------------------------------------------------------------- */

function duel({ tenantId, groupId, playerJid, runtime, mentions, group }) {
  const opponent = mentions?.[0]

  if (!opponent) {
    return { type: 'duel', error: 'Mention someone to duel. Usage: `.duel @user`' }
  }

  if (opponent === playerJid) {
    return { type: 'duel', error: 'You cannot duel yourself.' }
  }

  const attackerRoll = rng(100) + 1
  const defenderRoll = rng(100) + 1

  const attackerName = runtime?.getMemberDisplayName?.(groupId, playerJid, 'You') || 'You'
  const defenderName = runtime?.getMemberDisplayName?.(groupId, opponent, 'Opponent') || 'Opponent'

  const attackerWins = attackerRoll > defenderRoll
  const tie = attackerRoll === defenderRoll

  if (!tie) {
    const winner = attackerWins ? playerJid : opponent
    const loser = attackerWins ? opponent : playerJid

    touchMember(tenantId, groupId, winner, { coins: 30, xp: 25, wins: 1 })
    touchMember(tenantId, groupId, loser, { coins: -15, xp: 5, losses: 1 })
    recordGameResult(tenantId, groupId, winner, 'duel', 'win', 30)
    recordGameResult(tenantId, groupId, loser, 'duel', 'loss', 0)
  }

  return {
    type: 'duel',
    attacker: playerJid,
    defender: opponent,
    attackerRoll,
    defenderRoll,
    winner: tie ? null : (attackerWins ? playerJid : opponent),
    prompt: [
      '⚔️ *DUEL*',
      '',
      `🗡️ ${attackerName} → rolled *${attackerRoll}*`,
      `🛡️ ${defenderName} → rolled *${defenderRoll}*`,
      '',
      tie
        ? '🤝 A perfect clash. No winner.'
        : `🏆 *${attackerWins ? attackerName : defenderName}* wins the duel!`,
      '',
      tie ? '' : 'Winner: +30 KC · Loser: −15 KC'
    ].filter(Boolean).join('\n')
  }
}

function bet({ tenantId, groupId, playerJid, choice }) {
  const parts = String(choice || '').trim().split(/\s+/)

  if (parts.length < 2) {
    return { type: 'bet', error: 'Usage: `.bet <amount> <heads|tails>`' }
  }

  const amount = Math.floor(Number(parts[0]))
  const side = parts[1].toLowerCase()

  if (!Number.isFinite(amount) || amount < 10) {
    return { type: 'bet', error: 'Minimum bet is 10 KC.' }
  }

  if (side !== 'heads' && side !== 'tails') {
    return { type: 'bet', error: 'Pick heads or tails.' }
  }

  const member = touchMember(tenantId, groupId, playerJid, {})
  if (!member) {
    return { type: 'bet', error: 'Member not synchronized.' }
  }

  if (member.coins < amount) {
    return { type: 'bet', error: `You only have ${member.coins} KC.` }
  }

  const result = coin() ? 'heads' : 'tails'
  const win = result === side
  const payout = win ? amount : -amount

  touchMember(tenantId, groupId, playerJid, { coins: payout, xp: Math.floor(amount / 5) })
  recordGameResult(tenantId, groupId, playerJid, 'bet', win ? 'win' : 'loss', win ? amount : 0)

  return {
    type: 'bet',
    amount,
    side,
    result,
    win,
    prompt: [
      '🎰 *BET*',
      '',
      `You bet *${amount} KC* on *${side}*.`,
      `Result: 🪙 *${result.toUpperCase()}*`,
      '',
      win
        ? `✅ You win *+${amount} KC*`
        : `❌ You lose *−${amount} KC*`
    ].join('\n')
  }
}

function slots({ tenantId, groupId, playerJid }) {
  const cost = 20
  const member = touchMember(tenantId, groupId, playerJid, {})

  if (!member) return { type: 'slots', error: 'Member not synchronized.' }
  if (member.coins < cost) return { type: 'slots', error: `Slots cost ${cost} KC. You have ${member.coins}.` }

  const reel = [pick(SLOT_EMOJIS), pick(SLOT_EMOJIS), pick(SLOT_EMOJIS)]
  const combo = reel.join('')
  const payout = SLOT_PAYOUTS[combo] || 0

  let winnings = payout
  if (payout === 0) {
    // Partial matches pay smaller
    if (reel[0] === reel[1] || reel[1] === reel[2] || reel[0] === reel[2]) {
      winnings = 5
    }
  }

  const net = winnings - cost
  touchMember(tenantId, groupId, playerJid, { coins: net, xp: winnings > 0 ? 10 : 3 })
  recordGameResult(tenantId, groupId, playerJid, 'slots', net > 0 ? 'win' : net < 0 ? 'loss' : 'draw', Math.max(0, net))

  return {
    type: 'slots',
    reel,
    combo,
    cost,
    winnings,
    net,
    prompt: [
      '🎰 *SLOT MACHINE*',
      '',
      `┌─────────────┐`,
      `│  ${reel[0]}  ${reel[1]}  ${reel[2]}  │`,
      `└─────────────┘`,
      '',
      net > 0
        ? `🎉 *JACKPOT!* You won *+${net} KC*`
        : net === 0
          ? `😐 Broke even. You got *${winnings} KC* back.`
          : `💀 You lost *${Math.abs(net)} KC*.`,
    ].join('\n')
  }
}

function scramble({ tenantId, groupId, playerJid, guess }) {
  let game = activeGame(tenantId, groupId, 'scramble')

  if (!game) {
    const word = pick(SCRAMBLE_WORDS)
    const scrambled = shuffleWord(word)
    game = createGame(tenantId, {
      groupId,
      type: 'scramble',
      createdBy: playerJid,
      state: { word, scrambled, attempts: 0 }
    })

    return {
      type: 'scramble',
      scrambled,
      prompt: [
        '🔤 *WORD SCRAMBLE*',
        '',
        `Unscramble: *${scrambled.toUpperCase()}*`,
        '',
        'Reply `.scramble <word>`'
      ].join('\n')
    }
  }

  const s = JSON.parse(game.state_json)
  const attempt = String(guess || '').trim().toLowerCase()

  if (attempt === s.word) {
    updateGame(tenantId, game.id, s, 'closed')
    const reward = 40
    touchMember(tenantId, groupId, playerJid, { coins: reward, xp: 30, wins: 1 })
    recordGameResult(tenantId, groupId, playerJid, 'scramble', 'win', reward)
    return {
      type: 'scramble',
      correct: true,
      word: s.word,
      reward,
      prompt: `✅ *${s.word}* — correct! +${reward} KC`
    }
  }

  s.attempts++

  if (s.attempts >= 3) {
    updateGame(tenantId, game.id, s, 'closed')
    recordGameResult(tenantId, groupId, playerJid, 'scramble', 'loss', 0)
    return {
      type: 'scramble',
      correct: false,
      word: s.word,
      prompt: `❌ Out of attempts. The word was *${s.word}*.`
    }
  }

  updateGame(tenantId, game.id, s, 'active')
  return {
    type: 'scramble',
    correct: false,
    attemptsLeft: 3 - s.attempts,
    prompt: `❌ Wrong. ${3 - s.attempts} attempt(s) left.`
  }
}

function shuffleWord(word) {
  const arr = [...word]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = rng(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr.join('')
}

function guessNumber({ tenantId, groupId, playerJid, guess }) {
  let game = activeGame(tenantId, groupId, 'number')

  if (!game) {
    const target = rng(100) + 1
    game = createGame(tenantId, {
      groupId,
      type: 'number',
      createdBy: playerJid,
      state: { target, attempts: 0, guesses: [] }
    })

    return {
      type: 'number',
      prompt: [
        '🔢 *GUESS THE NUMBER*',
        '',
        'I picked a number between 1 and 100.',
        'You have 7 attempts.',
        '',
        'Reply `.number <guess>`'
      ].join('\n')
    }
  }

  const s = JSON.parse(game.state_json)
  const n = Math.floor(Number(guess))

  if (!Number.isFinite(n) || n < 1 || n > 100) {
    return { type: 'number', error: 'Pick a number between 1 and 100.' }
  }

  s.attempts++
  s.guesses.push(n)

  if (n === s.target) {
    updateGame(tenantId, game.id, s, 'closed')
    const reward = Math.max(20, 100 - (s.attempts - 1) * 10)
    touchMember(tenantId, groupId, playerJid, { coins: reward, xp: 40, wins: 1 })
    recordGameResult(tenantId, groupId, playerJid, 'number', 'win', reward)
    return {
      type: 'number',
      correct: true,
      target: s.target,
      attempts: s.attempts,
      reward,
      prompt: `🎯 *${s.target}* — correct in ${s.attempts} attempt(s)! +${reward} KC`
    }
  }

  if (s.attempts >= 7) {
    updateGame(tenantId, game.id, s, 'closed')
    recordGameResult(tenantId, groupId, playerJid, 'number', 'loss', 0)
    return {
      type: 'number',
      correct: false,
      target: s.target,
      prompt: `❌ Out of attempts. The number was *${s.target}*.`
    }
  }

  updateGame(tenantId, game.id, s, 'active')
  return {
    type: 'number',
    correct: false,
    hint: n < s.target ? '📈 Higher' : '📉 Lower',
    attemptsLeft: 7 - s.attempts,
    prompt: `${n < s.target ? '📈 Higher' : '📉 Lower'} — ${7 - s.attempts} attempt(s) left.`
  }
}

/* -------------------------------------------------------------------------- */
/* Anonymous games                                                            */
/* -------------------------------------------------------------------------- */

function confess({ tenantId, groupId, playerJid, content }) {
  const text = String(content || '').trim()

  if (!text) {
    return {
      type: 'confess',
      error: [
        'Usage: `.confess <secret>`',
        '',
        'Your identity is never revealed. The bot masks it.'
      ].join('\n')
    }
  }

  if (text.length > 500) {
    return { type: 'confess', error: 'Keep confessions under 500 characters.' }
  }

  queueAnonymous(tenantId, groupId, playerJid, 'confession', text)

  return {
    type: 'confess',
    prompt: '🤫 Confession queued. An admin can broadcast with `.reveal` — your name will not appear.'
  }
}

function poll({ tenantId, groupId, playerJid, runtime, group, mentions }) {
  const question = 'Who is most likely to...'

  return {
    type: 'poll',
    prompt: [
      '📊 *ANONYMOUS POLL*',
      '',
      'Voting is done by reacting to the next message.',
      '',
      'Use `.pollstart <question>` to open one. Admins only.'
    ].join('\n')
  }
}

function ship({ tenantId, groupId, playerJid, runtime, mentions }) {
  const list = Array.isArray(mentions) ? mentions.filter(Boolean) : []

  let a, b

  if (list.length >= 2) {
    // Two users tagged — ship those two, ignore the sender
    a = list[0]
    b = list[1]
  } else if (list.length === 1) {
    // One user tagged — ship sender with them
    a = playerJid
    b = list[0]
  } else {
    return {
      type: 'ship',
      error: [
        '💘 *SHIP METER*',
        '',
        'Usage:',
        '  `.ship @user`            — ship yourself with them',
        '  `.ship @user1 @user2`    — ship two other people',
        '',
        'Tag one or two users.'
      ].join('\n')
    }
  }

  if (a === b) {
    return { type: 'ship', error: 'You cannot ship the same person twice.' }
  }

  /*
   * Deterministic hash from the sorted pair — same two
   * people always get the same percentage, which is how
   * these meters are supposed to behave.
   */
  const seed = [a, b].sort().join('|')
  let hash = 0
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) % 100

  const percent = Math.max(7, Math.min(100, (hash * 7 + 13) % 101))

  const nameA = runtime?.getMemberDisplayName?.(groupId, a, 'User A') || 'User A'
  const nameB = runtime?.getMemberDisplayName?.(groupId, b, 'User B') || 'User B'

  const verdict =
    percent >= 90 ? '💞 Soulmates' :
    percent >= 75 ? '💖 Perfect match' :
    percent >= 50 ? '💕 Strong vibe' :
    percent >= 30 ? '💛 Worth a try' :
    percent >= 15 ? '🤔 Questionable' :
    '💔 Run.'

  const filled = Math.round(percent / 10)
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled)

  const selfShip = a === playerJid || b === playerJid

  return {
    type: 'ship',
    a, b, percent,
    prompt: [
      '💘 *SHIP METER*',
      '',
      `${nameA}  ×  ${nameB}`,
      '',
      `${bar}  ${percent}%`,
      '',
      verdict,
      '',
      selfShip
        ? '_(tag two users to ship them instead of yourself)_'
        : '_(shipped by a third party)_'
    ].join('\n')
  }
}

/* -------------------------------------------------------------------------- */
/* Match / Enemy / VS / Shipname                                              */
/* -------------------------------------------------------------------------- */

/*
 * Shared helper: resolve the two target JIDs from mentions.
 * Returns { a, b } or an error string.
 */
function resolvePair(playerJid, mentions, opts = {}) {
  const {
    selfLabel = 'yourself',
    usageOne = '.cmd @user            — include yourself',
    usageTwo = '.cmd @user1 @user2    — pick two others'
  } = opts

  const list = Array.isArray(mentions) ? mentions.filter(Boolean) : []

  let a, b

  if (list.length >= 2) {
    a = list[0]
    b = list[1]
  } else if (list.length === 1) {
    a = playerJid
    b = list[0]
  } else {
    return { error: ['Usage:', usageOne, usageTwo].join('\n') }
  }

  if (a === b) {
    return { error: 'You cannot target the same person twice.' }
  }

  return { a, b }
}

/*
 * Deterministic hash. Same pair always gets the same
 * number, so these meters don't flip every refresh.
 */
function pairHash(a, b, salt = '') {
  const seed = [a, b].sort().join('|') + salt
  let hash = 0
  for (const c of seed) {
    hash = (hash * 31 + c.charCodeAt(0)) % 100000
  }
  return hash
}

function meterBar(percent, size = 10) {
  const filled = Math.round(percent / (100 / size))
  return '█'.repeat(filled) + '░'.repeat(size - filled)
}

function match({ tenantId, groupId, playerJid, runtime, mentions }) {
  const pair = resolvePair(playerJid, mentions, {
    usageOne: '  `.match @user`            — match yourself with them',
    usageTwo: '  `.match @user1 @user2`    — match two other people'
  })

  if (pair.error) return { type: 'match', error: pair.error }

  const { a, b } = pair
  const percent = Math.max(5, Math.min(100, (pairHash(a, b, 'match') * 7 + 19) % 101))

  const nameA = runtime?.getMemberDisplayName?.(groupId, a, 'User A') || 'User A'
  const nameB = runtime?.getMemberDisplayName?.(groupId, b, 'User B') || 'User B'

  const verdict =
    percent >= 90 ? '💞 Perfect Match' :
    percent >= 75 ? '💖 Great Match' :
    percent >= 50 ? '💕 Decent Match' :
    percent >= 30 ? '💛 Some Potential' :
    percent >= 15 ? '🤔 Low Match' :
    '❌ Not Compatible'

  const selfTag = a === playerJid || b === playerJid

  return {
    type: 'match',
    a, b, percent,
    prompt: [
      '💘 *MATCH METER*',
      '',
      `┌────────────────────┐`,
      `│  ${nameA}`,
      `│  ×`,
      `│  ${nameB}`,
      `└────────────────────┘`,
      '',
      `Compatibility:  ${meterBar(percent)}  ${percent}%`,
      '',
      verdict,
      '',
      selfTag
        ? '_(tag two users to match others instead of yourself)_'
        : '_(matched by a third party)_'
    ].join('\n')
  }
}

function enemy({ tenantId, groupId, playerJid, runtime, mentions }) {
  const pair = resolvePair(playerJid, mentions, {
    usageOne: '  `.enemy @user`            — rate your rivalry with them',
    usageTwo: '  `.enemy @user1 @user2`    — rate two other people'
  })

  if (pair.error) return { type: 'enemy', error: pair.error }

  const { a, b } = pair

  // Independent seed so it's not just the inverse of match
  const percent = Math.max(5, Math.min(100, (pairHash(a, b, 'enemy') * 11 + 7) % 101))

  const nameA = runtime?.getMemberDisplayName?.(groupId, a, 'User A') || 'User A'
  const nameB = runtime?.getMemberDisplayName?.(groupId, b, 'User B') || 'User B'

  const verdict =
    percent >= 90 ? '💀 Mortal Enemies' :
    percent >= 75 ? '⚔️ Sworn Rivals' :
    percent >= 50 ? '😠 Heated Beef' :
    percent >= 30 ? '😒 Petty Friction' :
    percent >= 15 ? '😐 Mild Tension' :
    '🕊️ Basically Friends'

  const selfTag = a === playerJid || b === playerJid

  return {
    type: 'enemy',
    a, b, percent,
    prompt: [
      '⚔️ *ENEMY METER*',
      '',
      `┌────────────────────┐`,
      `│  ${nameA}`,
      `│  ⚡`,
      `│  ${nameB}`,
      `└────────────────────┘`,
      '',
      `Rivalry:  ${meterBar(percent)}  ${percent}%`,
      '',
      verdict,
      '',
      selfTag
        ? '_(tag two users to compare others)_'
        : '_(rated by a third party)_'
    ].join('\n')
  }
}

function vs({ tenantId, groupId, playerJid, runtime, mentions }) {
  const pair = resolvePair(playerJid, mentions, {
    usageOne: '  `.vs @user`            — face off against them',
    usageTwo: '  `.vs @user1 @user2`    — pit two others against each other'
  })

  if (pair.error) return { type: 'vs', error: pair.error }

  const { a, b } = pair

  const nameA = runtime?.getMemberDisplayName?.(groupId, a, 'User A') || 'User A'
  const nameB = runtime?.getMemberDisplayName?.(groupId, b, 'User B') || 'User B'

  // Independent rolls per side
  const powerA = Math.max(20, Math.min(999, (pairHash(a, b, 'vsA') * 3 + 137) % 980))
  const powerB = Math.max(20, Math.min(999, (pairHash(a, b, 'vsB') * 5 + 251) % 980))

  const winner = powerA === powerB
    ? null
    : powerA > powerB ? a : b

  const winnerName = winner === a ? nameA : winner === b ? nameB : null

  const flavor =
    powerA === powerB
      ? '🤝 *STALEMATE* — equal power, no victor.'
      : powerA > powerB
        ? `⚡ *${nameA}* dominates the arena.`
        : `⚡ *${nameB}* dominates the arena.`

  const selfTag = a === playerJid || b === playerJid

  return {
    type: 'vs',
    a, b, powerA, powerB, winner,
    prompt: [
      '🥊 *VERSUS*',
      '',
      `⚔️  ${nameA}`,
      `    Power: ${powerA}`,
      '',
      `        V S`,
      '',
      `🛡️  ${nameB}`,
      `    Power: ${powerB}`,
      '',
      '━━━━━━━━━━━━━━━━━━━',
      flavor,
      winnerName ? `🏆 Winner: *${winnerName}*` : '',
      '━━━━━━━━━━━━━━━━━━━',
      '',
      selfTag
        ? '_(tag two users to battle others)_'
        : '_(arranged by a third party)_'
    ].filter(Boolean).join('\n')
  }
}

function shipname({ tenantId, groupId, playerJid, runtime, mentions }) {
  const pair = resolvePair(playerJid, mentions, {
    usageOne: '  `.shipname @user`            — name your ship with them',
    usageTwo: '  `.shipname @user1 @user2`    — name a ship for two others'
  })

  if (pair.error) return { type: 'shipname', error: pair.error }

  const { a, b } = pair

  const rawA = (runtime?.getMemberDisplayName?.(groupId, a, 'A') || 'A').split(/\s+/)[0]
  const rawB = (runtime?.getMemberDisplayName?.(groupId, b, 'B') || 'B').split(/\s+/)[0]

  const combo = makePortmanteau(rawA, rawB)

  const percent = Math.max(5, Math.min(100, (pairHash(a, b, 'shipname') * 7 + 19) % 101))

  const selfTag = a === playerJid || b === playerJid

  return {
    type: 'shipname',
    a, b, combo, percent,
    prompt: [
      '💕 *SHIP NAME GENERATOR*',
      '',
      `  ${rawA}  +  ${rawB}`,
      '',
      `  ➜  *${combo}*`,
      '',
      `Compatibility:  ${meterBar(percent)}  ${percent}%`,
      '',
      selfTag
        ? '_(tag two users to name their ship)_'
        : '_(named by a third party)_'
    ].join('\n')
  }
}

/*
 * Portmanteau generator. Splits each name roughly in
 * half and glues the fronts together.
 */
function makePortmanteau(a, b) {
  const clean = (s) => String(s || '').replace(/[^a-zA-Z]/g, '') || 'X'

  const A = clean(a)
  const B = clean(b)

  if (A.length < 2 || B.length < 2) {
    return A + B
  }

  const cutA = Math.max(1, Math.ceil(A.length / 2))
  const cutB = Math.max(1, Math.ceil(B.length / 2))

  const head = A.slice(0, cutA)
  const tail = B.slice(B.length - cutB)

  const combo = (head + tail).replace(/\s+/g, '')

  return combo.charAt(0).toUpperCase() + combo.slice(1)
}

/* -------------------------------------------------------------------------- */
/* Anonymous broadcast helpers                                                */
/* -------------------------------------------------------------------------- */

export function peekAnonymous(tenantId, groupId) {
  return anonymousCount(tenantId, groupId)
}

export function revealAnonymous(tenantId, groupId) {
  const row = popAnonymous(tenantId, groupId)
  if (!row) return null

  return {
    kind: row.kind,
    content: row.content,
    target: row.target_jid
  }
}