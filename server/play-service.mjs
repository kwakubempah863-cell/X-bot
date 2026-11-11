import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import yts from 'yt-search';
import ffmpeg from 'fluent-ffmpeg';
import sanitize from 'sanitize-filename';
import pLimit from 'p-limit';

const MAX_MB =
  Number(process.env.X_PLAY_MAX_MB || 25);

const MAX_DURATION =
  Number(process.env.X_PLAY_MAX_DURATION_SECONDS || 600);

const TIMEOUT_MS =
  Number(process.env.X_PLAY_TIMEOUT_MS || 30000);

const YT_COOKIES_FILE = '/tmp/yt-cookies.txt';

const CONCURRENCY =
  Number(process.env.X_PLAY_CONCURRENCY || 2);

const TMP_ROOT =
  process.env.X_PLAY_TMP_DIR ||
  path.join('data', 'tmp', 'play');

const YTDLP_BIN =
  process.env.X_PLAY_YTDLP_BIN ||
  (process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

/* ---- BYPASS: geo spoof country ---- */
const GEO_COUNTRY =
  process.env.X_PLAY_GEO_COUNTRY || 'US';

const limit = pLimit(Math.max(1, CONCURRENCY));

/* -------------------------------------------------------
 * Temporary directory
 * ----------------------------------------------------- */
async function ensureTmpDir() {
  await fsp.mkdir(TMP_ROOT, { recursive: true });
}

/* -------------------------------------------------------
 * Safe filenames
 * ----------------------------------------------------- */
function safeName(value) {
  const result = sanitize(String(value || 'audio'))
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return result || 'audio';
}

/* -------------------------------------------------------
 * Generic command runner
 * ----------------------------------------------------- */
function runProcess(
  command,
  args,
  { timeoutMs = TIMEOUT_MS, cwd = process.cwd(), maxOutputBytes = 2 * 1024 * 1024 } = {}
) {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let finished = false;

    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { child.kill('SIGKILL'); } catch {}
      const error = new Error('DOWNLOAD_TIMEOUT');
      error.code = 'DOWNLOAD_TIMEOUT';
      reject(error);
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      if (stdout.length < maxOutputBytes) {
        stdout += chunk.toString().slice(0, maxOutputBytes - stdout.length);
      }
    });

    child.stderr.on('data', (chunk) => {
      if (stderr.length < maxOutputBytes) {
        stderr += chunk.toString().slice(0, maxOutputBytes - stderr.length);
      }
    });

    child.on('error', (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (error?.code === 'ENOENT') {
        const e = new Error('YTDLP_MISSING');
        e.code = 'YTDLP_MISSING';
        reject(e);
        return;
      }
      reject(error);
    });

    child.on('close', (code, signal) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      if (code === 0) {
        resolve({ stdout, stderr, code, signal });
        return;
      }

      const error = new Error(stderr.trim() || `Process exited with code ${code}`);
      error.code = code === 1 ? 'YTDLP_FAILED' : `YTDLP_EXIT_${code}`;
      error.exitCode = code;
      error.signal = signal;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

/* -------------------------------------------------------
 * BYPASS: build yt-dlp args with all the tricks
 * ----------------------------------------------------- */
async function buildBypassArgs(extra = []) {
  const PROXY_URL = process.env.X_PLAY_PROXY || 'socks5://127.0.0.1:40000';
  const args = [
    '--no-warnings',
    '--no-playlist',
    '--ignore-config',
    '--no-check-certificates',
    '--js-runtimes', 'node:/usr/local/bin/node',
    '--remote-components', 'ejs:github',

    /* Retries — survive throttling and transient blocks */
    '--retries', '10',
    '--fragment-retries', '10',
    '--file-access-retries', '10',
    '--extractor-retries', '5',
    '--socket-timeout', '30',
    '--force-ipv4',
    ...(PROXY_URL ? ['--proxy', PROXY_URL] : []),

    /* Geo bypass */
    '--geo-bypass',
    '--geo-bypass-country', GEO_COUNTRY,

    /* Try clients with less restrictive IP checks */
    '--extractor-args',
    'youtube:player_client=mweb,tv,web_safari;player_skip=',

    /* Bypass age gate and consent */
    '--age-limit', '99',
    '--extractor-args',
    'youtube:skip=translated_subs',

    /* Cookies — only attach if valid */
    ...(() => {
      const cookiesB64 = String(process.env.YT_COOKIES_B64 || '').trim();
      if (!cookiesB64) {
        console.warn('[X PLAY] YT_COOKIES_B64 not set; skipping cookies');
        return [];
      }
      fs.writeFileSync(
        YT_COOKIES_FILE,
        Buffer.from(cookiesB64, 'base64').toString('utf8'),
        { mode: 0o600 },
      );
      const stat = fs.statSync(YT_COOKIES_FILE);
      console.log('[X PLAY] Cookies file size:', stat.size, 'bytes');
      if (stat.size < 100) {
        console.warn('[X PLAY] Cookies file too small (<100 bytes); skipping');
        return [];
      }
      return ['--cookies', YT_COOKIES_FILE];
    })(),
  ];

  return args.concat(extra);
}

/* -------------------------------------------------------
 * Check yt-dlp
 * ----------------------------------------------------- */
async function ytdlpAvailable() {
  try {
    await runProcess(YTDLP_BIN, ['--version'], { timeoutMs: 10000 });
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------
 * Check FFmpeg
 * ----------------------------------------------------- */
function ffmpegAvailable() {
  return new Promise((resolve) => {
    const child = spawn('ffmpeg', ['-version'], { windowsHide: true });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
  });
}

/* -------------------------------------------------------
 * Search YouTube
 * ----------------------------------------------------- */
export async function playSearch(query) {
  const search = await yts(query);
  const videos = (search?.videos || []).filter((video) => {
    const seconds = Number(video?.seconds || 0);
    return (
      Boolean(video?.url) &&
      seconds > 0 &&
      seconds <= MAX_DURATION
    );
  });

  if (!videos.length) throw new Error('NO_RESULTS');
  return videos[0];
}

/* -------------------------------------------------------
 * Metadata extraction with bypass args
 * ----------------------------------------------------- */
async function getMetadata(url) {
  const args = await buildBypassArgs([
    '--dump-single-json',
    '--skip-download',
    '--',
    url,
  ]);

  const result = await runProcess(YTDLP_BIN, args, { timeoutMs: TIMEOUT_MS });

  let data;
  try {
    data = JSON.parse(result.stdout);
  } catch {
    const error = new Error('YTDLP_METADATA_INVALID');
    error.code = 'YTDLP_METADATA_INVALID';
    throw error;
  }

  if (!data) throw new Error('AUDIO_UNAVAILABLE');
  return data;
}

/* -------------------------------------------------------
 * Download with bypass args
 * ----------------------------------------------------- */
async function downloadAudio(url, outputPath) {
  const args = await buildBypassArgs([
    '-f', 'bestaudio/best',
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '128K',
    '--no-embed-metadata',
    '--no-embed-thumbnail',
    '-o', outputPath,
    '--',
    url,
  ]);

  try {
    const loggedArgs = args.map((arg, index) =>
      args[index - 1] === '--proxy' ? '[REDACTED]' : arg
    );
    console.log('[X PLAY] Executing:', YTDLP_BIN, loggedArgs.join(' '));
    await runProcess(YTDLP_BIN, args, {
      timeoutMs: Math.max(TIMEOUT_MS, 120000),
    });
  } catch (error) {
    console.error('[X PLAY] Raw yt-dlp failure:', error.stderr || error.message);
    const stderr = String(error?.stderr || '');
    const combined = (stderr + ' ' + String(error?.message || '')).toLowerCase();

    if (
      combined.includes('requested format is not available') ||
      combined.includes('format is not available') ||
      combined.includes('sign in') ||
      combined.includes('confirm you are not a bot') ||
      combined.includes('age-restricted') ||
      combined.includes('this video is not available') ||
      combined.includes('private video')
    ) {
      const e = new Error('AUDIO_UNAVAILABLE');
      e.code = 'AUDIO_UNAVAILABLE';
      throw e;
    }

    throw error;
  }
}

/* -------------------------------------------------------
 * FFmpeg fallback conversion
 * ----------------------------------------------------- */
function convertToMp3(input, output, durationSec) {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(input)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .audioFrequency(44100)
      .format('mp3')
      .on('error', reject)
      .on('end', resolve);

    if (durationSec && durationSec > 0) {
      command.duration(Math.min(durationSec, MAX_DURATION));
    }

    command.save(output);
  });
}

/* -------------------------------------------------------
 * Verify MP3 output
 * ----------------------------------------------------- */
async function verifyOutput(filePath) {
  const stat = await fsp.stat(filePath);
  if (!stat.isFile() || stat.size <= 0) throw new Error('EMPTY_OUTPUT');

  const maxBytes = MAX_MB * 1024 * 1024;
  if (stat.size > maxBytes) throw new Error('FILE_TOO_LARGE');
  return stat;
}

/* -------------------------------------------------------
 * Main resolver
 * ----------------------------------------------------- */
export async function playResolve(query) {
  return limit(async () => {
    await ensureTmpDir();

    if (!(await ytdlpAvailable())) throw new Error('YTDLP_MISSING');
    if (!(await ffmpegAvailable())) throw new Error('FFMPEG_MISSING');

    const video = await playSearch(query);
    const duration = Number(video?.seconds || 0);

    if (!duration || duration <= 0) throw new Error('AUDIO_UNAVAILABLE');
    if (duration > MAX_DURATION) throw new Error('FILE_TOO_LARGE');

    const jobId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const base = safeName(`${video.title}_${video.author?.name || 'unknown'}`);
    const rawPath = path.join(TMP_ROOT, `${jobId}_${base}.webm`);
    const mp3Path = path.join(TMP_ROOT, `${jobId}_${base}.mp3`);

    const maxBytes = MAX_MB * 1024 * 1024;

    try {
      let metadata;
      try {
        metadata = await getMetadata(video.url);
      } catch (error) {
        console.error('[X PLAY] metadata error:', error?.message);
      }

      const actualDuration = Number(metadata?.duration || duration);
      if (actualDuration > MAX_DURATION) throw new Error('FILE_TOO_LARGE');

      await downloadAudio(video.url, mp3Path);

      let stat;
      try {
        stat = await verifyOutput(mp3Path);
      } catch (error) {
        console.warn('[X PLAY] direct MP3 unavailable, trying raw + FFmpeg:', error?.message);

        const rawArgs = buildBypassArgs([
          '-f', 'ba/b',
          '-o', rawPath,
          '--',
          video.url,
        ]);

        await runProcess(YTDLP_BIN, rawArgs, {
          timeoutMs: Math.max(TIMEOUT_MS, 120000),
        });

        await convertToMp3(rawPath, mp3Path, actualDuration);
        stat = await verifyOutput(mp3Path);
      }

      if (stat.size > maxBytes) throw new Error('FILE_TOO_LARGE');

      const buffer = await fsp.readFile(mp3Path);
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error('EMPTY_OUTPUT');
      }

      return {
        buffer,
        title: metadata?.title || video.title || 'Unknown',
        artist:
          metadata?.artist ||
          metadata?.uploader ||
          video.author?.name ||
          'Unknown',
        duration: actualDuration,
        fileName: `${base}.mp3`,
        mimetype: 'audio/mpeg',
      };
    } catch (error) {
      console.error('[X PLAY] resolver error:', error);
      throw error;
    } finally {
      await fsp.unlink(rawPath).catch(() => {});
      await fsp.unlink(mp3Path).catch(() => {});
    }
  });
}

/* -------------------------------------------------------
 * Public configuration
 * ----------------------------------------------------- */
export const playConfig = {
  MAX_MB,
  MAX_DURATION,
  TIMEOUT_MS,
  CONCURRENCY,
  YTDLP_BIN,
  GEO_COUNTRY,
};