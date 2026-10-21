# Self-hosting Fluxbot

Fluxbot runs as two processes — a bot and a web dashboard — plus Postgres. Docker
Compose is the supported path.

## Requirements

- Docker Engine 24+ with Compose v2, or Podman with `podman-compose`
- A Fluxer instance you can create applications on (hosted or self-hosted)
- A domain or IP for the dashboard, reachable by the people who will use it

## 1. Create the application on your Fluxer instance

1. Open your Fluxer client and go to **User Settings → Applications**.
2. Create an application. This also creates the bot account; its user ID equals
   the application ID.
3. Copy the **bot token** and the **client secret**. Both are shown once.
4. Add a redirect URI under the application settings:
   `https://bot.example.com/auth/callback`
   For local testing: `http://localhost:3000/auth/callback`.
   The match is byte-for-byte — same scheme, host, port, path, and no trailing
   slash differences.

Fluxer is a self-hostable platform: the application, its token and its users
belong to *your* instance. Tokens are not portable between instances.

## 2. Configure

```bash
git clone https://github.com/martintondel02/fluxbot.git
cd fluxbot
cp .env.example .env
```

Edit `.env`:

| Variable | Example | Notes |
|---|---|---|
| `FLUXER_INSTANCE_ORIGIN` | `https://fluxer.example.com` | The deployment origin, not the API path |
| `FLUXER_APP_ID` | `1501314428688998182` | Application ID |
| `FLUXER_CLIENT_SECRET` | … | Server-side only |
| `FLUXER_BOT_TOKEN` | `1501314428688998182.…` | Bot token |
| `DASHBOARD_ORIGIN` | `https://bot.example.com` | Must match the redirect URI base |
| `SESSION_SECRET` | `openssl rand -base64 32` | Signs session cookies |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` | Encrypts stored OAuth tokens |
| `POSTGRES_PASSWORD` | `openssl rand -base64 24` | Used by Compose |
| `WEB_PORT` | `3000` | Host port for the dashboard |

Leave `DATABASE_URL` as-is: Compose overrides it with the `postgres` hostname.

## 3. Start

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f migrate   # migrations should finish successfully
```

Open `DASHBOARD_ORIGIN`, sign in with Fluxer, pick a server, and invite the bot
with the link the dashboard generates. The invite only requests the permissions
for the modules you enabled.

## 4. Reverse proxy and TLS

The dashboard must be served over HTTPS in production (cookies are marked
`Secure` when `DASHBOARD_ORIGIN` starts with `https://`).

### Caddy

```caddyfile
bot.example.com {
  reverse_proxy 127.0.0.1:3000
}
```

### nginx

```nginx
server {
  listen 443 ssl;
  server_name bot.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

If your Fluxer instance is behind Pangolin, Newt or another tunnel, the same
applies to the dashboard: publish `WEB_PORT` and point the proxy at it. The bot
needs outbound access to the instance's public API and gateway URLs.

## 5. Backups

Everything lives in Postgres.

```bash
docker compose exec postgres pg_dump -U fluxbot fluxbot > fluxbot-backup.sql
```

Restore:

```bash
cat fluxbot-backup.sql | docker compose exec -T postgres psql -U fluxbot fluxbot
```

The `.env` file holds the credentials needed to use that backup. Back it up
separately, in a secret manager.

## 6. Upgrades

```bash
git pull
docker compose up -d --build
```

The `migrate` service applies forward-only migrations before the bot and web
containers start. Pin image tags/digests if you prefer controlled rollouts.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `Invalid login state` | The OAuth cookie expired (10 min) or `SESSION_SECRET` changed between login and callback. Start again. |
| `redirect_uri` mismatch | The URI registered on the application differs from `DASHBOARD_ORIGIN/auth/callback`. Check scheme, port and trailing slash. |
| `Could not reach https://…/.well-known/fluxer` | `FLUXER_INSTANCE_ORIGIN` points at the API path instead of the deployment origin, or the instance is unreachable from the container. |
| Bot shows offline | `FLUXER_BOT_TOKEN` is wrong, or the bot container cannot reach `endpoints.gateway`. Check `docker compose logs bot`. |
| Empty channel/role pickers | The bot has not received the guild snapshot yet. It writes one on join; restart the bot or wait for a channel change. |
| `You need Manage Server` | Dashboard access is derived from Fluxer permissions, not a local account. Ask for `MANAGE_GUILD` or `ADMINISTRATOR`. |
| Dashboard shows demo data | `DEMO_MODE=true` is still set. Turn it off and restart. |
| `401` after a week | OAuth access tokens last 7 days; the refresh token rotates automatically. If the refresh token expired (30 days idle), sign in again. |

## Security checklist

- Use a dedicated Postgres password and a private network between containers.
- Keep `FLUXER_BOT_TOKEN` and `FLUXER_CLIENT_SECRET` out of images, logs and
  screenshots. `.env` is excluded by `.dockerignore`.
- Do not enable `DEMO_MODE` on a public deployment: it lets anyone sign in as the
  demo administrator.
- Restrict access to the dashboard with your proxy if it is not meant to be
  public (basic auth, SSO, VPN).
- Rotate the client secret and bot token in Fluxer if either leaks. Rotating the
  bot token disconnects the bot until you update `.env` and restart.
