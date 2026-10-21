# Security policy

## Reporting a vulnerability

Please use GitHub's **private vulnerability reporting** on this repository
(Security → Report a vulnerability). Do not open a public issue.

Include the affected version/commit, a description, reproduction steps, and the
impact you believe it has. We aim to acknowledge reports within a few days.

## Supported versions

| Version | Supported |
|---|---|
| `main` | ✅ |
| tagged releases | best effort |

Fluxbot is pre-1.0. Fixes land on `main` and in the next tag.

## Threat model

The dashboard is an administrative surface: anyone who can use it can change how
the bot behaves in a guild. Treat it like an admin panel.

- **Dashboard operators are trusted for the guilds they administer.** Access is
  derived from Fluxer's `MANAGE_GUILD` / `ADMINISTRATOR` permissions, re-checked
  from cached masks on every request and refreshed from the instance every five
  minutes.
- **The bot token is a high-value secret.** It is configured per instance and can
  act in every guild the bot has joined. It is never sent to the browser.
- **The instance operator is trusted.** On a self-hosted deployment, the person
  running Postgres and the containers can read everything.
- **Guild members are untrusted.** Command arguments, channel names, role names
  and messages are treated as text; they are not evaluated as code.

## Hardening checklist

- Serve the dashboard over HTTPS. Session cookies are marked `Secure` when
  `DASHBOARD_ORIGIN` starts with `https://`.
- Use unique, random values for `SESSION_SECRET`, `ENCRYPTION_KEY` and the
  Postgres password.
- Keep `.env` out of images and backups that leave your control.
- Do not enable `DEMO_MODE` in production.
- Restrict dashboard access with your reverse proxy (SSO, basic auth, VPN) if it
  should not be public.
- Rotate the Fluxer client secret and bot token if they leak; update `.env` and
  restart.
- Back up Postgres and the `.env` file together: a database backup alone cannot
  decrypt stored OAuth tokens without `ENCRYPTION_KEY`.

## What Fluxbot stores

- Fluxer user IDs, usernames, display names and avatars for dashboard accounts.
- Guild IDs, names, icons, channels and roles (snapshots).
- OAuth2 access and refresh tokens, encrypted with AES-256-GCM
  (`ENCRYPTION_KEY`).
- Session tokens hashed with SHA-256; the raw value only exists in the browser
  cookie.
- Configuration, audit entries, XP and role mappings.

No message content is stored by the engagement modules. Future logging features
will document their retention explicitly.

## Dependency policy

Dependencies are pinned in `pnpm-lock.yaml` and reviewed through CI. Prefer the
platform (`fetch`, `node:crypto`) over new packages, especially in the
authentication path.
