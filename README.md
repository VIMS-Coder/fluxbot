# Fluxbot

**A self-hostable, all-in-one bot for [Fluxer](https://fluxer.app) — with a real web dashboard.**

[![CI](https://github.com/martintondel02/fluxbot/actions/workflows/ci.yml/badge.svg)](https://github.com/martintondel02/fluxbot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-8b5cf6.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A522.13-339933.svg)](https://nodejs.org)

Fluxbot works with **any Fluxer instance** — the hosted one or a self-hosted
deployment — and gives your community levels, fun commands, reaction roles,
auto-roles and self-assignable roles, all configured from a browser.

> **Status:** `v0.1` — the engagement modules are complete and tested. Moderation,
> logging and automod are the next milestone.
>
> Fluxbot is an independent community project. It is not affiliated with or
> endorsed by Fluxer.

---

## Why another Fluxer bot?

Fluxer deliberately has **no slash commands, no buttons and no modals**. Bots are
prefix-command only, which means the interesting part of an "all-in-one" bot is
not the command list — it is **how you configure it**.

Fluxbot treats the dashboard as the primary interface:

- **Any instance, discovered.** Endpoints come from `/.well-known/fluxer`; nothing
  is hardcoded to `fluxer.app`.
- **No separate accounts.** Sign in with Fluxer via OAuth2 (`identify` + `guilds`).
  Dashboard access is derived from the permissions you already have.
- **Least privilege.** Each module declares the Fluxer permissions it needs, and
  the invite URL is generated from the modules you enabled.
- **Self-host first.** One `docker compose up`, Postgres included, no external
  services or cloud dependencies.
- **Reactive config.** Saving in the dashboard invalidates the bot's cache
  through Postgres `LISTEN/NOTIFY`; changes apply on the next message, no restart.

## Features

| Area | Status | What you get |
|---|---|---|
| **Levels** | ✅ Available | XP per message with cooldown, configurable curve, `!rank`, `!leaderboard`, level-up announcements, role rewards |
| **Fun** | ✅ Available | `!dice`, `!coinflip`, `!8ball`, `!choose`, `!ship` with per-command toggles |
| **Roles** | ✅ Available | Reaction roles with toggle/pick-one modes, join auto-roles, self-assignable roles (`!roles`, `!iam`, `!iamnot`) |
| **Dashboard** | ✅ Available | Guild picker, module configuration, channel/role pickers, per-command overrides, audit log, bot status, analytics |
| **Moderation** | 🚧 Next | Warnings/cases, timeout, kick, ban, tempban, purge, mod log |
| **Logging & automod** | 🚧 Next | Message/member/channel logs, rule engine with a test simulator |
| **Community** | 📋 Planned | Welcome messages, tickets, giveaways, temp voice channels |
| **Bridges** | 📋 Planned | Discord ↔ Fluxer channel mirroring: bots for ingress, webhooks for faithful names and avatars |
| **Scale-out** | 📋 Planned | Sharding, Redis, multi-instance public bot mode |

See the [command reference](docs/commands.md), [architecture notes](docs/architecture.md),
[Discord bridge design](docs/discord-bridge.md) and the full [roadmap](ROADMAP.md).

## Quick start (Docker)

```bash
git clone https://github.com/martintondel02/fluxbot.git
cd fluxbot
cp .env.example .env
# edit .env: instance origin, app id, client secret, bot token, dashboard origin
docker compose up -d --build
```

Then open your dashboard URL and sign in with Fluxer.

Before starting, create the application on your instance
(**User Settings → Applications**) and register the redirect URI
`{DASHBOARD_ORIGIN}/auth/callback`. The full walkthrough, reverse-proxy examples,
backups and troubleshooting live in **[docs/self-hosting.md](docs/self-hosting.md)**.

Generate the secrets with:

```bash
openssl rand -base64 32   # SESSION_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY
```

## Dashboard

| Page | What it does |
|---|---|
| **Your servers** | Only guilds where you hold Manage Server, with bot-install state and a generated invite |
| **Overview** | Ranked members, reaction menus, 7-day command usage, gateway status, recent changes, curve preview |
| **Levels** | XP range, cooldown, curve, announcements, exclusions, role rewards |
| **Fun** | Enable/disable each command and set a shared cooldown |
| **Roles** | Reaction-role builder, auto-roles, self-assignable roles |
| **Commands** | Per-command enable, permission level and cooldown override |
| **Audit log** | Every change with actor, before/after JSON |
| **Settings** | Prefix, invite link with required permissions, instance and bot status |
| **Legal** | `/privacy` and `/terms`, customizable with the operator's name and contact |

## How it works

```
apps/bot         gateway connection, command runtime, XP/reaction/member handlers, scheduler
apps/web         Next.js dashboard, OAuth2 login, server actions, audit log
packages/fluxer  instance discovery, OAuth2 + PKCE, permission math, invite URLs
packages/db      Drizzle schema, migrations, repositories, LISTEN/NOTIFY
packages/core    command framework, argument parser, cooldowns, crypto, logger
packages/modules levels, fun, roles and the pure command catalog
```

The bot and dashboard share Postgres. The dashboard writes configuration and
emits `pg_notify('fluxbot_config', …)`; the bot drops its cache and re-reads on the
next event. No extra API service is required.

## Local development

Requirements: Node.js 22.13+, pnpm 10+, Docker or Podman for Postgres.

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres   # or your own Postgres
pnpm db:migrate
pnpm dev                        # bot + dashboard
```

Dashboard: <http://localhost:3000>

### Demo mode (no Fluxer instance)

```bash
DEMO_MODE=true pnpm dev:web
```

Demo mode seeds a fake instance, user, guild, channels, roles and XP data so every
page renders. **Never enable it on a public deployment:** anyone can sign in as the
demo administrator.

### Fake instance smoke test

Test the whole gateway → command → REST loop without a Fluxer deployment:

```bash
# terminal 1
pnpm fake:instance

# terminal 2
FLUXER_INSTANCE_ORIGIN=http://127.0.0.1:4280 \
FLUXER_BOT_TOKEN=900000000000000001.smoke \
pnpm dev:bot
```

The fake instance sends `!ping`, `!dice 2d6`, a plain message (XP), `!rank` and
`!help`, and prints the bot's replies. See `scripts/fake-fluxer.mjs`.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `FLUXER_INSTANCE_ORIGIN` | yes | Deployment origin, e.g. `https://fluxer.example.com` |
| `FLUXER_APP_ID` | yes | Application ID (equals the bot user ID) |
| `FLUXER_CLIENT_SECRET` | yes | OAuth2 client secret (server-side only) |
| `FLUXER_BOT_TOKEN` | yes | Bot token from the application settings |
| `DASHBOARD_ORIGIN` | yes | Public dashboard URL; must match the registered redirect URI |
| `SESSION_SECRET` | yes | 32+ random bytes, signs session and OAuth state cookies |
| `ENCRYPTION_KEY` | yes | 32+ random bytes, encrypts OAuth tokens at rest |
| `DATABASE_URL` | yes | Postgres connection string (Compose overrides it) |
| `POSTGRES_PASSWORD` | Compose | Database password |
| `WEB_PORT` | no | Host port for the dashboard (default `3000`) |
| `BOT_OPERATOR_IDS` | no | Comma-separated Fluxer user IDs for operator-only commands |
| `LOG_LEVEL` | no | `debug`, `info`, `warn`, `error` (default `info`) |
| `DEMO_MODE` | no | `true` seeds a local demo; evaluation only |

## Tests

```bash
pnpm lint        # Biome
pnpm typecheck   # tsc across every workspace
pnpm test        # 73 unit tests
pnpm build       # production dashboard build
```

CI runs the same steps against a real Postgres service and also builds the
container image.

## Roadmap

See **[ROADMAP.md](ROADMAP.md)** for the full plan. The short version:

1. **v0.2 — Moderation:** cases, timeout, kick, ban, tempban, purge, mod log.
2. **v0.3 — Logging & automod:** event logs, rule engine, dashboard simulator.
3. **v0.4 — Community:** welcome, tickets, giveaways, temp voice.
4. **v0.5 — Discord ↔ Fluxer bridge:** bot ingress + webhook egress, opt-in per
   channel. Design: [docs/discord-bridge.md](docs/discord-bridge.md).
5. **v1.0 — Scale:** sharding, Redis, multi-instance public-bot mode, i18n.

## Project structure

```
apps/bot            gateway runtime
apps/web            dashboard (Next.js App Router)
packages/fluxer     protocol layer (the only Fluxer-aware package)
packages/db         schema, migrations, repositories
packages/core       command framework and shared primitives
packages/modules    engagement modules + command catalog
deploy/             container entrypoint
docs/               self-hosting, architecture, commands, bridge design
ROADMAP.md          phases and priorities
scripts/            fake Fluxer instance for local testing
```

## Contributing

Issues and pull requests are welcome. Start with
[CONTRIBUTING.md](CONTRIBUTING.md); run `pnpm lint && pnpm typecheck && pnpm test`
before opening a PR. Security reports: see [SECURITY.md](SECURITY.md).

## License

[MIT](./LICENSE). Fluxbot is an independent project and is not affiliated with
Fluxer. “Fluxer” and its marks belong to their respective owners.
