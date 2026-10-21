# Changelog

All notable changes to Fluxbot are documented here. The format loosely follows
[Keep a Changelog](https://keepachangelog.com/) and [SemVer](https://semver.org/).

## [Unreleased]

### Added

- Public `/privacy` and `/terms` pages. Operator name, contact email and support URL
  are configurable with `OPERATOR_NAME`, `OPERATOR_CONTACT_EMAIL` and
  `OPERATOR_SUPPORT_URL`.
- `ROADMAP.md` covering the phases through v1.0, including the Discord ↔ Fluxer
  bridge.
- `docs/discord-bridge.md`: design for opt-in channel mirroring using bot ingress
  and webhook egress, with sync semantics, data model, security and phasing.

### Changed

- The landing page, login page, server picker and guild sidebar link to the legal
  pages.
- The README links to the roadmap and the bridge design.

## [0.1.0] — 2026-10-22

First public release. Engagement-first: levels, fun and roles, with a dashboard
that works against any Fluxer instance.

### Added

- **Instance discovery** via `/.well-known/fluxer`. The bot and dashboard use the
  deployment's public API, gateway, media and web-app endpoints instead of
  hardcoded hosts.
- **Dashboard authentication** with Fluxer OAuth2 (authorization code + PKCE,
  `identify` and `guilds` scopes), server-side token exchange, refresh-token
  rotation, encrypted token storage and hashed session tokens.
- **Guild authorization** derived from the caller's Fluxer permission mask,
  refreshed from the instance when stale.
- **Levels module:** XP per message with cooldown, configurable quadratic curve,
  ignored channels/roles, level-up announcements, role rewards, `!rank`,
  `!leaderboard`, `!rewards` and admin `!xp`.
- **Fun module:** `!dice`/`!roll`, `!coinflip`, `!8ball`, `!choose`, `!ship` with
  per-command toggles.
- **Roles module:** reaction roles (toggle and pick-one), join auto-roles,
  self-assignable roles (`!roles`, `!iam`, `!iamnot`).
- **Core commands:** `!help`, `!ping`, `!about`, `!prefix`.
- **Dashboard pages:** server picker, overview, levels, fun, roles, commands,
  audit log, settings, and a health endpoint.
- **Per-guild command settings:** enable/disable, permission level and cooldown
  override.
- **Reactive configuration:** Postgres `LISTEN/NOTIFY` invalidates the bot's
  config and prefix cache on save.
- **Audit log** with actor, action and before/after JSON.
- **Bot heartbeat** (`bot_status`) and 7-day command analytics.
- **Deployment:** multi-stage Dockerfile with `bot`, `web` and `migrate` roles,
  Docker Compose with Postgres, health checks and migration ordering.
- **Developer tooling:** fake Fluxer instance for end-to-end smoke tests, demo
  mode for the dashboard, Biome, strict TypeScript, Vitest and GitHub Actions.
- **Documentation:** self-hosting guide, architecture notes, command reference,
  contributing and security policy.

### Verified

- 73 unit tests across the protocol layer, command framework and modules.
- Production dashboard build, demo login and every dashboard page rendered.
- Bot connected to a fake instance, joined a guild, answered commands and granted
  XP; a live prefix change was picked up without a restart.
- The packaged container ran both the web and bot roles against Postgres.

### Known limitations

- Fluxer has no application commands, buttons or modals, so interaction is
  prefix-based and configuration lives in the dashboard.
- Moderation, logging and automod are not implemented yet.
- One instance per deployment; a multi-instance public-bot mode is planned.
- Voice/music is not implemented.
