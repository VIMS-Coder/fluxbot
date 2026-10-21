# Fluxbot — Self-Hostable Fluxer Bot + Web Dashboard

**Status:** planning only, no code yet.
**Target:** an all-in-one Fluxer bot (moderation, logging, utilities, fun, levels, roles, tickets) that runs as a single Docker Compose stack for a self-hoster, and can also be scaled into a public multi-guild bot on `fluxer.app`.

---

## 0. TL;DR — the recommended shape

| Decision | Recommendation |
|---|---|
| Language | **TypeScript, Node 22.13+** |
| Bot SDK | **`@fluxerjs/core` (Fluxer.js 3.x)** — gateway, REST with rate limiting, cache, builders, `Client.fromDiscovery(origin)` for self-hosted instances |
| Commands | **Prefix commands only.** Fluxer has no slash commands, buttons, or modals. The dashboard is the "UI layer". |
| Repo | pnpm + Turborepo monorepo: `apps/bot`, `apps/web`, `packages/*` |
| Dashboard | **Next.js 15 (App Router, standalone output)** + Tailwind + shadcn/ui |
| DB | **Postgres by default in Compose**, SQLite profile for tiny/one-click installs. **Drizzle ORM** (one schema, two drivers) |
| Auth | Fluxer OAuth2 (authorization code + PKCE), scopes `identify` + `guilds`, server-side token exchange, HttpOnly cookie sessions |
| Queue/cache | None in MVP. Postgres `LISTEN/NOTIFY` for cache invalidation. Redis becomes optional at scale. |
| Deploy | One image, three roles (`bot`, `web`, `worker`); Compose starts `bot` + `web`; worker folds into bot until needed |
| Scale ceiling per shard | 2,500 guilds (Fluxer closes with 4011 above that); shard count 1–16,384 |

MVP = foundation + dashboard auth/config + moderation/logging/automod (~5–6 focused weeks).
v1.0 = everything in this document except music/voice and AI chat (~11–14 focused weeks solo).

---

## 1. What Fluxer actually gives you (verified, not assumed)

These constraints drive the whole design. Sources are linked so you can re-check them later.

### 1.1 Protocol surfaces
- HTTP API at `/v1` (only version), Gateway WebSocket at `?v=1&encoding=json`, Media Proxy for media/uploads, Admin API for instance ops.
  [docs.fluxer.app](https://docs.fluxer.app/) · [HTTP API overview](https://docs.fluxer.app/http-api/) · [Gateway overview](https://docs.fluxer.app/gateway/overview/)
- **No intents, no privileged-intent approval.** A bot session is never "passive"; it receives `MESSAGE_CREATE` for every channel it can view, with full content. Event volume reduction is only via `ignored_events`, sharding, and permissions.
  [Event filtering](https://docs.fluxer.app/gateway/event-filtering/)
- **No application-command / interaction surface.** OAuth2 scopes are exactly `identify`, `email`, `guilds`, `connections`, `bot` — there is no `applications.commands`. Gateway "commands" are client commands (heartbeat, identify, lazy request…), not bot commands. Messages have no components.
  [OAuth2 scopes](https://docs.fluxer.app/http-api/oauth2/) · [Client commands](https://docs.fluxer.app/gateway/commands/)
- Bots authenticate with `Authorization: Bot <application_id>.<secret>`; Gateway Identify takes the **raw token without prefix**.
  [Authentication](https://docs.fluxer.app/authentication/)

### 1.2 Self-hosting is a first-class supported mode
- `GET /.well-known/fluxer` returns the deployment's endpoints: `api_public` (what bots should use), `gateway`, `media`, `webapp`, `invite`, `docs`, plus feature flags (`self_hosted`, `voice_enabled`, `captcha`, limits).
  [Instance discovery](https://docs.fluxer.app/http-api/instance/)
- Endpoints may share an origin with a path prefix, or be separate hosts — never infer hosts. Use discovery.
- Some routes are **404 on self-hosted deployments** (billing, donations, gifts, in-app purchases). Don't depend on them.
  [Deployment availability](https://docs.fluxer.app/http-api/deployment-availability/)
- Bot applications are created **per instance** (User Settings → Applications). Tokens are **not portable** between instances. Same code, different instance = different app/token.
- Fluxer.js supports this directly: `Client.fromDiscovery('https://your.instance')`, plus a beta `ClientCluster` for multi-instance.
  [Fluxer.js self-hosting guide](https://fluxer.js.org/guides/multi-instance/)

### 1.3 Auth model for a dashboard
- OAuth2 authorization-code grant with PKCE (S256/plain). Authorization code lives 10 min; access token 7 days; refresh token 30 days and **rotates on every refresh**.
- `redirect_uri` must be registered on the application (max 10) and matches **byte for byte**.
- Scopes we can use:
  - `identify` → `GET /v1/oauth2/userinfo`, `GET /v1/oauth2/@me`
  - `guilds` → `GET /v1/users/@me/guilds`, `GET /v1/guilds/{id}`, `GET /v1/guilds/{id}/roles`
  - `bot` → installs the bot, grants no bearer access
- `GET /v1/users/@me/guilds` returns the caller's **complete permission mask** per guild, but only when `limit ≤ 100`. This is how the dashboard does authorization without guessing.
  [Guilds](https://docs.fluxer.app/http-api/guilds/)

> **Key consequence:** the dashboard can identify users and read their guild list/roles as *them*, but every bot action (kick, config apply, test message) must run server-side with the **bot token**. The browser must never see either secret.

### 1.4 Practical limits worth designing around
| Thing | Value |
|---|---|
| Global HTTP rate limit | 50 req/s per identity (1,200 with `HIGH_GLOBAL_RATE_LIMIT`), plus per-route buckets |
| Gateway inbound frame | 16,384 bytes |
| Guilds per shard | 2,500 (4011 above) |
| Message length | 2,000 default; bots get `max(instance, 4,000)` |
| Embeds / attachments | 10 each by default, from instance discovery |
| `MESSAGE_DELETE` | includes `content` and `author_id` (unless admin-deleted) — no message cache needed for delete logs |
| `MESSAGE_UPDATE` | full current message, no diff — cache needed for "before/after" edit logs |
| Audit reason | `X-Audit-Log-Reason` on mod actions |
| Snowflakes | decimal **strings** in JSON — use strings, never JS numbers |

---

## 2. Product scope

### 2.1 v1 modules
| Module | Included |
|---|---|
| **Moderation** | warn/note, timeout, kick, ban, tempban, softban, unban, purge, slowmode, lock/unlock, case history, DM notify, mod-log, reason editing, case numbering |
| **Automod** | invites, links/domain allowlist, banned words/regex, mention spam, caps, zalgo, duplicate/spam rate, new-account gate, attachment types; strike system; delete/warn/timeout/ban actions; exemptions |
| **Logging** | message edit/delete, bulk delete, joins/leaves, nickname/role changes, bans, channel/role changes, voice joins, audit-log enrichment, per-event channel routing |
| **Utilities** | ping/health, userinfo, serverinfo, avatar/banner, roleinfo, channelinfo, snowflake/time tools, timestamp generator, calc, color, base64/hash, AFK, tags/snippets, reminders, polls, giveaways, embed sender |
| **Fun** | dice, coinflip, 8ball, choose, ship, roll tables, reaction text games, quote image, hug/slap GIFs (licensed assets), would-you-rather/trivia |
| **Levels** | XP per message with cooldown, curve, rank card, leaderboard, level-role rewards, per-channel/role multipliers |
| **Roles** | reaction roles (dashboard-built), auto-roles on join, self-assignable role menus, temporary roles |
| **Welcome** | join/leave messages with variables, DM welcome, autorole, preview in dashboard |
| **Tickets** | private threads or forum posts, staff role, transcript, close/claim, dashboard inbox |
| **Temp voice** | join-to-create channels, auto-delete when empty, owner controls (no voice SDK needed) |
| **Ops/dashboard** | module toggles, command settings, permission overrides, audit trail, analytics, live status |

### 2.2 Explicit non-goals for v1
- **Music / voice streaming.** Fluxer.js documents its voice package as still changing; don't build a product on it yet. Temp-VC (channel management) is fine, audio is not.
- **Slash commands.** They don't exist. Don't fake them.
- **Discord bridge.** Separate product, separate scope. The command layer can be abstracted later if you ever want it.
- **LLM chat / AI moderation.** Great as an optional plugin behind a flag + your own API key, not core.

### 2.3 Positioning vs. the ecosystem
The awesome-fluxer list already has Fluxy, Bloo, Nevi, Pluuty, Netrcol, Functious, Astrokat, etc. Differentiation should be:
1. **Self-host first** — one `docker compose up`, no cloud dependency, SQLite path, full feature parity when self-hosted.
2. **Dashboard quality** — since Fluxer has no buttons/modals, the dashboard *is* the interaction layer.
3. **Least-privilege invites** — compute required permissions from enabled modules, never ask for Administrator.
4. **Open source + real docs** — the self-host story is the marketing.

---

## 3. Architecture

### 3.1 Processes
```
                    ┌──────────────────────────────┐
  Fluxer instance   │  Bot process (Node)          │
  ┌────────────┐    │  ├─ Gateway (1..N shards)    │
  │  HTTP API  │◄───┼─┤  ├─ command runtime        │
  │  Gateway   │◄───┼─┤  ├─ event handlers         │
  │  Media     │◄───┼─┤  └─ in-process scheduler   │
  └────────────┘    │  ├─ config cache             │
        ▲           │  └─ guild snapshot writer    │
        │           └───────────┬──────────────────┘
        │                       │  Postgres/SQLite
        │           ┌───────────▼──────────────────┐
        │           │  Web process (Next.js)       │
        └───────────┤  ├─ OAuth2 login/callback    │
     OAuth2 + REST  │  ├─ dashboard UI             │
      (user token)  │  ├─ REST/RSC actions         │
                    │  └─ SSE (via LISTEN/NOTIFY)  │
                    └──────────────────────────────┘
```

**Two processes in self-host mode.** No separate API service, no Redis requirement. The bot owns the gateway and the scheduler; the web app owns auth and UI. They share the DB.

Why this split works:
- Config changes are DB writes; the bot gets invalidated via `NOTIFY` (Postgres) or a 5 s poll (SQLite).
- Dashboard never proxies gateway traffic; no extra hop in the hot path.
- Same image, `ROLE=bot|web|worker`; worker is only split out when jobs get heavy.

### 3.2 Repository layout
```
fluxbot/
├─ apps/
│  ├─ bot/                    # entry: gateway, shards, scheduler
│  │  └─ src/
│  │     ├─ main.ts
│  │     ├─ runtime/          # client setup, shard manager, config cache
│  │     ├─ modules/          # one folder per module (commands + events + jobs)
│  │     └─ jobs/
│  └─ web/                    # Next.js dashboard
│     ├─ app/(auth)/login, auth/callback
│     ├─ app/(dash)/g/[guildId]/...
│     ├─ app/api/...          # route handlers
│     └─ components/
├─ packages/
│  ├─ core/                   # command framework, module registry, guards, errors
│  ├─ db/                     # Drizzle schema, migrations, repositories
│  ├─ fluxer/                 # discovery, OAuth2 client, REST helpers, permission math
│  ├─ config/                 # zod schemas per module + defaults + JSON-schema export
│  ├─ ui/                     # shared form fields, pickers, embed preview
│  └─ i18n/                   # message catalogs
├─ deploy/
│  ├─ Dockerfile              # multi-stage, one image, role switch
│  ├─ docker-compose.yml      # bot + web + postgres (+ sqlite profile)
│  └─ Caddyfile.example
├─ docs/                      # self-host guide, module docs, API notes
└─ PLAN.md
```

### 3.3 The `fluxer` package — the only place that knows the protocol
Put every Fluxer-specific detail behind one boundary:
- `discover(origin)` → validated instance discovery document (cache 10 min)
- `oauth2.authorizeUrl()`, `exchangeCode()`, `refresh()`, `userinfo()`, `myGuilds()`
- `inviteUrl(permissionMask)`
- `computePermissions(guild, member, channel)` — mirror of Fluxer's resolution order, for dashboard previews and pre-flight checks (the API is still the source of truth)
- `permissionNames` / module → required bits

This keeps Fluxer.js swappable (it's a young SDK) and makes the OpenAPI contract testing easy.

### 3.4 Configuration flow
```
Dashboard form → zod validate → write guild_configs (jsonb) + bump revision
              → INSERT audit_log
              → NOTIFY fluxbot_config, '<guildId>:<revision>'
Bot           → LISTEN → drop cache entry → next event reloads lazily
```
- Bot also keeps a **guild snapshot** (channels, roles, emoji) per guild from gateway events, written on `GUILD_CREATE` and `CHANNEL_*`/`GUILD_ROLE_*`. The dashboard reads the snapshot for pickers and validates that referenced channels/roles still exist.
- Snapshot staleness is a feature: show "bot not in guild / snapshot stale" states rather than lying.

### 3.5 Jobs
DB-backed `scheduled_jobs` table with `FOR UPDATE SKIP LOCKED` claiming:
- reminders, giveaway draws, tempban expiry, temp-role expiry, level-role reconciliation, stat-channel renames, ticket inactivity closes, automod strike decay.

Bot runs one scheduler loop (1 s tick) in self-host mode. At scale, set `ROLE=worker` and run N replicas; claiming makes it safe. BullMQ/Redis is an optimization, not a requirement.

---

## 4. Auth & permissions

### 4.1 Login flow
1. `/login` → 32-byte `state` + PKCE verifier into a short-lived HttpOnly cookie.
2. Redirect to `{endpoints.webapp}/oauth2/authorize?client_id&redirect_uri&response_type=code&scope=identify guilds&state&code_challenge&code_challenge_method=S256`.
3. Consent happens on the instance's own web app — no custom login UI to build.
4. `/auth/callback` → verify state, exchange code server-side with `client_secret`, fetch `/v1/oauth2/userinfo` + `/v1/users/@me/guilds?limit=100` (paginate with `after`).
5. Upsert `users`, `guild_members`; create `sessions` row; set rotating session cookie.
6. On expiry (or 401), refresh with the rotating refresh token; if that fails, re-login.

### 4.2 Authorization
- **Requires admin panel:** `permissions & (ADMINISTRATOR | MANAGE_GUILD)` on that guild.
- **Requires moderator view:** `MODERATE_MEMBERS | MANAGE_MESSAGES | VIEW_AUDIT_LOG | KICK_MEMBERS | BAN_MEMBERS`.
- **Bot presence:** if the guild isn't in the bot's guild list, show the invite CTA and refuse config writes.
- Permission cache TTL 5 min, **always re-check before a mutating action** (one cheap `GET /v1/users/@me/guilds` or reuse a fresh cache).
- Never trust `guildId` from the URL alone: look up the user's membership row and verify.
- Optional roles inside the dashboard: owner / admin / moderator / viewer, derived from Fluxer permissions, extensible per guild.

### 4.3 Capability calculator (nice differentiator)
Each module declares `requiredBotPermissions`, `requiredUserPermissions`, `intents` (n/a), `optionalDependencies` (e.g. threads). The dashboard:
- shows exactly what's missing for the modules you enabled,
- regenerates the least-privilege invite URL,
- warns when a module is enabled but its channel/role targets are misconfigured.

### 4.4 Secrets
- `FLUXER_CLIENT_SECRET` and `FLUXER_BOT_TOKEN` from env in single-instance mode; in multi-instance mode, encrypted in `instances` with AES-256-GCM using `ENCRYPTION_KEY`.
- Per-user OAuth2 access/refresh tokens encrypted at rest, decrypted only in the web process.
- Never in URLs, logs, client bundles, or error reports.

---

## 5. Data model (first cut)

Core:
| Table | Notes |
|---|---|
| `instances` | origin, discovery JSON, app_id, encrypted client_secret/bot_token, flags |
| `users` | instance_id + fluxer_user_id (unique), username, display name, avatar hash |
| `sessions` | token hash, user, expires, encrypted access/refresh, last refresh |
| `guilds` | instance_id + guild_id, name, icon, bot_present, config_revision |
| `guild_members` | user, guild, permission mask, is_owner, synced_at |
| `guild_configs` | guild, module, jsonb config, updated_by, updated_at |
| `guild_snapshots` | guild, jsonb channels/roles/emojis, updated_at |
| `command_settings` | guild, command, enabled, permission_level, cooldown, aliases |
| `audit_log` | guild, actor, action, target, before/after, ip, created_at |
| `scheduled_jobs` | type, run_at, payload, status, attempts, locked_by |
| `analytics_events` | guild, type, command, user, ts (partition/prune) |

Moderation:
| Table | Notes |
|---|---|
| `cases` | per-guild sequence, type, target, moderator, reason, duration, expires_at, status, log_message_id |
| `automod_rules` | guild, name, enabled, trigger jsonb, conditions jsonb, actions jsonb, exemptions |
| `automod_strikes` | guild, user, count, last_hit, decay_at |
| `notes` | guild, user, author, body |

Engagement:
| Table | Notes |
|---|---|
| `xp_users` | guild, user, xp, level, messages, last_xp_at |
| `level_rewards` | guild, level, role_id |
| `reaction_roles` | guild, channel, message, emoji, role, mode (toggle/unique/verify) |
| `auto_roles` | guild, role, condition |
| `welcome_config` | guild, join/leave templates, channel, dm, autorole |
| `tags` | guild, name, content/embed, uses |
| `giveaways` / `giveaway_entries` | message, ends_at, winners, requirements |
| `reminders` | user, channel, message, run_at |
| `tickets` / `ticket_config` | guild, opener, channel/thread, status, claimed_by, transcript |
| `temp_voices` | guild, channel, owner, created_at |

Design rules: every table keyed by `(instance_id, guild_id)` from day one so one dashboard can serve multiple instances later; snowflakes stored as `text`/`bigint` strings; config as `jsonb` (validated by zod) rather than 60 columns.

---

## 6. Command framework

Build a small, opinionated framework on top of Fluxer.js — don't depend on a community "command handler", because the dashboard needs to introspect commands.

```ts
defineCommand({
  name: 'timeout',
  aliases: ['mute'],
  category: 'moderation',
  description: 'Timeout a member',
  usage: 'timeout <user> <duration> [reason]',
  args: z.object({ user: userArg(), duration: durationArg(), reason: optionalString() }),
  userPermissions: ['MODERATE_MEMBERS'],
  botPermissions: ['MODERATE_MEMBERS'],
  guildOnly: true,
  cooldown: '3s',
  run: async (ctx) => { ... },
});
```

- **Prefix resolution:** per-guild prefixes from DB (`!` default), mention prefix (`@Fluxbot ping`), multi-prefix support.
- **Fast path:** first character check before any async work; ignore bots/webhooks; drop DMs for guild-only commands. With no intents, every visible message hits the handler, so this path must allocate almost nothing.
- **Argument parsers:** mentions/IDs → member, duration (`1h30m`, `7d`), snowflake/time, quoted strings, enum choices, remainder. All reusable in dashboard command docs.
- **Permission levels:** everyone / moderator / admin / guild owner / bot operator, plus Fluxer permission bits and role-hierarchy checks before mod actions.
- **Errors:** typed errors; user gets a short reply, the bot deletes it after 8 s when it has `MANAGE_MESSAGES`, and errors go to the mod-log channel if configured.
- **No interactions, so:** paginate `help`/`leaderboard` with reactions, confirm destructive actions with ✅/❌ reactions + timeout, use DMs for anything sensitive.
- **Cooldowns:** in-memory LRU per user+command; Redis only when multi-process.
- **i18n:** per-guild locale, catalogs in `packages/i18n`; command metadata is localized in the dashboard.
- **Registry sync:** command metadata is exported as JSON at build time and stored in DB, so the dashboard can show every command, its permissions, and per-guild toggles without importing bot code.

---

## 7. Dashboard

### 7.1 Screens
1. **Setup wizard** (first run): instance URL → discovery → app ID/secret/token → validate via `GET /v1/applications/@me` → invite URL.
2. **Login** → **guild picker** (only guilds where the user is admin/mod and the bot is present, with clear states for each).
3. **Guild overview:** health, enabled modules, 7-day activity, recent cases, missing permissions, invite CTA.
4. **Modules:** cards → per-module form (channel/role pickers, toggles, thresholds).
5. **Moderation:** case table with filters, detail drawer, actions (warn/timeout/kick/ban) executed server-side, reason edit, export.
6. **Automod:** rule builder (trigger → conditions → actions), exemptions, and a **test panel** that runs a sample message through the rule engine locally.
7. **Logging:** event → channel mapping, embed customization, "send test log".
8. **Roles:** reaction-role builder (channel → message → emoji → role) and auto-role config.
9. **Levels:** curve, XP rates, multipliers, role rewards, leaderboard preview.
10. **Welcome:** template editor with variable autocomplete and live preview.
11. **Tags / custom commands:** CRUD + embed builder.
12. **Commands:** searchable list, enable/disable, permission override, cooldown, aliases.
13. **Audit log:** who changed what, with diffs.
14. **Settings:** prefix, locale, timezone, mod-log channel, muted role.
15. **Ops:** gateway status, shard, latency, version, rate-limit budget, restart hint (container-level).
16. **Embed/message builder:** send or store a message as a tag.
17. **Analytics:** command usage, member growth, mod actions, automod hits.

### 7.2 Implementation notes
- RSC + server actions for reads/writes; no client-side token handling.
- Shared pickers (`ChannelSelect`, `RoleSelect`, `MemberSelect`, `EmojiSelect`) fed by `guild_snapshots`.
- **Hand-built forms per module**, driven by zod schemas for validation. Auto-generated JSON-Schema forms look generic; use them only as a fallback for new modules.
- Optimistic UI for toggles, but never optimistic for destructive actions.
- SSE for live logs/status (Postgres LISTEN/NOTIFY; polling on SQLite).
- Empty/error states matter: bot offline, missing permissions, snapshot stale, module needs a channel.
- Mobile-friendly: server admins configure from a phone.

### 7.3 Design language
Dark-first, dense admin UI, one accent color, no gradients-for-the-sake-of-it. Fluxer's palette is purple-leaning; keep the dashboard visually distinct from the client so it doesn't look like an official feature.

---

## 8. Module specs (behavioral detail)

### 8.1 Moderation
- Case numbering per guild, immutable, with `reason`, evidence links, duration, status.
- Hierarchy checks: caller must outrank target; bot must outrank target; `ADMINISTRATOR` target is untouchable (except by owner).
- `timeout` = `PATCH member { communication_disabled_until }`; `MODERATE_MEMBERS` required; elevated-MFA guilds may need the *moderator* to have MFA — surface the `TWO_FACTOR_REQUIRED` error clearly.
- `ban`/`tempban`: `PUT /v1/guilds/{id}/bans/{user}` accepts `delete_message_seconds`? (verify at implementation), `DELETE` to unban; tempban schedules unban and re-checks that the ban still exists.
- `purge`: `POST /v1/channels/{id}/messages/bulk-delete`; older messages fall back to individual deletes; always report what actually got deleted.
- Mod-log embed: case id, action, target, moderator, reason, duration, jump link.
- DM the target on warn/timeout/kick/ban with the reason (handle DM policy failures silently).
- `!history <user>` paginates cases; `!case <n>`; `!reason <n> <text>`.

### 8.2 Automod
- Pipeline: normalize → exemptions → triggers → conditions → actions → audit.
- Triggers: regex/wordlist (compiled once), invite regex, URL + domain allow/deny, mention count, caps ratio, zalgo, duplicate hash, messages-per-N-seconds, attachment extension/size, account age (`GET user` creation snowflake timestamp).
- Actions: delete, warn, timeout (duration), kick/ban at N strikes, alert channel, log case.
- Strike decay: 1 point per hit, -1 per 24 h, ban at threshold (configurable).
- **Local simulator** in the dashboard: paste a message, see which rules fire and why — invaluable for tuning false positives.
- Raid mode: temporary stricter thresholds, auto-enabled on join burst, expires.

### 8.3 Logging
- `MESSAGE_UPDATE`: need the previous content → keep a bounded LRU of recent messages (e.g. last 200 per channel, 10 min) in bot memory; DB only if you want edit history after restarts.
- `MESSAGE_DELETE`: content is in the event — log directly, attribute to author if present.
- Member/role/channel/voice events from gateway; enrich with audit log entries where `VIEW_AUDIT_LOG` is held.
- Per-event channel routing, ignored channels/roles, embed color per event type.
- Rate-limit friendly: batch bursts, cap embeds, drop duplicates.

### 8.4 Levels
- XP per message with 60 s cooldown, length-scaled, multipliers per channel/role, ignore commands and spam.
- Curve configurable (default `5*lvl²+50*lvl+100`).
- Rank card via `@napi-rs/canvas` (bundle fonts; test on Alpine).
- Level rewards: grant/remove roles, reconciled by a job to avoid drift.

### 8.5 Reactor roles
- Dashboard creates the message (or targets an existing one), bot adds reactions and stores `(message, emoji, role)`.
- On `MESSAGE_REACTION_ADD/REMOVE`, toggle role with hierarchy check; support exclusive groups ("pick one") and verification gates.
- Requires `MANAGE_ROLES` + `ADD_REACTIONS` + `READ_MESSAGE_HISTORY`.

### 8.6 Tickets
- Prefer **private threads** under a configured parent channel (no new channel spam), fallback to text channels.
- Staff role, claim/close buttons replaced by commands + reactions.
- Transcript = rendered HTML from fetched messages; store link in DB.
- Dashboard inbox: open/closed, assigned, last activity.

### 8.7 Temp voice
- Join-to-create hub → create channel named after the user, move them in, delete when empty (with a grace period).
- Owner commands: rename, limit, lock, transfer, claim.
- No voice gateway needed; only `VOICE_STATE_UPDATE` + channel management permissions.

### 8.8 Fun/utility guardrails
- External APIs (weather, translate, Wikipedia) behind per-guild feature flags with clear privacy notes and graceful degradation.
- Image/GIF assets must be licensed for redistribution; prefer generated images (quote cards) and CSS/canvas over hotlinked GIFs.
- Every outbound embed gets a footer with the bot's name/version and a "configure" link to the dashboard.

---

## 9. Self-hosting & deployment

### 9.1 Install story (target: < 10 minutes)
```bash
git clone … fluxbot && cd fluxbot
cp .env.example .env      # instance URL, app id/secret, bot token, dashboard URL
docker compose up -d
# open https://bot.example.com/setup  (or auto-redirect if env is complete)
```

### 9.2 Compose topology
- `bot` (gateway + scheduler)
- `web` (Next.js standalone)
- `postgres` (default) **or** `sqlite` profile mounting `./data`
- optional `caddy` for TLS; optional `redis` only when scaling
- healthchecks: `/healthz` on web, bot heartbeat file / internal health port
- migrations run on boot, idempotent, with a lock

### 9.3 Environment
```
FLUXER_INSTANCE_ORIGIN=https://fluxer.example.com
FLUXER_APP_ID=...
FLUXER_CLIENT_SECRET=...
FLUXER_BOT_TOKEN=...
DASHBOARD_ORIGIN=https://bot.example.com
SESSION_SECRET=...
ENCRYPTION_KEY=...
DATABASE_URL=postgres://...
LOG_LEVEL=info
ROLE=bot|web|worker
```

### 9.4 Operational concerns
- **Backups:** `pg_dump` cron / SQLite file copy; one-click config export as JSON.
- **Upgrades:** pinned image tags, migrations forward-only, changelog, documented rollback.
- **Observability:** pino JSON logs, `/healthz` with gateway state, optional Prometheus metrics (command latency, gateway lag, rate-limit 429s, job backlog).
- **Reverse proxy:** dashboard and instance can share a host via path or subdomain; OAuth redirect must be public HTTPS. Document Pangolin/Caddy/nginx examples (the community already uses Pangolin).
- **Resource floor:** ~300 MB RAM for bot + web, 0.5 vCPU idle; document it.

### 9.5 Self-host gotchas to document
- OAuth redirect URI must be registered exactly; `http://localhost` vs `https://` mismatch is the #1 support ticket.
- Instance may run with CAPTCHA/SSO/username-only sign-in — irrelevant to API/bot auth, but explain it.
- If the instance is behind a proxy, `api_public` must be reachable from the bot container; `webapp` must be reachable from the user's browser.
- Bot token is per instance; migrating instances = new app + new token + re-invite.

---

## 10. Scaling into a public bot

Stay single-process until it hurts; the path is already in the design.

| Stage | Guilds | Shape |
|---|---|---|
| 0 | 1–50 (self-host) | bot + web, SQLite or Postgres |
| 1 | 50–2,500 | one bot process, Postgres, snapshots + config cache |
| 2 | 2,500–10k | `@fluxerjs/sharding`, shared Postgres, Redis for cache/cooldown/job locks |
| 3 | 10k+ | N shard workers + separate worker pool, read replica, analytics sampling, per-guild rate limiting |

- **Shard assignment** is stable by `guild_id % shard_count`; a shard holds ≤2,500 guilds.
- **Config invalidation** via Redis pub/sub at stage 2 (LISTEN/NOTIFY already works, but Redis is friendlier across processes).
- **Jobs** move to BullMQ with per-guild concurrency 1 to avoid mod-action races.
- **Analytics** sampled and partitioned; don't store every message.
- **Multi-instance**: `instances` table + per-instance app credentials + per-instance OAuth login. The dashboard already keys everything by instance; the public version just registers more rows.
- **Hot-path budget:** assume every visible message is parsed. Keep the prefix check synchronous and allocation-free; offload anything expensive (regex, image gen, HTTP) to the worker.

---

## 11. Security checklist

- OAuth2 `state` + PKCE, exact redirect match, no open redirects.
- Session cookies: `HttpOnly`, `Secure`, `SameSite=Lax`, rotating; short idle timeout.
- CSRF double-submit token on every mutating request.
- Server-side authorization on every action, re-derived from Fluxer permissions; never from client-supplied role/guild data.
- Secrets encrypted at rest (AES-256-GCM), never logged, never in client bundles.
- Rate-limit login/callback endpoints and dashboard mutations.
- Audit every config change and every moderation action with actor identity.
- Dependency pinning + lockfile review; `npm audit`/Dependabot; minimal dependency surface.
- Bot permissions: least privilege per module, explicit upgrade prompts.
- Don't render user-supplied markdown/HTML unsanitized in the dashboard (XSS → bot token theft is the worst case).
- Document the trust boundary: the dashboard operator effectively controls the bot.

---

## 12. Testing

| Layer | Approach |
|---|---|
| Unit | permission math, duration/arg parsers, automod rules, XP curve, template rendering |
| Contract | generate types from `GET /v1/openapi.json`; a test fails when the instance's schema drifts from our assumptions |
| Integration | fake Fluxer server (HTTP + WS) for OAuth2, gateway events, rate-limit headers; run the bot against it |
| Module tests | each module has a "scenario" test: seed DB → dispatch events → assert DB + emitted REST calls |
| Dashboard | component tests for pickers/forms; Playwright for login → configure → verify |
| Manual | a disposable guild on a dev instance, plus a scripted "smoke matrix" before releases |
| Load | synthetic MESSAGE_CREATE at target guild count; measure p99 handler time and memory |

A `docker compose -f compose.test.yml` with a stub Fluxer API keeps CI hermetic — worth the early investment.

---

## 13. Roadmap

Estimates assume one focused developer.

### Phase 0 — Decisions & scaffolding (2–3 days)
- Lock stack and repo layout, CI, lint/format, Docker dev loop, ADR for "no interactions".
- **Exit:** `docker compose up` gives an empty bot that logs in and a web app that serves a page.

### Phase 1 — Foundation (1–1.5 weeks)
- `packages/db` schema + migrations; `packages/fluxer` discovery/OAuth2/REST; instance config; setup wizard backend.
- Command framework: registry, prefix resolution, args, guards, errors, cooldowns; `ping`, `help`, `about`.
- Health endpoint, structured logs, job runner skeleton.
- **Exit:** bot connects to a self-hosted instance via discovery; `!ping` works.

### Phase 2 — Dashboard core (1.5–2 weeks)
- OAuth2 login, sessions, guild picker, authorization rules.
- Guild snapshot writer; module registry; module toggles; prefix/locale settings; command list + overrides; audit log.
- Config invalidation end-to-end.
- **Exit:** change a prefix in the dashboard, bot picks it up without restart.

### Phase 3 — Moderation + logging + automod (2.5–3.5 weeks) ← **MVP line**
- Cases, warn/timeout/kick/ban/tempban/purge, hierarchy, DM notify, mod-log.
- Logging module with per-event routing.
- Automod engine + simulator + strikes.
- Dashboard: cases, automod builder, logging config.
- **Exit:** a self-hoster can moderate and log their server entirely through the dashboard.

### Phase 4 — Utility, fun, levels, roles, welcome (2–3 weeks)
- Utility commands, tags, reminders, polls, giveaways.
- XP/rank cards/level rewards, reaction roles, auto roles, welcome templates.
- Dashboard screens for each.
- **Exit:** no reason to install a second bot for the basics.

### Phase 5 — Tickets, temp VC, analytics, custom commands (2 weeks)
### Phase 6 — Hardening & scale (2 weeks)
- Sharding + Redis path, load tests, backup/restore, docs, one-click migration SQLite→Postgres, security review.
- **Exit:** public-bot ready and self-host documented.

**v1.0 target: end of Phase 6 (~11–14 focused weeks).** MVP (Phase 3) is a genuinely useful bot (~5–6 weeks).

---

## 14. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Fluxer API is young (`api_code_version: 1`) and may change | Medium | Pin SDK, generate types from OpenAPI, contract tests, keep `packages/fluxer` as the only protocol-aware layer |
| No slash commands → poor discoverability | High | Great `!help`, reaction pagination, dashboard command reference, onboarding message |
| No buttons/modals → clunky multi-step flows | High | Keep complex flows in the dashboard; in-chat flows are 1–2 steps max |
| Self-hosted instance differences (no email, CAPTCHA, SSO, proxy) | Medium | Discovery-driven, feature flags, explicit error messages, docs |
| SQLite write contention (bot + web) | Medium | WAL + single writer + retry; recommend Postgres above ~20 guilds; provide migration path |
| Dashboard is a high-value target (bot token) | Medium | Strict server-side authz, short sessions, encrypted secrets, audit trail, no token in client |
| Voice/music expectations | High | Explicitly out of scope in v1; document why |
| Moderation false positives | Medium | Simulator, exemptions, strike decay, dry-run mode |
| AGPL/branding | Low | We consume the API, not fork the server; don't use Fluxer marks as our own |

---

## 15. Decisions I need from you

1. **Stack:** TypeScript/Next.js as above, or do you want Python/Go for the bot and/or a SvelteKit dashboard?
2. **DB default:** Postgres in Compose (recommended, one more container) or SQLite-first for the simplest possible install?
3. **Target:** single self-hosted instance only, or should v1 also work as a public bot on `fluxer.app`? (Schema supports both; effort differs.)
4. **Module priority:** moderation/logging/automod first (recommended for an MVP), or fun/levels/engagement first?
5. **Dashboard auth extras:** pure Fluxer OAuth2, or also a local emergency password for the instance owner?
6. **License:** MIT/Apache-2.0 (max adoption) or AGPL-3.0 (copyleft, matches Fluxer)?

---

## Appendix A — Reference links

- Fluxer docs home — <https://docs.fluxer.app>
- Instance discovery — <https://docs.fluxer.app/http-api/instance/>
- Authentication & token formats — <https://docs.fluxer.app/authentication/>
- OAuth2 (scopes, PKCE, lifetimes) — <https://docs.fluxer.app/http-api/oauth2/>
- Applications & bot tokens — <https://docs.fluxer.app/http-api/applications/>
- Gateway overview — <https://docs.fluxer.app/gateway/overview/>
- Event filtering (no intents) — <https://docs.fluxer.app/gateway/event-filtering/>
- Guilds & OAuth2 `guilds` scope — <https://docs.fluxer.app/http-api/guilds/>
- Roles & permissions — <https://docs.fluxer.app/http-api/permissions/>
- Rate limits — <https://docs.fluxer.app/topics/rate-limits/>
- Deployment availability (self-host differences) — <https://docs.fluxer.app/http-api/deployment-availability/>
- Fluxer.js docs — <https://fluxer.js.org>
- Fluxer.js self-host/multi-instance — <https://fluxer.js.org/guides/multi-instance/>
- awesome-fluxer — <https://github.com/awesome-fluxer/awesome-fluxer>
- Astrokat (prior art, self-hostable, no dashboard) — <https://github.com/mizarc/astrokat>
- Fluxer dev cheatsheet — <https://github.com/bizojs/fluxer-dev-cheatsheet>
