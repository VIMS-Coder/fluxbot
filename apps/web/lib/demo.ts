import {
  ensureGuild,
  getGuildByFluxerId,
  getGuildConfig,
  getXpUser,
  grantXp,
  listAudit,
  recordAudit,
  setBotStatus,
  setGuildBotPresent,
  setGuildConfig,
  syncUserGuilds,
  upsertGuildSnapshot,
  upsertInstance,
  upsertUser,
} from '@fluxbot/db';
import { defaultsFor } from '@fluxbot/modules/config';
import { getDb } from './db';

export const DEMO_ORIGIN = 'https://demo.fluxer.local';

export const DEMO_DISCOVERY = {
  api_code_version: 1,
  endpoints: {
    api: 'https://demo.fluxer.local/api',
    api_client: 'https://demo.fluxer.local/api',
    api_public: 'https://demo.fluxer.local/api',
    gateway: 'wss://demo.fluxer.local/gateway',
    media: 'https://demo.fluxer.local/media',
    static_cdn: 'https://demo.fluxer.local/static',
    marketing: 'https://demo.fluxer.local/marketing',
    admin: 'https://demo.fluxer.local/admin',
    invite: 'https://demo.fluxer.local/invite',
    gift: 'https://demo.fluxer.local/gift',
    webapp: 'https://demo.fluxer.local',
  },
  features: { self_hosted: true, voice_enabled: true, emails_enabled: true },
};

const DEMO_USER = {
  fluxerId: '100000000000000001',
  username: 'demo',
  globalName: 'Demo Admin',
  avatar: null,
};

const DEMO_GUILDS = [
  {
    guildId: '200000000000000001',
    name: 'Design Guild',
    icon: null,
    botPresent: true,
    channels: [
      { id: '300000000000000001', name: 'general', type: 0, position: 0 },
      { id: '300000000000000002', name: 'levels', type: 0, position: 1 },
      { id: '300000000000000003', name: 'roles', type: 0, position: 2 },
      { id: '300000000000000004', name: 'staff', type: 0, position: 3 },
    ],
    roles: [
      { id: '200000000000000001', name: '@everyone', color: 0, position: 0 },
      { id: '400000000000000001', name: 'Member', color: 0x9ca3af, position: 1 },
      { id: '400000000000000002', name: 'Artist', color: 0x8b5cf6, position: 2 },
      { id: '400000000000000003', name: 'Moderator', color: 0x06b6d4, position: 3 },
    ],
  },
  {
    guildId: '200000000000000002',
    name: 'Test Server',
    icon: null,
    botPresent: false,
    channels: [
      { id: '300000000000000011', name: 'welcome', type: 0, position: 0 },
      { id: '300000000000000012', name: 'chat', type: 0, position: 1 },
    ],
    roles: [
      { id: '200000000000000002', name: '@everyone', color: 0, position: 0 },
      { id: '400000000000000011', name: 'Regular', color: 0x22c55e, position: 1 },
    ],
  },
];

const DEMO_XP: Array<{ userId: string; xp: number }> = [
  { userId: '100000000000000001', xp: 14_820 },
  { userId: '100000000000000002', xp: 9_240 },
  { userId: '100000000000000003', xp: 4_310 },
  { userId: '100000000000000004', xp: 980 },
];

let seedPromise: Promise<void> | null = null;

/** Idempotently seed a demo instance, guild, user and some engagement data. */
export async function ensureDemoData(): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const db = getDb();

    const instance = await upsertInstance(db, {
      origin: DEMO_ORIGIN,
      discovery: DEMO_DISCOVERY,
      appId: '900000000000000001',
    });

    const user = await upsertUser(db, instance.id, {
      fluxerId: DEMO_USER.fluxerId,
      username: DEMO_USER.username,
      globalName: DEMO_USER.globalName,
      avatar: null,
      email: 'demo@example.com',
    });

    await syncUserGuilds(
      db,
      instance.id,
      user.id,
      DEMO_GUILDS.map((guild) => ({
        guildId: guild.guildId,
        name: guild.name,
        icon: guild.icon,
        permissions: '8',
        isOwner: true,
        ownerFluxerId: DEMO_USER.fluxerId,
      })),
    );

    for (const guild of DEMO_GUILDS) {
      const row = await ensureGuild(db, instance.id, {
        guildId: guild.guildId,
        name: guild.name,
        icon: guild.icon,
        botPresent: guild.botPresent,
      });
      if (!guild.botPresent) {
        await setGuildBotPresent(db, instance.id, guild.guildId, false);
      }

      await upsertGuildSnapshot(db, row.id, guild.channels, guild.roles);

      for (const moduleId of ['levels', 'fun', 'roles'] as const) {
        const existing = await getGuildConfig(db, row.id, moduleId);
        if (!existing) {
          await setGuildConfig(db, row.id, moduleId, defaultsFor(moduleId), null);
        }
      }

      if (guild.botPresent) {
        if (guild.guildId === DEMO_GUILDS[0]!.guildId) {
          for (const entry of DEMO_XP) {
            const existing = await getXpUser(db, row.id, entry.userId);
            if (existing) continue;
            await grantXp(db, {
              guildId: row.id,
              userId: entry.userId,
              amount: entry.xp,
              level: 0,
            });
          }

          const audits = await listAudit(db, row.id, 1);
          if (audits.length === 0) {
            await recordAudit(db, {
              guildId: row.id,
              actorUserId: user.id,
              actorName: DEMO_USER.globalName,
              action: 'levels.update',
              target: guild.guildId,
              before: { cooldownSeconds: 60 },
              after: { cooldownSeconds: 30 },
            });
          }
        }
      }
    }

    await setBotStatus(db, instance.id, {
      guildCount: 1,
      shardCount: 1,
      latencyMs: 42,
      version: '0.1.0 (demo)',
      startedAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
    });
  })();

  try {
    await seedPromise;
  } catch (error) {
    seedPromise = null;
    throw error;
  }
}

/** The demo user row, used by the demo login route. */
export async function getDemoUser() {
  const db = getDb();
  const instance = await upsertInstance(db, {
    origin: DEMO_ORIGIN,
    discovery: DEMO_DISCOVERY,
    appId: '900000000000000001',
  });
  return upsertUser(db, instance.id, {
    fluxerId: DEMO_USER.fluxerId,
    username: DEMO_USER.username,
    globalName: DEMO_USER.globalName,
    avatar: null,
  });
}

/** Guild row for the demo guild the user lands on. */
export async function getDemoGuildRow(instanceId: string) {
  return getGuildByFluxerId(getDb(), instanceId, DEMO_GUILDS[0]!.guildId);
}
