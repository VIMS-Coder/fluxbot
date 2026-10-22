# Roadmap

Fluxbot is built in small, shippable phases. This file is the public plan; the
technical design for larger features lives in `docs/`.

Status legend: ✅ shipped · 🚧 next · 📋 planned · 💭 exploratory

## v0.1 — Engagement (shipped)

Levels, fun and roles, plus the dashboard foundation.

- Instance discovery for any Fluxer deployment
- OAuth2 dashboard login (`identify` + `guilds`), permission-derived access
- Levels: XP, curve, cooldowns, announcements, role rewards, rank, leaderboard
- Fun: dice, coinflip, 8-ball, choose, ship
- Roles: reaction roles, auto-roles, self-assignable roles
- Per-command settings, audit log, bot heartbeat, command analytics
- Docker Compose deployment, CI, fake-instance smoke test

See [CHANGELOG.md](CHANGELOG.md) for details.

## v0.2 — Moderation 🚧

Cases, timeout, kick, ban, tempban, softban, unban, purge, slowmode, lock/unlock,
case history, DM notifications and a mod-log channel.

## v0.3 — Logging & automod 📋

Message/member/channel/voice logs with per-event routing. An automod rule engine
(links, invites, words, mentions, caps, spam, raid mode) with a dashboard
simulator and a strike system.

## v0.4 — Community ✅ shipped

Welcome/leave messages with variables, reaction giveaways with timed draws,
private-thread support tickets, and join-to-create temporary voice channels.
Configured from the **Community** page in the dashboard.

Shipped before moderation and logging by request; those remain the next phases.

## v0.5 — Bridges: Discord ↔ Fluxer 📋

Two-way channel mirroring between a Fluxer guild and a Discord guild, configured
per channel from the Fluxbot dashboard.

- **Ingress:** both bots receive messages over their gateways (Discord requires the
  privileged **Message Content Intent**).
- **Egress:** webhooks on both platforms repost with the original display name and
  avatar, including edits and deletes through webhook token routes.
- **Never webhooks alone:** neither platform lets a webhook *receive* messages or
  add reactions, so webhooks are the presentation layer, not the transport.

Full design, data model, sync semantics and phasing:
**[docs/discord-bridge.md](docs/discord-bridge.md)**.

### v0.5.0 — First usable bridge

- Bridge link model and dashboard page (Fluxer channel ↔ Discord channel)
- Automatic webhook provisioning and encrypted token storage
- Text, embeds and attachments in both directions
- Loop prevention, per-channel ordering and retry/backoff
- One-way mode and per-direction filters

### v0.5.1 — Fidelity

- Edit and delete propagation
- Replies and thread mapping
- Identity mapping (stable names/avatars across platforms)
- Attachment limits and graceful link fallbacks

### v0.5.2 — Hosted bridge mode

- A shared Discord bot with Discord OAuth for server admins
- Webhook reuse across links, per-guild limits
- Reaction sync if the platform APIs allow it with bot accounts

### Not planned for the bridge

Voice, presence, DMs, stickers, custom-emoji translation, and server-member sync.
These are either unsafe, noisy, or impossible without broad privileged access.

## v1.0 — Scale & multi-instance 📋

- Sharding (`@fluxerjs/sharding`) and Redis-backed cooldowns, locks and pub/sub
- Worker pool for jobs, partitioned analytics
- Multiple Fluxer instances in one deployment (schema already keys by instance)
- i18n for the dashboard and bot messages
- Backup/restore tooling and a migration path from SQLite (if added)

## Exploratory 💭

- **Music/voice:** blocked on Fluxer's voice APIs stabilising; the Fluxer.js voice
  package is still documented as changing.
- **AI chat:** opt-in per channel, bring-your-own API key, with clear privacy and
  cost controls.
- **Other platforms:** the bridge design is intentionally platform-pair based; a
  generic relay abstraction could add Matrix, Stoat or Telegram later if there is
  demand.

## How priorities are chosen

1. Self-hosting stays first-class: no feature may require a hosted service.
2. Anything that changes guild state must be reversible and audited.
3. New modules ship with a dashboard surface and tests, or they do not ship.
4. Bridges and other integrations are opt-in per guild and off by default.
