# Architecture

Fluxbot is a small monorepo with one rule: **only `packages/fluxer` knows the
Fluxer protocol**.

```
                    ┌──────────────────────────────┐
  Fluxer instance   │  apps/bot (Node, tsx)        │
  ┌────────────┐    │  ├─ Gateway (1 shard)        │
  │  HTTP API  │◄───┼──┤  ├─ command runtime        │
  │  Gateway   │◄───┼──┤  ├─ XP / reaction handlers │
  │  Media     │◄───┼──┤  └─ scheduler              │
  └────────────┘    │  └─ config cache             │
        ▲           └───────────┬──────────────────┘
        │                       │  Postgres
        │           ┌───────────▼──────────────────┐
        │           │  apps/web (Next.js)          │
        └───────────┤  ├─ OAuth2 login/callback    │
     OAuth2 + REST  │  ├─ dashboard (RSC + actions)│
      (user token)  │  └─ /api/health              │
                    └──────────────────────────────┘
```

## Packages

| Package | Responsibility |
|---|---|
| `packages/fluxer` | Instance discovery, OAuth2 + PKCE, token refresh, permission bits, invite URLs, bot REST helpers |
| `packages/db` | Drizzle schema, migrations, repositories, `LISTEN/NOTIFY` helpers |
| `packages/core` | Command types, argument parser, prefix parser, cooldowns, crypto, logger, config validation |
| `packages/modules` | Levels, fun and roles modules; the pure command catalog used by the dashboard |
| `apps/bot` | Gateway client, runtime context, event wiring, scheduler |
| `apps/web` | Dashboard, auth, server actions, audit UI |

`packages/modules/catalog` and `packages/modules/config` are intentionally free
of database and SDK imports, so the web app can render the command list and
validate forms without pulling the bot runtime.

## Request and event flow

### Dashboard login

1. `/auth/login` creates a PKCE verifier and a signed state cookie.
2. The browser is sent to `endpoints.webapp/oauth2/authorize` with
   `scope=identify guilds`.
3. Fluxer returns to `/auth/callback`; the code is exchanged server-side with the
   client secret.
4. `GET /oauth2/userinfo` identifies the user; `GET /users/@me/guilds?limit=100`
   returns each guild with the caller's **complete permission mask**.
5. Guilds and masks are stored in `guilds` / `guild_members`; a random session
   token is stored hashed, and the raw token goes into an HttpOnly cookie.

The browser never receives the client secret, the bot token, or the OAuth access
token. Every dashboard action re-derives authorization from the stored mask and
rejects anything below `MANAGE_GUILD` (or `ADMINISTRATOR`).

Permissions are refreshed from Fluxer when the cached mask is older than five
minutes. The OAuth access token is refreshed transparently; refresh tokens rotate,
so the new pair is persisted.

### Commands

```
MESSAGE_CREATE
  → ignore bots/webhooks, resolve guild row + prefix (cached)
  → prefix / mention parse (fast path)
  → XP handler (plain chat)
  → command lookup by name or alias
  → per-guild settings (enabled, permission level, cooldown)
  → user permissions, bot permissions, cooldown
  → argument parsing (members, roles, durations, choices, rest)
  → run
```

Fluxer has no intents and no privileged message-content gate, so every visible
message arrives. The prefix check happens before any database work and allocates
very little; this is the hottest path in the bot.

Commands are prefix-based because Fluxer exposes no application commands,
buttons or modals. Interactive flows use reactions (pagination, confirmations);
everything stateful belongs in the dashboard.

### Configuration invalidation

```
dashboard → setGuildConfig
          → INSERT/UPDATE guild_configs
          → guilds.config_revision += 1
          → pg_notify('fluxbot_config', '<guild uuid>:<revision>')
bot       → LISTEN callback
          → drop module configs for that guild
          → drop the guild prefix cache entry
```

The bot also has a 60-second TTL as a safety net if a notification is missed.

### Permissions

`packages/fluxer/permissions.ts` mirrors Fluxer's 64-bit permission flags. The
dashboard uses them to:

- decide who may open a guild,
- compute the least-privilege invite URL from enabled modules,
- display the caller's effective permissions.

The bot still performs its own checks before acting (role hierarchy, `MANAGE_ROLES`,
`MODERATE_MEMBERS`, and so on). The API is always the source of truth.

## Database

| Area | Tables |
|---|---|
| Core | `instances`, `users`, `sessions`, `guilds`, `guild_members` |
| Configuration | `guild_configs`, `guild_snapshots`, `command_settings` |
| Engagement | `xp_users`, `level_rewards`, `reaction_roles`, `auto_roles`, `self_roles` |
| Operations | `audit_log`, `bot_status`, `scheduled_jobs`, `analytics_events` |

Every guild-scoped row is keyed by the local guild UUID, which itself belongs to
an instance row. That keeps a future multi-instance public bot possible without a
schema migration: today one deployment serves one instance, but the data model
already distinguishes them.

Snowflakes are stored as `text`, never JavaScript numbers.

## Scaling

The first scale step is vertical: one process, one shard, up to 2,500 guilds (the
Fluxer gateway closes a shard above that with code 4011). After that:

1. **Postgres + sharding.** `@fluxerjs/sharding` (and its Redis lease package)
   splits guilds across processes. `guild_id % shard_count` is stable.
2. **Redis.** Move cooldowns, job locks and pub/sub off Postgres. The interfaces
   already isolate these concerns.
3. **Worker pool.** The scheduler claims jobs with
   `FOR UPDATE SKIP LOCKED`, so `ROLE=worker` replicas are safe to add.
4. **Analytics sampling.** `analytics_events` is append-only; sample or partition
   it as message volume grows.

The dashboard is stateless apart from Postgres and can run multiple replicas
behind a load balancer.

## Testing

- `packages/fluxer`: PKCE vector, discovery parsing, URL composition, permission math.
- `packages/core`: tokenizer, durations, argument parsing, prefix parsing, crypto, cooldowns.
- `packages/modules`: XP curve inversion, catalog/command drift, alias uniqueness.
- `apps/bot`: command index and permission levels.
- `scripts/fake-fluxer.mjs`: a local fake instance that exercises the full
  gateway → command → REST loop without a Fluxer deployment.

## Protocol references

- [Instance discovery](https://docs.fluxer.app/http-api/instance/)
- [Authentication](https://docs.fluxer.app/authentication/)
- [OAuth2 scopes and grants](https://docs.fluxer.app/http-api/oauth2/)
- [Gateway overview](https://docs.fluxer.app/gateway/overview/)
- [Event filtering (no intents)](https://docs.fluxer.app/gateway/event-filtering/)
- [Guilds and the `guilds` scope](https://docs.fluxer.app/http-api/guilds/)
- [Roles and permissions](https://docs.fluxer.app/http-api/permissions/)
