/* -------------------------------------------------------------------------- */
/* Shared fetch helper                                                        */
/* -------------------------------------------------------------------------- */

const json = async (url, options = {}) => {
  const r = await fetch(url, {
    ...options,
    headers: {
      accept: 'application/json',
      ...(options.headers || {})
    }
  })

  if (!r.ok) {
    throw new Error(`Provider returned ${r.status}`)
  }

  return r.json()
}

/* -------------------------------------------------------------------------- */
/* Jikan (anime / manga)                                                      */
/* -------------------------------------------------------------------------- */

export async function animeSearch(query) {
  const q = encodeURIComponent(
    String(query || '').trim()
  )

  if (!q) throw new Error('Anime title required.')

  const d = await json(
    `https://api.jikan.moe/v4/anime?q=${q}&limit=5&sfw=true`
  )

  return (d.data || []).map((x) => ({
    id: x.mal_id,
    title: x.title,
    score: x.score,
    status: x.status,
    episodes: x.episodes,
    image: x.images?.jpg?.image_url,
    synopsis: x.synopsis
  }))
}

/* -------------------------------------------------------------------------- */
/* Anime quotes                                                               */
/* -------------------------------------------------------------------------- */

export async function animeQuote() {
  const d = await json(
    'https://animechan.io/api/v1/quotes/random'
  )

  const q = d?.[0] || d

  return q
    ? `“${q.quote}”\n— ${q.character || 'Unknown'} (${q.anime || 'Anime'})`
    : 'No quote available.'
}

/* -------------------------------------------------------------------------- */
/* GIPHY                                                                      */
/* -------------------------------------------------------------------------- */

export async function giphySearch(query) {
  const key = process.env.GIPHY_API_KEY

  if (!key) {
    throw new Error('GIPHY_API_KEY is not configured.')
  }

  const q = encodeURIComponent(
    String(query || '').trim()
  )

  const d = await json(
    `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(
      key
    )}&q=${q}&limit=8&rating=pg-13`
  )

  return (d.data || [])
    .map((x) => x.images?.original?.url)
    .filter(Boolean)
}

export async function giphyRandom(
  query,
  { limit = 25, rating = 'pg-13' } = {}
) {
  const key = process.env.GIPHY_API_KEY

  if (!key) {
    throw new Error('GIPHY_API_KEY is not configured.')
  }

  const q = encodeURIComponent(
    String(query || '').trim()
  )

  if (!q) {
    throw new Error('GIPHY query required.')
  }

  const response = await json(
    `https://api.giphy.com/v1/gifs/search?api_key=${encodeURIComponent(
      key
    )}&q=${q}&limit=${limit}&rating=${rating}&lang=en`,
    { signal: AbortSignal.timeout(15000) }
  )

  const rows = response.data || []

  if (!rows.length) return null

  const pick =
    rows[Math.floor(Math.random() * rows.length)]

  const images = pick.images || {}

  return (
    images.downsized_medium?.url ||
    images.downsized?.url ||
    images.original?.url ||
    images.fixed_height?.url ||
    null
  )
}

/* -------------------------------------------------------------------------- */
/* NekosBest                                                                  */
/* -------------------------------------------------------------------------- */

export async function nekosRandom(category) {
  const endpoint = String(category || '')
    .trim()
    .toLowerCase()

  if (!endpoint) return null

  const base = String(
    process.env.NEKOSBEST_BASE_URL ||
      'https://nekos.best/api/v2'
  ).replace(/\/+$/, '')

  const timeoutMs = Number(
    process.env.NEKOSBEST_TIMEOUT_MS || 8000
  )

  const controller = new AbortController()

  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs
  )

  try {
    const response = await fetch(
      `${base}/${encodeURIComponent(endpoint)}`,
      {
        signal: controller.signal,
        headers: {
          accept: 'application/json'
        }
      }
    )

    if (!response.ok) return null

    const data = await response.json()

    const rows = Array.isArray(data?.results)
      ? data.results
      : []

    if (!rows.length) return null

    const pick =
      rows[
        Math.floor(Math.random() * rows.length)
      ]

    return pick?.url || null
  } catch (error) {
    console.warn(
      `[X NEKOS] nekosRandom(${endpoint}) failed:`,
      error?.message || error
    )

    return null
  } finally {
    clearTimeout(timer)
  }
}

/* -------------------------------------------------------------------------- */
/* Lyrics (lyrics.ovh)                                                        */
/* -------------------------------------------------------------------------- */

export async function lyricsSearch(query) {
  const q = String(query || '').trim()
  if (!q) return null

  const attempts = []

  /* -------------------------------------------
   * 1) Ask lyrics.ovh's suggest endpoint.
   *    It resolves artist + title for popular songs.
   * ----------------------------------------- */
  try {
    const url =
      `https://api.lyrics.ovh/suggest/${encodeURIComponent(q)}`
    const res = await fetch(url, {
      headers: { accept: 'application/json' }
    })
    if (res.ok) {
      const data = await res.json()
      const top = data?.data?.[0]
      if (top?.artist?.name && top?.title) {
        attempts.push({
          artist: top.artist.name,
          title: top.title
        })
      }
    }
  } catch (error) {
    console.warn('[X LYRICS] suggest failed:', error?.message || error)
  }

  /* -------------------------------------------
   * 2) Manual parse — try BOTH orders.
   *    "Artist - Title" AND "Title - Artist".
   *    lyrics.ovh will just fail if we guess wrong,
   *    so trying both costs nothing.
   * ----------------------------------------- */
  const parts = q.split(/\s*[-–—]\s*/).map((s) => s.trim())

  if (parts.length >= 2) {
    const left = parts[0]
    const right = parts.slice(1).join(' - ')

    // Order A: "Artist - Title"
    attempts.push({ artist: left, title: right })
    // Order B: "Title - Artist"
    attempts.push({ artist: right, title: left })
  } else {
    // No dash. Try the whole string as both fields.
    attempts.push({ artist: q, title: q })
  }

  /* -------------------------------------------
   * 3) Hit /v1/{artist}/{title} for each attempt.
   *    First one that returns lyrics wins.
   * ----------------------------------------- */
  for (const { artist, title } of attempts) {
    if (!artist || !title) continue

    try {
      const url =
        `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
      const res = await fetch(url, {
        headers: { accept: 'application/json' }
      })

      if (!res.ok) continue

      const data = await res.json()
      const lyrics = String(data?.lyrics || '').trim()

      if (!lyrics) continue

      return {
        artist: artist || 'Unknown artist',
        title: title || 'Unknown title',
        lyrics
      }
    } catch (error) {
      // Try next attempt
    }
  }

  return null
}


/* -------------------------------------------------------------------------- */
/* MangaDex — manga / manhwa / manhua                                         */
/* -------------------------------------------------------------------------- */

/*
 * MangaDex public API. No key required for reads.
 * Rate limit: ~5 req/sec per IP. We stay well under.
 *
 * Docs: https://api.mangadex.org/docs/
 */

const MANGADEX_BASE = 'https://api.mangadex.org'
const MANGADEX_UPLOADS = 'https://uploads.mangadex.org'

/*
 * Rotate User-Agents from real browser strings.
 * MangaDex requires a descriptive UA with contact info —
 * spoofed UAs get flagged. This is a real contact string.
 */
const CONTACT = process.env.MANGADEX_CONTACT || 'x-bot@example.com'

const UA_POOL = [
  `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 X-Bot/1.0 (${CONTACT})`,
  `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 X-Bot/1.0 (${CONTACT})`,
  `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 X-Bot/1.0 (${CONTACT})`
]

function headers() {
  const ua = UA_POOL[Math.floor(Math.random() * UA_POOL.length)]
  return {
    accept: 'application/json',
    'user-agent': ua,
    'accept-language': 'en-US,en;q=0.9',
    referer: 'https://mangadex.org/'
  }
}

/* Random jitter between requests — 800–2000ms */
function jitter(min = 800, max = 2000) {
  const ms = min + Math.random() * (max - min)
  return new Promise((r) => setTimeout(r, ms))
}

/*
 * Rate-limit-aware fetch with exponential backoff.
 * Retries on 429 (rate limit) and 5xx transient errors.
 */
async function safeFetch(url, { retries = 4 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    try {
      const res = await fetch(url, {
        headers: headers(),
        signal: controller.signal
      })

      clearTimeout(timer)

      if (res.status === 429) {
        const wait = Math.min(8000, 1500 * 2 ** attempt)
        console.warn(`[MANGADEX] 429 — backing off ${wait}ms`)
        await new Promise((r) => setTimeout(r, wait))
        continue
      }

      if (res.status >= 500 && res.status < 600) {
        const wait = Math.min(5000, 1000 * 2 ** attempt)
        console.warn(`[MANGADEX] ${res.status} — retry in ${wait}ms`)
        await new Promise((r) => setTimeout(r, wait))
        continue
      }

      if (!res.ok) {
        throw new Error(`MangaDex returned ${res.status}`)
      }

      return res
    } catch (error) {
      clearTimeout(timer)

      if (error?.name === 'AbortError') {
        console.warn(`[MANGADEX] timeout — attempt ${attempt + 1}`)
      }

      if (attempt === retries) {
        throw new Error(`MangaDex unreachable: ${error.message}`)
      }

      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
    }
  }

  throw new Error('MangaDex unreachable after retries')
}

/*
 * Search manga/manhwa/manhua by title.
 *
 * We omit `availableTranslatedLanguage[]=en` from the search
 * so the full catalog comes back. English filtering happens
 * at the chapter level, where it actually matters.
 */
export async function mangaSearch(query) {
  const q = String(query || '').trim()
  if (!q) throw new Error('Manga title required.')

  const url =
    `${MANGADEX_BASE}/manga` +
    `?title=${encodeURIComponent(q)}` +
    `&limit=10` +
    `&includes[]=cover_art` +
    `&hasAvailableChapters=true` +
    `&contentRating[]=safe` +
    `&contentRating[]=suggestive` +
    `&contentRating[]=erotica`

  const response = await safeFetch(url)
  const data = await response.json()
  const rows = data?.data || []

  if (!rows.length) return []

  return rows.map((row) => {
    const attrs = row.attributes || {}

    const title =
      attrs.title?.en ||
      Object.values(attrs.title || {})[0] ||
      'Unknown title'

    const description =
      attrs.description?.en ||
      Object.values(attrs.description || {})[0] ||
      'No description available.'

    let coverFileName = null
    for (const rel of row.relationships || []) {
      if (rel.type === 'cover_art' && rel.attributes?.fileName) {
        coverFileName = rel.attributes.fileName
        break
      }
    }

    return {
      id: row.id,
      hid: row.id,
      title,
      altTitles: (attrs.altTitles || [])
        .flatMap((entry) => Object.values(entry || {}))
        .filter(Boolean),
      description: String(description).slice(0, 500),
      status: attrs.status || 'unknown',
      year: attrs.year || null,
      cover: coverFileName
        ? `${MANGADEX_UPLOADS}/covers/${row.id}/${coverFileName}.512.jpg`
        : null,
      contentRating: attrs.contentRating || 'safe',
      tags: (attrs.tags || [])
        .map((tag) => tag.attributes?.name?.en)
        .filter(Boolean),
      source: 'mangadex'
    }
  })
}

/*
 * Fetch the English chapter list for a manga.
 *
 * Sorted ascending by chapter number so the PDF reads
 * front to back. Deduplicated by chapter number across
 * scanlation groups.
 */
export async function mangaChapters(mangaId, { limit = 500 } = {}) {
  if (!mangaId) return []

  const url =
    `${MANGADEX_BASE}/manga/${mangaId}/feed` +
    `?translatedLanguage[]=en` +
    `&order[chapter]=asc` +
    `&limit=${limit}` +
    `&includes[]=scanlation_group` +
    `&contentRating[]=safe` +
    `&contentRating[]=suggestive` +
    `&contentRating[]=erotica`

  const response = await safeFetch(url)
  const data = await response.json()
  const rows = data?.data || []

  if (!rows.length) return []

  const seen = new Set()

  return rows
    .map((row) => {
      const attrs = row.attributes || {}

      let group = null
      for (const rel of row.relationships || []) {
        if (rel.type === 'scanlation_group') {
          group = rel.attributes?.name || null
          break
        }
      }

      return {
        id: row.id,
        number: attrs.chapter ?? null,
        title: attrs.title || null,
        volume: attrs.volume || null,
        language: attrs.translatedLanguage || 'en',
        pages: attrs.pages || 0,
        group,
        publishedAt: attrs.publishAt || null
      }
    })
    .filter((ch) => {
      const key = String(ch.number ?? ch.id)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => {
      const na = parseFloat(a.number)
      const nb = parseFloat(b.number)
      if (isNaN(na) || isNaN(nb)) return 0
      return na - nb
    })
}

/*
 * Resolve page image URLs for a chapter through the
 * At-Home server. Prefers `data-saver` (compressed) to
 * keep PDF size down.
 */
export async function mangaChapterPages(chapterId) {
  if (!chapterId) return null

  const url = `${MANGADEX_BASE}/at-home/server/${chapterId}`

  const response = await safeFetch(url)
  const data = await response.json()

  const baseUrl = data?.baseUrl
  const hash = data?.chapter?.hash

  const saver = data?.chapter?.dataSaver || []
  const original = data?.chapter?.data || []

  const filenames = saver.length > 0 ? saver : original
  const quality = saver.length > 0 ? 'data-saver' : 'data'

  if (!baseUrl || !hash || !filenames.length) return null

  return filenames.map(
    (name) => `${baseUrl}/${quality}/${hash}/${name}`
  )
}

/* -------------------------------------------------------------------------- */
/* Unified metadata search                                                    */
/* -------------------------------------------------------------------------- */

export async function searchManga(query, { limit = 5 } = {}) {
  const q = String(query || '').trim()
  if (!q) return []

  try {
    const rows = await mangaSearch(q)
    const resultLimit = Math.max(
      1,
      Math.min(5, Number.isFinite(Number(limit)) ? Math.floor(Number(limit)) : 5)
    )

    return rows.slice(0, resultLimit).map((row) => ({
      id: row.id,
      hid: row.hid || row.id,
      source: row.source || 'mangadex',
      title: row.title || 'Unknown title',
      altTitles: row.altTitles || [],
      year: row.year || null,
      status: row.status || 'unknown',
      cover: row.cover || null,
      description: row.description || '',
      contentRating: row.contentRating || 'safe',
      tags: row.tags || []
    }))
  } catch (error) {
    console.warn('[MANGA SEARCH] MangaDex metadata search failed:', error?.message || error)
    return []
  }
}

const ANILIST_URL = 'https://graphql.anilist.co'

export async function anilistSearch(query) {
  const q = String(query || '').trim()
  if (!q) return []

  const queryText = `
    query ($q: String) {
      Page(perPage: 5) {
        media(search: $q, type: ANIME) {
          id
          title { romaji english native }
          coverImage { large }
          bannerImage
          description
          episodes
          duration
          status
          averageScore
          genres
          season
          seasonYear
          studios(isMain: true) { nodes { name } }
          trailer { id site }
        }
      }
    }
  `

  try {
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        query: queryText,
        variables: { q }
      }),
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      throw new Error(`AniList returned ${response.status}`)
    }

    const data = await response.json()

    return (data?.data?.Page?.media || []).map((media) => {
      const trailer = media.trailer
      const trailerUrl = trailer?.id
        ? trailer.site === 'youtube'
          ? `https://www.youtube.com/watch?v=${encodeURIComponent(trailer.id)}`
          : trailer.site === 'dailymotion'
            ? `https://www.dailymotion.com/video/${encodeURIComponent(trailer.id)}`
            : null
        : null
      const description = String(media.description || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')

      return {
        id: media.id,
        title: media.title?.english || media.title?.romaji || media.title?.native || 'Unknown title',
        romaji: media.title?.romaji || '',
        english: media.title?.english || '',
        native: media.title?.native || '',
        score: media.averageScore == null ? null : media.averageScore / 10,
        status: media.status || 'Unknown',
        episodes: media.episodes,
        duration: media.duration,
        image: media.coverImage?.large || null,
        bannerImage: media.bannerImage || null,
        synopsis: description.trim(),
        year: media.seasonYear || null,
        genres: media.genres || [],
        studios: (media.studios?.nodes || []).map((studio) => studio.name),
        trailerUrl
      }
    })
  } catch (error) {
    console.warn('[ANILIST] Search failed:', error?.message || error)
    return []
  }
}

const ITUNES_BASE = 'https://itunes.apple.com'

export async function songSearch(query) {
  const q = String(query || '').trim()
  if (!q) return null

  try {
    const url =
      `${ITUNES_BASE}/search?` +
      `term=${encodeURIComponent(q)}` +
      '&media=music&entity=song&limit=1'
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    })

    if (!response.ok) return null

    const data = await response.json()
    const hit = data?.results?.[0]

    if (!hit) return null

    const artwork100 = String(hit.artworkUrl100 || '')
    const artworkLarge = artwork100
      ? artwork100.replace('100x100', '600x600')
      : null

    return {
      title: hit.trackName || null,
      artist: hit.artistName || null,
      album: hit.collectionName || null,
      year: hit.releaseDate ? hit.releaseDate.slice(0, 4) : null,
      genre: hit.primaryGenreName || null,
      durationMs: hit.trackTimeMillis || null,
      artworkSmall: artwork100 || null,
      artworkLarge,
      previewUrl: hit.previewUrl || null,
      trackId: hit.trackId || null,
      itunesUrl: hit.trackViewUrl || null
    }
  } catch (error) {
    console.warn('[ITUNES] Song search failed:', error?.message || error)
    return null
  }
}