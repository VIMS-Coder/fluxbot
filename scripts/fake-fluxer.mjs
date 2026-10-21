#!/usr/bin/env node
/**
 * A tiny fake Fluxer instance for local smoke tests.
 *
 * It implements just enough of the public API for the bot to boot:
 *   GET  /.well-known/fluxer
 *   GET  /api/v1/applications/@me
 *   GET  /api/v1/gateway/bot
 *   POST /api/v1/channels/:id/messages
 *   WS   /gateway   (Hello → Identify → Ready, then a scripted conversation)
 *
 * Usage:
 *   node scripts/fake-fluxer.mjs
 *   FLUXER_INSTANCE_ORIGIN=http://127.0.0.1:4280 \
 *   FLUXER_BOT_TOKEN=900000000000000001.smoke \
 *   pnpm dev:bot
 *
 * Replies from the bot are printed as `[reply] ...`, which makes this usable in
 * CI without a real Fluxer server.
 */
import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const PORT = Number(process.env.FAKE_PORT ?? 4280);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const APP_ID = '900000000000000001';
const GUILD_ID = '200000000000000001';
const CHANNEL_ID = '300000000000000001';

const BOT = {
  id: APP_ID,
  username: 'Fluxbot',
  discriminator: '0001',
  global_name: 'Fluxbot',
  avatar: null,
  bot: true,
  system: false,
  flags: 0,
};

const USER = {
  id: '100000000000000009',
  username: 'tester',
  discriminator: '0042',
  global_name: 'Tester',
  avatar: null,
  bot: false,
  system: false,
  flags: 0,
};

const discovery = {
  api_code_version: 1,
  endpoints: {
    api: `${ORIGIN}/api`,
    api_client: `${ORIGIN}/api`,
    api_public: `${ORIGIN}/api`,
    gateway: `ws://127.0.0.1:${PORT}/gateway`,
    media: `${ORIGIN}/media`,
    static_cdn: `${ORIGIN}/static`,
    marketing: `${ORIGIN}/marketing`,
    admin: `${ORIGIN}/admin`,
    invite: `${ORIGIN}/invite`,
    gift: `${ORIGIN}/gift`,
    webapp: ORIGIN,
  },
  features: { self_hosted: true, voice_enabled: false, emails_enabled: true },
  limits: {},
};

const replies = [];
let messageSequence = 0;

function nextId() {
  messageSequence += 1;
  return String(Date.now()) + String(messageSequence).padStart(6, '0');
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  });
  response.end(payload);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function guildPayload() {
  const everyone = {
    id: GUILD_ID,
    name: '@everyone',
    color: 0,
    position: 0,
    permissions: '8',
    hoist: false,
    mentionable: false,
    managed: false,
    unicode_emoji: null,
    hoist_position: null,
  };
  return {
    id: GUILD_ID,
    name: 'Smoke Guild',
    icon: null,
    owner_id: USER.id,
    roles: [everyone],
    channels: [
      {
        id: CHANNEL_ID,
        guild_id: GUILD_ID,
        name: 'general',
        type: 0,
        position: 0,
        parent_id: null,
        permission_overwrites: [],
      },
    ],
    emojis: [],
    stickers: [],
    members: [
      {
        user: USER,
        nick: null,
        roles: [],
        joined_at: new Date().toISOString(),
        mute: false,
        deaf: false,
        avatar: null,
        banner: null,
      },
    ],
    member_count: 1,
    online_count: 1,
    presences: [],
    voice_states: [],
    joined_at: new Date().toISOString(),
    unavailable: false,
  };
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, ORIGIN);
  const path = url.pathname;

  if (path === '/.well-known/fluxer') {
    sendJson(response, 200, discovery);
    return;
  }

  if (path === '/api/v1/applications/@me') {
    sendJson(response, 200, {
      id: APP_ID,
      name: 'Fluxbot Smoke',
      description: 'Fake application for local tests',
      redirect_uris: [`${ORIGIN}/auth/callback`],
      bot: BOT,
    });
    return;
  }

  if (path === '/api/v1/gateway/bot') {
    sendJson(response, 200, {
      url: `ws://127.0.0.1:${PORT}/gateway`,
      shards: 1,
      session_start_limit: {
        total: 1000,
        remaining: 999,
        reset_after: 14_400_000,
        max_concurrency: 1,
      },
    });
    return;
  }

  if (path === '/api/v1/users/@me/guilds') {
    sendJson(response, 200, [
      {
        id: GUILD_ID,
        name: 'Smoke Guild',
        icon: null,
        owner: true,
        permissions: '8',
      },
    ]);
    return;
  }

  const messageRoute = /^\/api\/v1\/channels\/(\d+)\/messages$/.exec(path);
  if (messageRoute && request.method === 'POST') {
    const body = await readBody(request).catch(() => ({}));
    const message = {
      id: nextId(),
      channel_id: messageRoute[1],
      author: BOT,
      content: body.content ?? '',
      timestamp: new Date().toISOString(),
      edited_timestamp: null,
      tts: false,
      mention_everyone: false,
      mentions: [],
      mention_roles: [],
      attachments: [],
      embeds: body.embeds ?? [],
      pinned: false,
      type: 0,
      flags: 0,
      nonce: null,
    };
    replies.push(message);
    console.log(
      `[reply] ${JSON.stringify({
        content: message.content,
        embeds: message.embeds.map((embed) => ({
          title: embed.title,
          description: embed.description,
        })),
      })}`,
    );
    sendJson(response, 200, message);
    return;
  }

  sendJson(response, 404, { code: 'NOT_FOUND', message: `No fake route for ${path}` });
});

const wss = new WebSocketServer({ server, path: '/gateway' });

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ op: 10, d: { heartbeat_interval: 30_000 } }));

  socket.on('message', (raw) => {
    let payload;
    try {
      payload = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (payload.op === 1) {
      socket.send(JSON.stringify({ op: 11 }));
      return;
    }

    if (payload.op === 2) {
      socket.send(
        JSON.stringify({
          op: 0,
          t: 'READY',
          s: 1,
          d: {
            session_id: 'smoke-session',
            version: 1,
            user: BOT,
            guilds: [],
            private_channels: [],
            relationships: [],
            presences: [],
            users: [],
            sessions: [],
            read_states: [],
            user_guild_settings: [],
            notes: {},
            pinned_dms: [],
            favorite_memes: [],
            webauthn_credentials: [],
            rtc_regions: [],
            country_code: 'US',
          },
        }),
      );

      setTimeout(() => {
        socket.send(JSON.stringify({ op: 0, t: 'GUILD_CREATE', s: 2, d: guildPayload() }));
        console.log('[gateway] sent GUILD_CREATE');
        setTimeout(() => runScenario(socket), 700);
      }, 400);
      return;
    }
  });
});

function dispatchMessage(socket, content) {
  socket.send(
    JSON.stringify({
      op: 0,
      t: 'MESSAGE_CREATE',
      s: 3,
      d: {
        id: nextId(),
        channel_id: CHANNEL_ID,
        guild_id: GUILD_ID,
        channel_type: 0,
        author: USER,
        member: guildPayload().members[0],
        content,
        timestamp: new Date().toISOString(),
        edited_timestamp: null,
        tts: false,
        mention_everyone: false,
        mentions: [],
        mention_roles: [],
        attachments: [],
        embeds: [],
        pinned: false,
        type: 0,
        flags: 0,
        nonce: null,
      },
    }),
  );
  console.log(`[gateway] sent message: ${content}`);
}

async function runScenario(socket) {
  // The first message uses the default prefix. An external process changes the
  // prefix to `?` while the bot is running, so the third message proves the
  // config invalidation path works end to end.
  dispatchMessage(socket, '!ping');
  await new Promise((resolve) => setTimeout(resolve, 5200));
  dispatchMessage(socket, '?ping');
  await new Promise((resolve) => setTimeout(resolve, 1400));
  dispatchMessage(socket, '!ping');
  await new Promise((resolve) => setTimeout(resolve, 1200));
  dispatchMessage(socket, '!dice 2d6');

  setTimeout(() => {
    console.log(`[summary] replies=${replies.length}`);
    console.log(
      replies.map((reply) => `[summary] ${reply.content || reply.embeds[0]?.title}`).join('\n'),
    );
  }, 1500);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[fake-fluxer] listening on ${ORIGIN}`);
  console.log(`[fake-fluxer] instance discovery: ${ORIGIN}/.well-known/fluxer`);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
