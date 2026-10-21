# Discord ↔ Fluxer bridge — design

**Status:** planned (`v0.5`), not implemented. This document is the technical
design and a record of the constraints that shaped it.

The goal is channel mirroring between a Fluxer guild and a Discord guild,
configured per channel from the Fluxbot dashboard:

> Discord `#general` ⇄ Fluxer `#general`, with each message keeping its author's
> display name and avatar.

## 1. Webhooks are the presentation layer, not the transport

The obvious idea — “just use webhooks” — is half right. Webhooks are excellent at
**egress**: they can post into a channel with a per-message name and avatar, and
their messages can be edited and deleted through a token-scoped route. They cannot
**receive** anything: there is no inbound event for a webhook, and no webhook can
add a reaction.

| Capability | Fluxer webhook | Discord webhook |
|---|---|---|
| Post a message | ✅ `POST /v1/webhooks/{id}/{token}` | ✅ `POST /webhooks/{id}/{token}` |
| Per-message display name | ✅ `username` (1–80) | ✅ `username` |
| Per-message avatar | ✅ `avatar_url` (≤ 2,048 chars) | ✅ `avatar_url` |
| Attachments | ✅ multipart `files[n]` | ✅ multipart `files[n]` |
| Post into a thread | ✅ `thread_id` query | ✅ `thread_id` query |
| Create a forum post | ✅ `thread_name` + `applied_tags` | ✅ `thread_name` + `applied_tags` |
| Return the created message | ✅ `wait=true` | ✅ `wait=true` |
| Edit / delete its own messages | ✅ token-scoped message routes | ✅ token-scoped message routes |
| Receive messages | ❌ | ❌ |
| Add reactions | ❌ | ❌ |
| Join voice | ❌ | ❌ |

Therefore:

- **Ingress = bots on both platforms.** Fluxer bots receive every visible message
  (no intents). Discord bots need the privileged **Message Content Intent** to read
  message text.
- **Egress = webhooks on both platforms.** One webhook per linked channel is enough,
  because name and avatar are overridden per message.

Both platforms also emit a `MESSAGE_CREATE`-style event for webhook-authored
messages. That is the main loop risk, and it is why webhook IDs must be persisted
and filtered.

## 2. Architecture

```
        Discord guild A                          Fluxer guild B
        ┌──────────────┐                         ┌──────────────┐
        │  #general    │                         │  #general    │
        └──┬────────▲──┘                         └──┬────────▲──┘
           │        │                               │        │
  gateway  │        │ webhook execute     webhook    │        │ gateway
  events   │        │ (name/avatar)       execute    │        │ events
           ▼        │                               ▼        │
        ┌──────────────────────────────────────────────────────┐
        │              bridge relay (Fluxbot)                  │
        │  link config · identity map · queues · idempotency   │
        │  attachment fetch/re-upload · edit/delete mapping    │
        └──────────────────────────────────────────────────────┘
```

The relay is intentionally its own package (`packages/bridge` or
`packages/discord`) so the Fluxer-only deployment does not pull a Discord library
into its dependency graph.

A link is a pair of channels plus a direction:

```
fluxer_channel ──► discord_channel   (Discord webhook)
fluxer_channel ◄── discord_channel   (Fluxer webhook)
```

Both directions use the same relay, with platform-specific adapters:

- `FluxerAdapter`: gateway events in, webhook execute/edit/delete out, signed media
  downloads, 4,000-character messages.
- `DiscordAdapter`: gateway events in, webhook execute/edit/delete out, CDN
  downloads, 2,000-character messages.

## 3. Message flow

### Discord → Fluxer

1. Discord gateway emits a message in a linked channel.
2. Drop it if the author is a bot, a webhook, or one of our bridge webhooks.
3. Resolve the link, direction and any channel filters.
4. Download attachments that fit the size policy.
5. Split or truncate content to the Fluxer limit, convert embeds.
6. `POST /v1/webhooks/{id}/{token}?wait=true` with `username`, `avatar_url`,
   `content`, converted `embeds`, `files[n]`, and `thread_id` when the link maps a
   thread.
7. Persist `bridge_messages` (source id, target id, webhook id) in the same
   transaction that records the queue item as done.

### Fluxer → Discord

Symmetric, with `username`/`avatar_url` on the Discord webhook, a 2,000-character
budget, and Discord's attachment limits. Fluxer attachment URLs are signed and
expire (`ex`, `is`, `hm` query parameters), so they must be downloaded and
re-uploaded — never handed to Discord as a URL.

### Edits and deletes

- `MESSAGE_UPDATE` / `MESSAGE_DELETE` on either side → look up `bridge_messages` →
  edit or delete the mirrored message through the **webhook token route**, not
  through the bot. Bots cannot edit other authors' messages, and webhook messages
  are owned by the webhook.
- If the mirrored message was a fallback bot post (for example a system message),
  edit/delete only if the bot authored it; otherwise record that the mirror is
  stale.
- Missing mapping = ignore the event.

## 4. Sync semantics

| Event | v0.5.0 | v0.5.1 | Notes |
|---|---|---|---|
| Text message | ✅ | | Split at platform limits |
| Embeds | ✅ | | Convert a common subset |
| Attachments | ✅ | | Re-upload; size policy |
| Replies | | ✅ | Fluxer supports reply references on webhook execute; Discord does not, so fall back to a quoted line |
| Threads | | ✅ | Map thread IDs; create via bot when needed |
| Edits | | ✅ | Webhook token route |
| Deletes | | ✅ | Webhook token route |
| Reactions | | | Webhooks cannot react; bots can, but attribution becomes the bot |
| Pinned messages | | | Optional notification later |
| Custom emoji | | | Translate names where both platforms have the emoji; otherwise text |
| System messages | | | Join/leave/boost noise is skipped by default |
| DMs | ❌ | | Never bridged |
| Voice / presence | ❌ | | Out of scope |

## 5. Identity

One webhook per channel, overridden per message:

```
username: author display name (platform-safe, ≤ 80 chars)
avatar_url: author avatar URL (≤ 2,048 chars)
```

Fallbacks:

- No avatar → omit `avatar_url`; the webhook's own avatar is used.
- Name collisions → append the source platform's discriminator or a short tag when
  the guild enables it.
- Bots and webhooks are not bridged by default (prevents bot-on-bot loops).
- An optional `bridge_identities` table can keep a stable display name/avatar for
  people who appear on both platforms, so a nickname change does not fragment their
  history.

## 6. Attachments and limits

- Download and re-upload; do not pass expiring signed URLs between platforms.
- Fluxer limits come from instance discovery (`max_attachments_per_message`,
  default 10); Discord's limits depend on the guild tier.
- Files above the target limit are omitted with a short “attachment omitted (too
  large)” line rather than posting a dead link.
- Image embeds and thumbnails: re-upload when small enough, otherwise drop the
  media and keep the embed text.
- Content limits differ (Fluxer bot/webhook authors get 4,000 characters; Discord
  webhooks get 2,000), so the relay splits long messages into ordered parts and
  records all target IDs for edit/delete fan-out.

## 7. Ordering, rate limits and retries

- One FIFO queue per link, concurrency 1, so messages cannot overtake each other.
- Fluxer webhook execution is exempt from the global bucket but still has a
  per-webhook bucket; Discord has per-webhook limits and a small webhook cap per
  channel.
- On `429` or `5xx`: honor `Retry-After`, retry with exponential backoff, then
  drop after a bounded number of attempts and surface the failure in the dashboard
  and audit log.
- Webhook creation is lazy: a link provisions its webhooks on first use, so a
  disabled link consumes none of the per-channel webhook cap.

## 8. Loop prevention and idempotency

1. Every webhook the bridge creates is recorded (`webhook_id`).
2. Incoming messages whose `webhook_id` matches a recorded bridge webhook are
   dropped.
3. Incoming messages from the bridge bots themselves are dropped.
4. `bridge_messages` has a unique constraint on
   `(link_id, source_platform, source_message_id)`, so a duplicate delivery — or a
   retry after a timeout — cannot create a second mirrored message.
5. Fluxer webhook `nonce` deduplicates within five minutes; Discord has no webhook
   nonce, so the database constraint is the source of truth.
6. Edits and deletes never create messages, so they are idempotent by message ID.

## 9. Permissions and setup

Fluxer side:

- Bot needs `VIEW_CHANNEL`, `SEND_MESSAGES`, `EMBED_LINKS`, `ATTACH_FILES`,
  `READ_MESSAGE_HISTORY`, `MANAGE_WEBHOOKS`, and thread permissions if threads are
  bridged.
- `MANAGE_WEBHOOKS` is only needed to provision the webhook; an operator can paste
  a webhook URL instead for least privilege.

Discord side:

- Bot needs View Channel, Send Messages, Embed Links, Attach Files, Read Message
  History, Manage Webhooks, plus thread permissions if needed.
- The **Message Content Intent** must be enabled in the Discord developer portal.
  It is privileged: bots in more than 100 guilds need Discord's verification. This
  is the single biggest operational gate for a *public* bridge.
- Discord's developer policy prohibits self-bots; the bridge uses a real bot
  application.

## 10. Security

- Webhook tokens are bearer credentials. Encrypt at rest with `ENCRYPTION_KEY`,
  never send them to the browser, never log them, and treat pasted webhook URLs as
  secrets.
- Links are opt-in per guild and per channel, and disabled by default.
- The dashboard checks the actor's Fluxer `MANAGE_GUILD`; for Discord, the actor
  must prove Manage Server through Discord OAuth (`identify guilds`) or by
  inviting the bot and passing a verification step.
- Content crossing platforms is subject to the destination's rules and moderation.
  The link UI must say so.
- No DMs, no private channels by default, and no bridging of NSFW channels unless
  explicitly enabled on both sides.
- Per-guild quotas and a kill switch (disable the link, or the whole bridge) are
  required before a hosted rollout.

## 11. Data model sketch

```
bridge_links
  id, guild_id → guilds
  fluxer_channel_id, discord_guild_id, discord_channel_id
  direction ('both' | 'fluxer_to_discord' | 'discord_to_fluxer')
  enabled, filters jsonb
  fluxer_webhook_id, fluxer_webhook_token_enc
  discord_webhook_id, discord_webhook_token_enc
  created_by, created_at

bridge_messages
  id, link_id → bridge_links, direction
  source_platform, source_message_id
  target_platform, target_message_id
  webhook_id, created_at, edited_at, deleted_at
  UNIQUE (link_id, source_platform, source_message_id)

bridge_threads
  link_id, discord_thread_id, fluxer_thread_id

bridge_identities            -- optional, for stable display names
  guild_id, fluxer_user_id, discord_user_id, display_name, avatar_url
```

Webhook tokens are the only secrets here; everything else is public identifiers.

## 12. Self-hosted vs hosted

**Self-hosted (first).** The operator configures `DISCORD_BOT_TOKEN` in `.env`,
creates both applications, and links channels by ID. No Discord OAuth is needed
beyond inviting the bot. This is the lowest-risk release and matches Fluxbot's
self-host-first goal.

**Hosted (later).** A shared Discord bot owned by the Fluxbot operator:

- Discord OAuth (`identify` + `guilds`) proves Manage Server in the linked guild.
- One shared bot has one Message Content Intent, one verification story, and one
  rate-limit budget.
- Quotas, abuse handling and a per-guild kill switch become mandatory.
- Discord requires `bot_public` installation; the invite link is generated by the
  dashboard.

Keeping these as separate milestones avoids blocking the self-hosted bridge on
Discord verification.

## 13. Testing plan

- Unit: content splitting, embed conversion, attachment policy, loop detection,
  idempotency keys, identity fallbacks.
- Integration: a fake Discord gateway + webhook server alongside
  `scripts/fake-fluxer.mjs`; send messages both ways and assert exactly one webhook
  call each and no echo.
- Contract: verify webhook payloads against both platform docs/schemas.
- Manual: a staging pair of guilds; edit, delete, reply, thread, attachment and
  429 behaviour.
- Load: per-link queue throughput and backoff under a burst.

## 14. Risks and open questions

| Risk | Mitigation |
|---|---|
| Discord Message Content Intent verification at scale | Ship self-hosted first; hosted mode after verification |
| Webhook rate limits and per-channel caps | One webhook per link, lazy provisioning, per-link queues |
| Signed media URLs expiring | Always download and re-upload; never forward URLs |
| Content length mismatch | Split with ordered parts and edit/delete fan-out |
| Echo loops | Persist webhook IDs, filter bots, unique mapping rows |
| Webhook token leakage | Encryption at rest, no client exposure, audit access |
| Platform policy | Real bot applications, opt-in links, destination warnings |

Open questions to resolve during implementation:

- Whether Fluxer exposes a hard webhook-per-channel cap in instance discovery.
- Whether reply references work on Fluxer webhook execute in all channel types.
- Discord webhook behaviour in announcement channels and forums.
- Whether reaction sync is worth the attribution loss (bots can react; webhooks
  cannot).
- Hosted quota model and abuse reporting.

## 15. References

- Fluxer webhooks — <https://docs.fluxer.app/http-api/webhooks/>
- Fluxer rate limits — <https://docs.fluxer.app/topics/rate-limits/>
- Fluxer instance discovery (attachment limits) — <https://docs.fluxer.app/http-api/instance/>
- Discord webhooks — <https://discord.com/developers/docs/resources/webhook>
- Discord message content intent — <https://discord.com/developers/docs/topics/gateway#message-content-intent>
- Prior art: Fluxcord (<https://fluxcord.jbcrn.dev/>), Bifröst
  (<https://github.com/KartoffelChipss/bifrost>), Bolt
  (<https://williamhorn.ing/bolt>), Orax (<https://oraxbot.com>)
