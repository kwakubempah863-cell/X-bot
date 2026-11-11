<p align="center">
  <img src="public/x-icon.png" alt="X-Bot icon" width="180" />
</p>

<h1 align="center">X-Bot</h1>

<p align="center"><strong>The multifunctional WhatsApp bot and Control Center.</strong></p>
<p align="center"><strong>Created by BempsX, the God Creator of X-Bot.</strong></p>

X-Bot is a persistent WhatsApp automation runtime with a web Control Center. It combines group administration and moderation with games, social features, AI, media tools, progression, and the VICE role-playing economy. Runtime data is stored in SQLite and scoped by tenant and group.

## Contents

- [Features](#features)
- [Commands](#commands)
- [Architecture](#architecture)
- [Requirements and setup](#requirements-and-setup)
- [Configuration](#configuration)
- [Control API](#control-api)
- [Security and operations](#security-and-operations)

## Features

| Area | What X-Bot provides |
| --- | --- |
| WhatsApp runtime | Baileys connection, QR and pairing-code login, persisted multi-file authentication, reconnect handling, group and participant synchronization. |
| Group tools | Group/member/admin details, rules, statistics, tagging, and per-group welcome and goodbye messages with editable templates. |
| Moderation | Warnings, member management, anti-link and anti-spam controls, deleted-message recovery, view-once handling, mute controls, and group-admin permissions. |
| Profiles and progression | Group-scoped profiles, XP, ranks, leaderboards, activity and game statistics, and generated profile/leaderboard cards. |
| Economy | Wallets, bank, daily/weekly/monthly claims, work, transfers, and group rich lists. |
| VICE role-playing | Careers, grinding, PvP combat, robberies, smuggling, equipment, consumables, crews, wars, territories, seasons, and missions. |
| Games | Turn-based and quick games including Tic-Tac-Toe, Connect Four, Wordle, Hangman, quiz, dice, coin flip, and other social games. |
| Anime and manga | Search, quotes, manga lookup, chapter selection, and chapter pages. |
| Media and actions | Music/video lookup and playback workflows, lyrics, movies, GIFs, animal media, and animated user actions. Availability depends on configured providers and network access. |
| AI and creative tools | Group-aware AI, image generation, text-to-speech, face tools, and avatar generation, subject to provider configuration. |
| Bot identity and rivals | Owner-only bot controls and rival-bot tracking/hunting features. |
| Control Center | Runtime and tenant status, pairing, groups, members, settings, games, audit/activity, connection events, command catalog, and media asset management. |

Features and permissions are implemented in the runtime, so the exact available commands depend on the current registry, configuration, and caller permissions.

## Commands

Commands use `.` by default. Change the prefix with `X_DEFAULT_PREFIX`. Start with `.menu` to see the registered catalog, or `.help <command>` for usage and permission details. Admin-only commands are restricted to WhatsApp group admins; owner-only commands require a configured trusted owner identity.

| Category | Examples | Purpose |
| --- | --- | --- |
| Core | `.menu`, `.help`, `.ping`, `.status`, `.owner` | Discover commands and check bot status. |
| Group | `.groupinfo`, `.members`, `.admins`, `.rules`, `.setrules`, `.welcome`, `.goodbye` | Inspect and configure a group. |
| Moderation | `.warn`, `.warnings`, `.kick`, `.promote`, `.antilink`, `.antispam`, `.antidelete`, `.antiview` | Moderate a group; privileged actions require the appropriate role. |
| Profile | `.profile`, `.rank`, `.leaderboard`, `.profilecard` | View group-specific activity and progression. |
| Economy and VICE | `.balance`, `.daily`, `.work`, `.pay`, `.bank`, `.career`, `.grind`, `.crew`, `.war`, `.mission` | Use the economy and role-playing systems. |
| Games | `.games`, `.coinflip`, `.dice`, `.rps`, `.tictactoe`, `.connect4`, `.quiz`, `.wordle`, `.hangman` | Play in the group and record results. |
| Anime and manga | `.anime`, `.animequote`, `.manga` | Search anime/manga and retrieve related content. |
| Media | `.play`, `.lyrics`, `.movie`, `.gif`, `.animal` | Find or share supported media. |
| AI and utilities | `.ai`, `.ask`, `.imagine`, `.say`, `.face`, `.avatar`, `.qr` | AI, creative, and utility commands. |
| Actions | `.actions`, `.gifs`, `.shadow` and action names | Discover and use animated actions. |
| Owner | `.setpublic`, `.setprivate`, `.warmode`, `.cmdimg`, `.ban`, `.unban`, `.banlist` | Manage bot-wide behavior and assets. |

This table highlights common commands, not every registered command. Use `.menu` or `GET /api/commands` for the live, complete registry, including each command's description, usage, category, and permission flags.

## Architecture

```text
WhatsApp (Baileys)
	|
	v
Connection + event synchronization
	|
	v
Command registry ---- AI / media providers
	|
	v
Tenant- and group-scoped SQLite data
	|
	v
Fastify control API ---- TanStack web Control Center
```

The main runtime is in `server/`; the web client is in `src/`. `server/commands.mjs` registers WhatsApp commands, `server/whatsapp.mjs` handles WhatsApp events, and `server/db.mjs` manages persistent runtime data. The Control Center is served by Vite during development and built with the production build script.

## Requirements and setup

| Requirement | Version/details |
| --- | --- |
| Node.js | `>=22.0.0 <25.0.0` |
| npm | `>=10.0.0` |
| WhatsApp login | Scan the QR code or request a pairing code for the account. |

1. Install dependencies:

   ```sh
   npm install
   ```

2. For local use, create a `.env` file in the project root and set at least one trusted owner identifier (see [Configuration](#configuration)). `.env.example` documents the production environment setting; Azure App Settings are injected by the platform.
3. Start the bot runtime:

   ```sh
   npm run runtime
   ```

4. In a second terminal, start the Control Center:

   ```sh
   npm run dev
   ```

5. Open `http://localhost:5173/app`. The runtime API defaults to `http://localhost:8787`.

For TypeScript-based runtime development, use `npm run runtime:dev`. For a production frontend build, use `npm run build`; `npm run preview` serves the generated build locally.

### Available scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run runtime` | Start the WhatsApp runtime and HTTP API. |
| `npm run runtime:dev` | Start the runtime with `tsx` development support. |
| `npm run build` | Build and finalize the static frontend. |
| `npm run preview` | Preview the production frontend build. |
| `npm run lint` | Run TypeScript, JavaScript, and CSS checks. |

## Configuration

Set configuration in the root `.env` file or the process environment. Keep real credentials out of source control.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP API port; defaults to `8787`. |
| `X_DATA_DIR` | Persistent runtime data directory; defaults to `./data`. |
| `X_DEFAULT_PREFIX` | WhatsApp command prefix; defaults to `.`. |
| `X_OWNER_JID`, `X_OWNER_LID`, `X_OWNER_USERNAME`, `X_OWNER_NUMBER` | Trusted owner identity values. Configure at least one before using owner-only commands. Use the account's international number without `+` or spaces when setting `X_OWNER_NUMBER`. |
| `X_API_KEY` | Optional API key for protected API requests. |
| `X_CORS_ORIGIN` | Comma-separated allowed origins for a deployed Control Center/API. |
| `X_AI_PROVIDER` | AI provider: `gemini` (default), `local`, `ollama`, `openai`, `groq` (or `grok`), or `openrouter`. |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL` | Gemini provider credentials and endpoint/model settings. |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Local Ollama endpoint and model. |
| `GROQ_API_KEY`, `GROQ_MODEL` | Groq credentials and model; defaults to `llama3-8b-8192`. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | OpenRouter credentials and model. |
| `X_ADMIN_USERNAME`, `X_ADMIN_PASSWORD_HASH`, `X_SESSION_SECRET` | Optional local administrator/session authentication settings. |

Provider-specific settings for OpenAI and other agent features are validated by the runtime. Only configure providers that you intend to use.

### Local administrator credentials

To configure the local administrator account, generate a password hash and a random session secret, then set `X_ADMIN_USERNAME`, `X_ADMIN_PASSWORD_HASH`, and `X_SESSION_SECRET` in `.env`:

```sh
node --input-type=module -e "import {createPasswordHash} from './server/auth.mjs'; console.log(await createPasswordHash('replace-with-a-strong-password'))"
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Do not use the example password as a real credential.

## Control API

The API listens on `PORT` (default `8787`). Use `GET /api/commands` to inspect exact command metadata. The main route families are:

| Route family | Capabilities |
| --- | --- |
| `/health`, `/api/health` | Health checks. |
| `/api/auth/*` | Login, session status, current user, logout, and password change. |
| `/api/runtime/*` | Default runtime status, connect, pairing, logout, and synchronization. |
| `/api/tenants/*` | Tenant listing, runtime controls, detail, activity, commands, connection events, and tenant deletion. |
| `/api/pairing/*` | Start, poll, finalize, and cancel a pairing session. |
| `/api/bans/*` | List, add, and remove blocked identities. |
| `/api/commands` | Live command metadata and permission flags. |
| `/api/menu-assets/*`, `/api/command-assets/*` | List, upload, configure, and remove bot image assets. |
| `/api/groups/*` | Group details, members, games, audit, leaderboard, settings, game launch, and group AI/context. |
| `/api/providers/*` | Anime, manga, anime quote, and GIF provider lookups. |

Tenant-specific routes and protected operations enforce the relevant session, role, or API-key checks. Consult `server/index.mjs` for request payloads and exact route behavior.

## Group templates

Welcome and goodbye templates support `{group}`, `{count}`, `{username}`, `{name}`, and `{user}`. Example:

```text
Welcome {user} to *{group}*! You are member #{count}.
```

Templates and their enabled/disabled states are stored per group. When available, the group profile picture can be used in join/leave messages.

## Security and operations

- Configure trusted owner identifiers before enabling owner commands. Display names and profile pictures are not proof of ownership.
- Group membership, settings, progression, economy, warnings, and game state are isolated by group; tenant data is isolated by tenant.
- Admin-level group commands check WhatsApp group-admin status.
- SQLite uses foreign keys and WAL mode. Keep the data directory durable and back it up while the service is stopped or with a SQLite-consistent backup process.
- The API applies request rate limits, body limits, and security headers. For internet-facing deployments, use HTTPS/TLS, restrict CORS, protect the API with `X_API_KEY` and dashboard authentication, and monitor/backup persistent data.
- Treat WhatsApp authentication files, `.env`, database files, and uploaded/private media as sensitive. Do not commit credentials, session data, or production runtime data.
- Use the WhatsApp integration responsibly and in accordance with applicable WhatsApp terms and policies.

## Project assets

| Asset | Use |
| --- | --- |
| `public/x-icon.png` | X-Bot README and application icon. |
| `public/x-menu.png` | Default cyber-style menu artwork and Control Center preview. |

For WhatsApp `.menu` image delivery, add the image through the Control Center's menu assets or register an HTTPS image in the runtime menu asset pool.
