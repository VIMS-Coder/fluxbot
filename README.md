# Fluxbot

**A self-hostable, all-in-one bot for [Fluxer](https://fluxer.app) — with a real web dashboard.**

Fluxbot connects to any Fluxer instance (the hosted one or your own self-hosted deployment), gives your community levels, fun commands, self-assignable and reaction roles, and lets you configure all of it from a browser instead of fighting with commands.

> **Status:** early development (`v0.1.0`). Engagement modules (levels, fun, roles) are the first milestone; moderation, logging and automod are next.
>
> Fluxbot is an independent community project. It is not affiliated with or endorsed by Fluxer.

---

## Why another Fluxer bot?

Fluxer has **no slash commands, no buttons, and no modals**. Bots are prefix-command only, so the interesting part of an "all-in-one" bot is not the command list — it is the configuration experience.

Fluxbot treats the dashboard as the primary interface:

- **Works with any instance.** Endpoints are discovered from `/.well-known/fluxer`; nothing is hardcoded to `fluxer.app`.
- **No separate login.** You sign in with your Fluxer account through OAuth2 (`identify` + `guilds`). Access is derived from the permissions you already hold in that guild.
- **Least privilege.** Every module declares the Fluxer permissions it needs, and the dashboard generates the invite URL for exactly those.
- **Self-host first.** One `docker compose up`, Postgres included, no external services required.

## Features

### Available now

| Area | What you get |
|---|---|
| **Levels** | XP per message, configurable curve and cooldown, `!rank`, `!leaderboard`, level-up announcements, role rewards |
| **Fun** | `!dice`, `!coinflip`, `!8ball`, `!choose`, `!ship`, `!roll` with per-command toggles |
| **Roles** | Reaction roles, auto-roles on join, self-assignable role menus (`!roles`, `!iam`, `!iamnot`) |
| **Core** | `!help`, `!ping`, `!about`, per-guild prefix |
| **Dashboard** | Fluxer OAuth2 login, guild picker, module configuration, command toggles, role builders, audit log |

### Roadmap

- **v0.2 — Moderation:** warnings/cases, timeout, kick, ban, tempban, purge, mod log.
- **v0.3 — Logging & automod:** message/member/channel logs, rule engine with a test simulator.
- **v0.4 — Community:** welcome messages, tickets, giveaways, temp voice channels.
- **Later:** multi-instance public bot mode, sharding, i18n.

## Quick start (Docker)

You need a Fluxer instance where you can create an application.

1. **Create the bot application** on your instance: *User Settings → Applications → Create Application*. Copy the bot token and the client secret.
2. **Register the redirect URI** in the application settings:
   `https://bot.example.com/auth/callback` (or `http://localhost:3000/auth/callback` for local testing).
3. **Configure and start:**

```bash
git clone https://github.com/martintondel02/fluxbot.git
cd fluxbot
cp .env.example .env
# edit .env: instance origin, app id, client secret, bot token, session secret
docker compose up -d
```

4. Open `http://localhost:3000`, sign in with Fluxer, pick your guild, invite the bot with the generated link, and start configuring.

Generate the two secrets with:

```bash
openssl rand -base64 32   # SESSION_SECRET
openssl rand -base64 32   # ENCRYPTION_KEY
```

## Local development

Requirements: Node.js 22.13+, pnpm 10+, Docker (for Postgres).

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres

pnpm db:migrate
pnpm dev            # bot + dashboard
```

- Dashboard: <http://localhost:3000>
- Bot: connects using `FLUXER_INSTANCE_ORIGIN` + `FLUXER_BOT_TOKEN`

### Demo mode

Without a Fluxer instance you can still work on the dashboard:

```bash
DEMO_MODE=true pnpm dev:web
```

Demo mode bypasses OAuth2 and seeds a fake instance, user and guild so every page renders with sample data. It is disabled automatically when `NODE_ENV=production`.

## Configuration

| Variable | Required | Description |
|---|---|---|
| `FLUXER_INSTANCE_ORIGIN` | yes | Origin of your Fluxer instance, e.g. `https://fluxer.example.com` |
| `FLUXER_APP_ID` | yes | Application ID (equals the bot user ID) |
| `FLUXER_CLIENT_SECRET` | yes | OAuth2 client secret, used server-side only |
| `FLUXER_BOT_TOKEN` | yes | Bot token from the application settings |
| `DASHBOARD_ORIGIN` | yes | Public URL of this dashboard, e.g. `https://bot.example.com` |
| `SESSION_SECRET` | yes | 32+ random bytes, signs session cookies |
| `ENCRYPTION_KEY` | yes | 32+ random bytes, encrypts OAuth tokens at rest |
| `DATABASE_URL` | yes | Postgres connection string |
| `BOT_OPERATOR_IDS` | no | Comma-separated Fluxer user IDs allowed to use operator commands |
| `LOG_LEVEL` | no | `debug`, `info`, `warn`, `error` (default `info`) |
| `DEMO_MODE` | no | `true` enables the seeded dashboard without a Fluxer instance |

## How it works

```
apps/bot   — gateway connection, command runtime, XP/reaction/member handlers
apps/web   — Next.js dashboard, OAuth2 login, config UI, audit log
packages/fluxer  — instance discovery, OAuth2 client, permission math
packages/db      — Drizzle schema, migrations, repositories
packages/core    — command framework, argument parsers, cooldowns, crypto
packages/modules — engagement modules (levels, fun, roles) + command catalog
```

The bot and dashboard share Postgres. Configuration changes are written by the dashboard and picked up by the bot through Postgres `LISTEN/NOTIFY`, so there is no extra API service to run.

## Tests

```bash
pnpm typecheck
pnpm test
```

## Contributing

Issues and pull requests are welcome. Please run `pnpm typecheck && pnpm test && pnpm lint` before opening a PR.

## License

[MIT](./LICENSE)
