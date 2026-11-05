// server/movies.mjs
// Movie request engine — search, metadata, resolution pick, delivery.
//
// Metadata: TMDb (free API key) with OMDb fallback.
// Stream sources: Tubi / Plex / Internet Archive / JustWatch fallback.
// Downloads: yt-dlp on a provider URL — capped by size, capped by ToS.

import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'

/* -------------------------------------------------------------------------- */
/* Config                                                                     */
/* -------------------------------------------------------------------------- */

const TMDB_KEY =
  process.env.TMDB_API_KEY || ''

const OMDB_KEY =
  process.env.OMDB_API_KEY || ''

const TMP_ROOT =
  process.env.X_MOVIE_TMP_DIR ||
  path.join('data', 'tmp', 'movies')

const MAX_MB =
  Number(process.env.X_MOVIE_MAX_MB || 90)

const DOWNLOAD_TIMEOUT_MS =
  Number(process.env.X_MOVIE_TIMEOUT_MS || 600000)

const YTDLP_BIN =
  process.env.X_MOVIE_YTDLP_BIN ||
  (process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')

const MOVIE_TTL_MS =
  Number(process.env.X_MOVIE_SESSION_TTL_MS || 5 * 60 * 1000)

await fsp.mkdir(TMP_ROOT, { recursive: true })

/* -------------------------------------------------------------------------- */
/* In-memory pending sessions                                                 */
/* -------------------------------------------------------------------------- */

/*
 * Keyed by `${groupId}:${senderJid}`. Holds the movie metadata
 * so when the user picks a resolution we know what to fetch.
 */
const pendingMovies = new Map()

export function setPendingMovie(groupId, senderJid, payload) {
  const key = `${groupId}:${senderJid}`

  pendingMovies.set(key, {
    ...payload,
    createdAt: Date.now()
  })

  setTimeout(() => {
    const cur = pendingMovies.get(key)
    if (cur && Date.now() - cur.createdAt >= MOVIE_TTL_MS) {
      pendingMovies.delete(key)
    }
  }, MOVIE_TTL_MS)
}

export function getPendingMovie(groupId, senderJid) {
  const key = `${groupId}:${senderJid}`
  const row = pendingMovies.get(key)

  if (!row) return null

  if (Date.now() - row.createdAt > MOVIE_TTL_MS) {
    pendingMovies.delete(key)
    return null
  }

  return row
}

export function clearPendingMovie(groupId, senderJid) {
  pendingMovies.delete(`${groupId}:${senderJid}`)
}

/* -------------------------------------------------------------------------- */
/* Metadata — TMDb first, OMDb fallback                                       */
/* -------------------------------------------------------------------------- */

async function tmdbFetch(urlPath, params = {}) {
  if (!TMDB_KEY) return null

  const url = new URL(`https://api.themoviedb.org/3${urlPath}`)
  url.searchParams.set('api_key', TMDB_KEY)

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    })

    if (!res.ok) return null

    return res.json()
  } catch {
    return null
  }
}

async function omdbFetch(params = {}) {
  if (!OMDB_KEY) return null

  const url = new URL('https://www.omdbapi.com/')
  url.searchParams.set('apikey', OMDB_KEY)

  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }

  try {
    const res = await fetch(url.toString(), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    })

    if (!res.ok) return null

    return res.json()
  } catch {
    return null
  }
}

/* iTunes Search — no API key needed, best fallback */
async function itunesSearch(query) {
  const url =
    `https://itunes.apple.com/search?` +
    `term=${encodeURIComponent(query)}&media=movie&limit=5`

  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(10000)
    })

    if (!res.ok) return null

    const data = await res.json()
    return data?.results || []
  } catch {
    return null
  }
}

/*
 * Main search — returns a normalized result object.
 * Always tries TMDb, then OMDb, then iTunes.
 */
export async function searchMovie(query) {
  const q = String(query || '').trim()

  if (!q) throw new Error('Movie title required.')

  /* -------------------------------------------
   * TMDb path
   * ----------------------------------------- */
  if (TMDB_KEY) {
    const search = await tmdbFetch('/search/movie', {
      query: q,
      include_adult: 'false'
    })

    const first = search?.results?.[0]

    if (first?.id) {
      const details = await tmdbFetch(`/movie/${first.id}`, {
        append_to_response: 'credits,external_ids,videos,watch/providers'
      })

      const d = details || first

      const poster = d.poster_path
        ? `https://image.tmdb.org/t/p/w500${d.poster_path}`
        : null

      const backdrop = d.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${d.backdrop_path}`
        : null

      /* Trailer from videos */
      const trailer = (d.videos?.results || [])
        .find(v => v.site === 'YouTube' && v.type === 'Trailer')

      /* Streaming providers */
      const providers =
        d['watch/providers']?.results?.US?.flatrate ||
        d['watch/providers']?.results?.GB?.flatrate ||
        []

      return {
        source: 'tmdb',
        id: d.id,
        imdbId: d.imdb_id || d.external_ids?.imdb_id || null,
        title: d.title,
        year: (d.release_date || '').slice(0, 4) || null,
        rating: d.vote_average || null,
        runtime: d.runtime || null,
        genres: (d.genres || []).map(g => g.name).join(', ') || null,
        overview: d.overview || null,
        tagline: d.tagline || null,
        poster,
        backdrop,
        trailerUrl: trailer
          ? `https://www.youtube.com/watch?v=${trailer.key}`
          : null,
        providers: providers.map(p => ({
          name: p.provider_name,
          logo: p.logo_path
            ? `https://image.tmdb.org/t/p/w92${p.logo_path}`
            : null
        })),
        /* Archive search hint */
        archiveQuery: `${d.title} ${(d.release_date || '').slice(0, 4)}`
      }
    }
  }

  /* -------------------------------------------
   * OMDb path
   * ----------------------------------------- */
  if (OMDB_KEY) {
    const d = await omdbFetch({ t: q, plot: 'full' })

    if (d && d.Response !== 'False' && d.Title) {
      return {
        source: 'omdb',
        id: d.imdbID,
        imdbId: d.imdbID,
        title: d.Title,
        year: d.Year,
        rating: parseFloat(d.imdbRating) || null,
        runtime: parseInt(d.Runtime, 10) || null,
        genres: d.Genre || null,
        overview: d.Plot || null,
        tagline: null,
        poster: d.Poster && d.Poster !== 'N/A' ? d.Poster : null,
        backdrop: null,
        trailerUrl: null,
        providers: [],
        archiveQuery: `${d.Title} ${d.Year}`
      }
    }
  }

  /* -------------------------------------------
   * iTunes fallback
   * ----------------------------------------- */
  const itunes = await itunesSearch(q)
  const first = itunes?.[0]

  if (first) {
    return {
      source: 'itunes',
      id: first.trackId,
      imdbId: null,
      title: first.trackName,
      year: (first.releaseDate || '').slice(0, 4) || null,
      rating: null,
      runtime:
        first.trackTimeMillis
          ? Math.round(first.trackTimeMillis / 60000)
          : null,
      genres: first.primaryGenreName || null,
      overview: first.longDescription || first.shortDescription || null,
      tagline: null,
      poster: first.artworkUrl100
        ? first.artworkUrl100.replace('100x100', '600x600')
        : null,
      backdrop: null,
      trailerUrl: first.previewUrl || null,
      providers: [],
      archiveQuery: `${first.trackName} ${(first.releaseDate || '').slice(0, 4)}`
    }
  }

  throw new Error('MOVIE_NOT_FOUND')
}

/* -------------------------------------------------------------------------- */
/* Streaming sources — Internet Archive (public domain)                       */
/* -------------------------------------------------------------------------- */

async function archiveSearch(query) {
  const url =
    `https://archive.org/advancedsearch.php?` +
    `q=${encodeURIComponent(query + ' AND mediatype:movies')}` +
    `&fl[]=identifier&fl[]=title&fl[]=year&fl[]=description` +
    `&rows=5&output=json`

  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    })

    if (!res.ok) return []

    const data = await res.json()
    const docs = data?.response?.docs || []

    return docs.map(doc => ({
      identifier: doc.identifier,
      title: doc.title,
      year: doc.year || null,
      description: doc.description || null,
      streamUrl: `https://archive.org/details/${doc.identifier}`,
      downloadUrl: `https://archive.org/download/${doc.identifier}`,
      poster: `https://archive.org/services/img/${doc.identifier}`
    }))
  } catch {
    return []
  }
}

/* -------------------------------------------------------------------------- */
/* Resolve the actual playable file URL from an archive.org item              */
/* -------------------------------------------------------------------------- */

/*
 * Archive.org items are folders. The /details/ and /download/ URLs
 * point at the folder. The actual MP4/OGG lives at:
 *
 *   https://archive.org/download/<identifier>/<filename>
 *
 * We hit the metadata endpoint, pick the best video file, and
 * return its direct URL — the one that opens in a browser and plays.
 */
export async function resolveArchiveFile(identifier) {
  if (!identifier) return null

  try {
    const res = await fetch(
      `https://archive.org/metadata/${encodeURIComponent(identifier)}`,
      { signal: AbortSignal.timeout(10000) }
    )

    if (!res.ok) return null

    const data = await res.json()
    const files = data?.files || []

    /*
     * Prefer MP4 (plays in every browser), then OGV, then MKV.
     * Skip thumbnails, metadata sidecars, and previews.
     */
    const videoFiles = files.filter(f => {
      const name = String(f.name || '').toLowerCase()

      if (!name) return false
      if (name.includes('_thumb')) return false
      if (name.includes('__ia_thumb')) return false
      if (name.endsWith('.xml')) return false
      if (name.endsWith('.json')) return false
      if (name.endsWith('.sqlite')) return false
      if (name.endsWith('.gz')) return false
      if (name.endsWith('.torrent')) return false

      return (
        name.endsWith('.mp4') ||
        name.endsWith('.ogv') ||
        name.endsWith('.mkv') ||
        name.endsWith('.webm') ||
        name.endsWith('.m4v')
      )
    })

    if (!videoFiles.length) return null

    const pickBest = () => {
      const score = (f) => {
        const name = String(f.name || '').toLowerCase()
        if (name.endsWith('.mp4')) return 5
        if (name.endsWith('.webm')) return 4
        if (name.endsWith('.m4v')) return 4
        if (name.endsWith('.ogv')) return 3
        if (name.endsWith('.mkv')) return 2
        return 1
      }

      return videoFiles.sort((a, b) => {
        const diff = score(b) - score(a)
        if (diff !== 0) return diff
        return (Number(b.size) || 0) - (Number(a.size) || 0)
      })[0]
    }

    const best = pickBest()

    const fileUrl =
      `https://archive.org/download/` +
      `${encodeURIComponent(identifier)}/` +
      `${encodeURIComponent(best.name)}`

    return {
      url: fileUrl,
      fileName: best.name,
      sizeBytes: Number(best.size) || null,
      format: String(best.format || '').toLowerCase() || null
    }
  } catch (error) {
    console.warn(
      '[X MOVIE] archive metadata fetch failed:',
      error?.message || error
    )
    return null
  }
}

/* -------------------------------------------------------------------------- */
/* Resolution picker                                                          */
/* -------------------------------------------------------------------------- */

/*
 * Returns the resolution menu the user sees after .movie <title>.
 * For previews, we present stream sources rather than true
 * quality tiers — public-domain archives rarely expose clean
 * 480p/720p/1080p separates. When the user picks "download",
 * yt-dlp will choose the best format under the size cap.
 */
export function buildResolutionMenu(movie, archiveHits) {
  const lines = [
    '🎬 *SELECT RESOLUTION*',
    '',
    `*${movie.title}*${movie.year ? ` (${movie.year})` : ''}`,
    ''
  ]

  if (!archiveHits.length) {
    lines.push('📡 *Stream / where to watch*')
    lines.push('')

    if (movie.trailerUrl) {
      lines.push(`▸ *1* — Watch trailer`)
      lines.push(`   ${movie.trailerUrl}`)
    }

    if (movie.providers.length) {
      for (const p of movie.providers) {
        lines.push(`▸ ${p.name}`)
      }
    }

    lines.push('')
    lines.push('_No direct download source found._')
    lines.push('_Reply with a number or `.movie cancel`._')

    return lines.join('\n')
  }

  lines.push('▸ *Available sources*')
  lines.push('')

  archiveHits.forEach((hit, i) => {
    const id = i + 1
    const year = hit.year ? ` · ${hit.year}` : ''
    lines.push(`▸ *${id}* — ${hit.title}${year}`)
    lines.push(`   📥 Archive.org (public domain)`)
    lines.push(`   🔗 ${hit.streamUrl}`)
    lines.push('')
  })

  lines.push(`▸ *D* — Download best available (max ${MAX_MB} MB)`)
  lines.push(`▸ *T* — Watch trailer`)
  lines.push('')
  lines.push('_Reply with your choice, or `.movie cancel`._')

  return lines.join('\n')
}

/* -------------------------------------------------------------------------- */
/* Download                                                                   */
/* -------------------------------------------------------------------------- */

function runYtdlp(args, { timeoutMs = DOWNLOAD_TIMEOUT_MS } = {}) {
  return new Promise((resolve, reject) => {
    let finished = false
    let stdout = ''
    let stderr = ''

    const child = spawn(YTDLP_BIN, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    const timer = setTimeout(() => {
      if (finished) return
      finished = true
      try { child.kill('SIGKILL') } catch {}
      reject(new Error('DOWNLOAD_TIMEOUT'))
    }, timeoutMs)

    child.stdout.on('data', (c) => { stdout += c.toString() })
    child.stderr.on('data', (c) => { stderr += c.toString() })

    child.on('error', (err) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      reject(err)
    })

    child.on('close', (code) => {
      if (finished) return
      finished = true
      clearTimeout(timer)

      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        const e = new Error('YTDLP_FAILED')
        e.stderr = stderr
        reject(e)
      }
    })
  })
}

/*
 * Download a movie from a provider URL.
 * Format cap keeps output under MAX_MB where possible.
 * Returns { buffer, fileName, mimetype, sizeMb }.
 */
export async function downloadMovie(movie, sourceUrl) {
  const stamp = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`
  const baseName =
    `${movie.title || 'movie'}`
      .replace(/[^\w\s-]/g, '')
      .trim()
      .slice(0, 60) || 'movie'

  const outTemplate =
    path.join(TMP_ROOT, `${stamp}_${baseName}.%(ext)s`)

  const args = [
    '--no-warnings',
    '--no-playlist',
    '--ignore-config',
    '--no-check-certificates',
    '--retries', '5',
    '--fragment-retries', '5',
    '--socket-timeout', '30',

    /* Cap file size — kill the download if it exceeds MAX_MB */
    '--max-filesize', `${MAX_MB}M`,

    /* Prefer MP4 ≤ 720p so it plays everywhere */
    '-f',
    `bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[ext=mp4]/best`,

    '--merge-output-format', 'mp4',
    '-o', outTemplate,
    '--',
    sourceUrl
  ]

  try {
    await runYtdlp(args)
  } catch (error) {
    const stderr = String(error?.stderr || '')

    if (/larger than max-filesize|File is larger/i.test(stderr)) {
      const e = new Error('FILE_TOO_LARGE')
      e.code = 'FILE_TOO_LARGE'
      throw e
    }

    if (/timeout|timed out/i.test(stderr)) {
      const e = new Error('DOWNLOAD_TIMEOUT')
      e.code = 'DOWNLOAD_TIMEOUT'
      throw e
    }

    const e = new Error('MOVIE_UNAVAILABLE')
    e.code = 'MOVIE_UNAVAILABLE'
    e.stderr = stderr
    throw e
  }

  const files = await fsp.readdir(TMP_ROOT)
  const match = files.find(f => f.startsWith(`${stamp}_`))

  if (!match) {
    const e = new Error('EMPTY_OUTPUT')
    e.code = 'EMPTY_OUTPUT'
    throw e
  }

  const filePath = path.join(TMP_ROOT, match)

  const stat = await fsp.stat(filePath)

  if (stat.size > MAX_MB * 1024 * 1024) {
    await fsp.unlink(filePath).catch(() => {})
    const e = new Error('FILE_TOO_LARGE')
    e.code = 'FILE_TOO_LARGE'
    throw e
  }

  const buffer = await fsp.readFile(filePath)

  return {
    buffer,
    fileName: `${baseName}.mp4`,
    mimetype: 'video/mp4',
    sizeMb: +(stat.size / 1048576).toFixed(1),
    cleanup: () => fsp.unlink(filePath).catch(() => {})
  }
}

/* -------------------------------------------------------------------------- */
/* Archive search accessor                                                    */
/* -------------------------------------------------------------------------- */

export async function findMovieSources(movie) {
  const q = movie.archiveQuery || movie.title
  const hits = await archiveSearch(q)

  if (!hits.length) return []

  /*
   * Resolve the real playable file for each hit, in parallel.
   * Drop any hit that doesn't actually have a video file.
   */
  const resolved = await Promise.all(
    hits.map(async (hit) => {
      const file = await resolveArchiveFile(hit.identifier)

      if (!file) return null

      const sizeMb = file.sizeBytes
        ? +(file.sizeBytes / 1048576).toFixed(1)
        : null

      return {
        identifier: hit.identifier,
        title: hit.title,
        year: hit.year || null,
        description: hit.description || null,
        poster: hit.poster,
        /* The actual playable link */
        streamUrl: file.url,
        /* Where to view the item page (for alternatives) */
        itemPage: `https://archive.org/details/${hit.identifier}`,
        fileName: file.fileName,
        format: file.format,
        sizeMb
      }
    })
  )

  return resolved.filter(Boolean)
}

/* -------------------------------------------------------------------------- */
/* JustWatch fallback — better regional coverage than TMDb                    */
/* -------------------------------------------------------------------------- */

/*
 * JustWatch has no public API, but their internal GraphQL endpoint
 * is stable and doesn't require auth. We hit it with a well-formed
 * query and parse the offers.
 *
 * Affiliate param: set X_JUSTWATCH_AFFILIATE to your JustWatch partner
 * ID (e.g. "jw_partner_12345"). We append it to offer URLs so you get
 * credit for signups. If unset, links are still valid — just plain.
 */
const JUSTWATCH_AFFILIATE =
  String(process.env.X_JUSTWATCH_AFFILIATE || '').trim()

const JUSTWATCH_COUNTRY =
  String(process.env.X_JUSTWATCH_COUNTRY || 'US').trim().toUpperCase()

const JUSTWATCH_URL =
  'https://apis.justwatch.com/graphql'

/*
 * GraphQL query — asks for every offer for a title in a given country.
 * Includes monetization types: flatrate, rent, buy, free, ads.
 */
const JW_QUERY = `
  query GetOffers($title: String!, $country: Country!, $language: Language!) {
    popularTitles(
      country: $country
      filter: { searchQuery: $title }
      first: 1
    ) {
      edges {
        node {
          id
          objectType
          content(country: $country, language: $language) {
            title
            originalReleaseYear
            shortDescription
            fullPath
            posterUrl
            externalIds {
              imdbId
              tmdbId
            }
          }
          offers(country: $country, platform: WEB) {
            monetizationType
            presentationType
            elementCount
            retailPrice(language: $language)
            currency
            standardWebURL
            package {
              clearName
              technicalName
              shortName
              icon
            }
          }
        }
      }
    }
  }
`

/*
 * Normalize a JustWatch offer into the same shape we use
 * for TMDb providers so downstream code doesn't care.
 */
function normalizeJustWatchOffer(offer) {
  const pkg = offer?.package || {}

  const type =
    offer.monetizationType === 'FLATRATE' ? 'stream'
    : offer.monetizationType === 'FREE' ? 'free'
    : offer.monetizationType === 'ADS' ? 'ads'
    : offer.monetizationType === 'RENT' ? 'rent'
    : offer.monetizationType === 'BUY' ? 'buy'
    : 'other'

  let url = String(offer.standardWebURL || '').trim()

  /* Append affiliate param if configured */
  if (url && JUSTWATCH_AFFILIATE) {
    try {
      const u = new URL(url)
      u.searchParams.set('affiliate', JUSTWATCH_AFFILIATE)
      url = u.toString()
    } catch {}
  }

  const price = offer.retailPrice
    ? `${offer.retailPrice} ${offer.currency || ''}`.trim()
    : null

  return {
    provider: pkg.clearName || pkg.shortName || 'Provider',
    technicalName: pkg.technicalName || null,
    icon: pkg.icon || null,
    type,
    price,
    url,
    quality: offer.presentationType || null
  }
}

/*
 * Query JustWatch for a title and return normalized offers.
 * Returns { title, year, url, offers: [...] } or null.
 */
export async function justWatchOffers(title, year = null) {
  const q = String(title || '').trim()

  if (!q) return null

  const query = year ? `${q} ${year}` : q

  try {
    const res = await fetch(JUSTWATCH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/124.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        operationName: 'GetOffers',
        variables: {
          title: query,
          country: JUSTWATCH_COUNTRY,
          language: 'en'
        },
        query: JW_QUERY
      }),
      signal: AbortSignal.timeout(12000)
    })

    if (!res.ok) return null

    const data = await res.json()
    const edge = data?.data?.popularTitles?.edges?.[0]

    if (!edge?.node) return null

    const node = edge.node
    const content = node.content || {}
    const offers = (node.offers || [])
      .map(normalizeJustWatchOffer)
      .filter(o => o.url)

    if (!offers.length) {
      return {
        title: content.title || q,
        year: content.originalReleaseYear || year,
        url: content.fullPath
          ? `https://www.justwatch.com${content.fullPath}`
          : null,
        offers: []
      }
    }

    return {
      title: content.title || q,
      year: content.originalReleaseYear || year,
      imdbId: content.externalIds?.imdbId || null,
      tmdbId: content.externalIds?.tmdbId || null,
      description: content.shortDescription || null,
      poster: content.posterUrl || null,
      url: content.fullPath
        ? `https://www.justwatch.com${content.fullPath}`
        : null,
      offers
    }
  } catch (error) {
    console.warn(
      '[X MOVIE] JustWatch fetch failed:',
      error?.message || error
    )
    return null
  }
}

/*
 * Build a human-readable JustWatch offers block.
 * Grouped by type so the user sees Free / Stream / Rent / Buy.
 */
export function buildJustWatchBlock(jw) {
  if (!jw || !jw.offers?.length) return null

  const grouped = {
    free: [],
    ads: [],
    stream: [],
    rent: [],
    buy: [],
    other: []
  }

  for (const offer of jw.offers) {
    const bucket = grouped[offer.type] || grouped.other
    bucket.push(offer)
  }

  const sectionLabels = {
    free: '🆓 FREE',
    ads: '📺 FREE WITH ADS',
    stream: '📡 STREAM (subscription)',
    rent: '💵 RENT',
    buy: '💳 BUY',
    other: '❔ OTHER'
  }

  const lines = []

  for (const key of ['free', 'ads', 'stream', 'rent', 'buy', 'other']) {
    const list = grouped[key]
    if (!list.length) continue

    lines.push(`▸ *${sectionLabels[key]}*`)

    /* Dedupe by provider name — JustWatch returns dupes per quality */
    const seen = new Set()

    for (const offer of list) {
      if (seen.has(offer.provider)) continue
      seen.add(offer.provider)

      const priceTag = offer.price ? ` — ${offer.price}` : ''
      const qualityTag = offer.quality ? ` (${offer.quality})` : ''

      lines.push(
        `   ${offer.provider}${qualityTag}${priceTag}`
      )
      lines.push(`   ${offer.url}`)
    }

    lines.push('')
  }

  if (jw.url) {
    lines.push(`🔗 All offers: ${jw.url}`)
  }

  return lines.join('\n').trim()
}

/* -------------------------------------------------------------------------- */
/* Public config                                                              */
/* -------------------------------------------------------------------------- */

export const movieConfig = {
  MAX_MB,
  DOWNLOAD_TIMEOUT_MS,
  YTDLP_BIN,
  TMDB_ENABLED: !!TMDB_KEY,
  OMDB_ENABLED: !!OMDB_KEY
}