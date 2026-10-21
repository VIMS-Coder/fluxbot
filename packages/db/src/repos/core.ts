import { and, asc, count, desc, eq, gte, inArray, notInArray, sql } from 'drizzle-orm';
import type { Database } from '../client';
import {
  analyticsEvents,
  auditLog,
  botStatus,
  commandSettings,
  guildConfigs,
  guildMembers,
  guildSnapshots,
  guilds,
  instances,
  type SnapshotChannel,
  type SnapshotRole,
  scheduledJobs,
  sessions,
  users,
} from '../schema';

export type Instance = typeof instances.$inferSelect;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Guild = typeof guilds.$inferSelect;
export type GuildMember = typeof guildMembers.$inferSelect;

// ---------------------------------------------------------------------------
// Instances
// ---------------------------------------------------------------------------

export async function getInstanceByOrigin(db: Database, origin: string): Promise<Instance | null> {
  const [row] = await db.select().from(instances).where(eq(instances.origin, origin)).limit(1);
  return row ?? null;
}

export async function getInstanceById(db: Database, id: string): Promise<Instance | null> {
  const [row] = await db.select().from(instances).where(eq(instances.id, id)).limit(1);
  return row ?? null;
}

export async function upsertInstance(
  db: Database,
  input: {
    origin: string;
    discovery: Record<string, unknown>;
    appId?: string | null;
    clientSecretEnc?: string | null;
    botTokenEnc?: string | null;
  },
): Promise<Instance> {
  const [row] = await db
    .insert(instances)
    .values({
      origin: input.origin,
      discovery: input.discovery,
      appId: input.appId ?? null,
      clientSecretEnc: input.clientSecretEnc ?? null,
      botTokenEnc: input.botTokenEnc ?? null,
    })
    .onConflictDoUpdate({
      target: instances.origin,
      set: {
        discovery: input.discovery,
        updatedAt: new Date(),
        ...(input.appId !== undefined ? { appId: input.appId } : {}),
        ...(input.clientSecretEnc !== undefined ? { clientSecretEnc: input.clientSecretEnc } : {}),
        ...(input.botTokenEnc !== undefined ? { botTokenEnc: input.botTokenEnc } : {}),
      },
    })
    .returning();

  if (!row) throw new Error('Failed to upsert instance');
  return row;
}

export async function updateInstance(
  db: Database,
  id: string,
  patch: { appId?: string | null; clientSecretEnc?: string | null; botTokenEnc?: string | null },
): Promise<void> {
  await db
    .update(instances)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(instances.id, id));
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function upsertUser(
  db: Database,
  instanceId: string,
  input: {
    fluxerId: string;
    username: string;
    globalName?: string | null;
    avatar?: string | null;
    email?: string | null;
  },
): Promise<User> {
  const [row] = await db
    .insert(users)
    .values({
      instanceId,
      fluxerId: input.fluxerId,
      username: input.username,
      globalName: input.globalName ?? null,
      avatar: input.avatar ?? null,
      email: input.email ?? null,
    })
    .onConflictDoUpdate({
      target: [users.instanceId, users.fluxerId],
      set: {
        username: input.username,
        globalName: input.globalName ?? null,
        avatar: input.avatar ?? null,
        email: input.email ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) throw new Error('Failed to upsert user');
  return row;
}

export async function getUserById(db: Database, id: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface SessionWithUser {
  session: Session;
  user: User;
  instance: Instance;
}

export async function createSession(
  db: Database,
  input: {
    userId: string;
    tokenHash: string;
    accessTokenEnc: string;
    refreshTokenEnc: string;
    accessExpiresAt: Date;
    refreshExpiresAt: Date;
    expiresAt: Date;
    userAgent?: string | null;
    ip?: string | null;
  },
): Promise<Session> {
  const [row] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      tokenHash: input.tokenHash,
      accessTokenEnc: input.accessTokenEnc,
      refreshTokenEnc: input.refreshTokenEnc,
      accessExpiresAt: input.accessExpiresAt,
      refreshExpiresAt: input.refreshExpiresAt,
      expiresAt: input.expiresAt,
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
    })
    .returning();

  if (!row) throw new Error('Failed to create session');
  return row;
}

export async function getSessionWithUser(
  db: Database,
  tokenHash: string,
): Promise<SessionWithUser | null> {
  const [row] = await db
    .select({ session: sessions, user: users, instance: instances })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .innerJoin(instances, eq(users.instanceId, instances.id))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  return row ?? null;
}

export async function updateSessionTokens(
  db: Database,
  id: string,
  input: {
    accessTokenEnc: string;
    refreshTokenEnc: string;
    accessExpiresAt: Date;
    refreshExpiresAt: Date;
  },
): Promise<void> {
  await db
    .update(sessions)
    .set({ ...input, lastSeenAt: new Date() })
    .where(eq(sessions.id, id));
}

export async function touchSession(db: Database, id: string): Promise<void> {
  await db.update(sessions).set({ lastSeenAt: new Date() }).where(eq(sessions.id, id));
}

export async function deleteSession(db: Database, id: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, id));
}

export async function deleteExpiredSessions(db: Database): Promise<number> {
  const rows = await db
    .delete(sessions)
    .where(sql`${sessions.expiresAt} < now()`)
    .returning({ id: sessions.id });
  return rows.length;
}

// ---------------------------------------------------------------------------
// Guilds & membership
// ---------------------------------------------------------------------------

export interface GuildSyncInput {
  guildId: string;
  name: string;
  icon?: string | null;
  permissions?: string | null;
  isOwner?: boolean;
  ownerFluxerId?: string | null;
}

/**
 * Store the guilds a user can see, together with their permission mask.
 *
 * Called on every login and on demand when the cached mask is stale. Also drops
 * memberships for guilds the user is no longer in.
 */
export async function syncUserGuilds(
  db: Database,
  instanceId: string,
  userId: string,
  input: GuildSyncInput[],
): Promise<void> {
  const localGuildIds: string[] = [];

  for (const entry of input) {
    const [guild] = await db
      .insert(guilds)
      .values({
        instanceId,
        guildId: entry.guildId,
        name: entry.name,
        icon: entry.icon ?? null,
        ownerId: entry.isOwner ? (entry.ownerFluxerId ?? null) : null,
      })
      .onConflictDoUpdate({
        target: [guilds.instanceId, guilds.guildId],
        set: {
          name: entry.name,
          icon: entry.icon ?? null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: guilds.id });

    if (!guild) continue;
    localGuildIds.push(guild.id);

    await db
      .insert(guildMembers)
      .values({
        guildId: guild.id,
        userId,
        permissions: entry.permissions ?? '0',
        isOwner: entry.isOwner ?? false,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [guildMembers.guildId, guildMembers.userId],
        set: {
          permissions: entry.permissions ?? '0',
          isOwner: entry.isOwner ?? false,
          syncedAt: new Date(),
        },
      });
  }

  if (localGuildIds.length > 0) {
    await db
      .delete(guildMembers)
      .where(and(eq(guildMembers.userId, userId), notInArray(guildMembers.guildId, localGuildIds)));
  } else {
    await db.delete(guildMembers).where(eq(guildMembers.userId, userId));
  }
}

export async function listGuildsForUser(
  db: Database,
  userId: string,
): Promise<Array<{ guild: Guild; member: GuildMember }>> {
  return db
    .select({ guild: guilds, member: guildMembers })
    .from(guildMembers)
    .innerJoin(guilds, eq(guildMembers.guildId, guilds.id))
    .where(eq(guildMembers.userId, userId))
    .orderBy(desc(guilds.botPresent), asc(guilds.name));
}

export async function getGuildForUser(
  db: Database,
  userId: string,
  guildUuid: string,
): Promise<{ guild: Guild; member: GuildMember } | null> {
  const [row] = await db
    .select({ guild: guilds, member: guildMembers })
    .from(guildMembers)
    .innerJoin(guilds, eq(guildMembers.guildId, guilds.id))
    .where(and(eq(guildMembers.userId, userId), eq(guildMembers.guildId, guildUuid)))
    .limit(1);

  return row ?? null;
}

export async function getGuildByFluxerId(
  db: Database,
  instanceId: string,
  guildId: string,
): Promise<Guild | null> {
  const [row] = await db
    .select()
    .from(guilds)
    .where(and(eq(guilds.instanceId, instanceId), eq(guilds.guildId, guildId)))
    .limit(1);
  return row ?? null;
}

export async function getGuildById(db: Database, id: string): Promise<Guild | null> {
  const [row] = await db.select().from(guilds).where(eq(guilds.id, id)).limit(1);
  return row ?? null;
}

export async function updateGuildSettings(
  db: Database,
  guildUuid: string,
  patch: { prefix?: string },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(guilds)
      .set({
        ...patch,
        configRevision: sql`${guilds.configRevision} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(guilds.id, guildUuid))
      .returning({ revision: guilds.configRevision });

    await tx.execute(
      sql`select pg_notify('fluxbot_config', ${`${guildUuid}:${updated?.revision ?? 0}`})`,
    );
  });
}

export async function setBotPresence(
  db: Database,
  instanceId: string,
  presentGuildIds: string[],
): Promise<number> {
  if (presentGuildIds.length > 0) {
    await db
      .update(guilds)
      .set({ botPresent: true })
      .where(and(eq(guilds.instanceId, instanceId), inArray(guilds.guildId, presentGuildIds)));
    await db
      .update(guilds)
      .set({ botPresent: false })
      .where(and(eq(guilds.instanceId, instanceId), notInArray(guilds.guildId, presentGuildIds)));
  } else {
    await db.update(guilds).set({ botPresent: false }).where(eq(guilds.instanceId, instanceId));
  }

  const [row] = await db
    .select({ value: count() })
    .from(guilds)
    .where(and(eq(guilds.instanceId, instanceId), eq(guilds.botPresent, true)));
  return Number(row?.value ?? 0);
}

// ---------------------------------------------------------------------------
// Module configuration
// ---------------------------------------------------------------------------

export async function getGuildConfig<T extends Record<string, unknown>>(
  db: Database,
  guildUuid: string,
  module: string,
): Promise<T | null> {
  const [row] = await db
    .select({ config: guildConfigs.config })
    .from(guildConfigs)
    .where(and(eq(guildConfigs.guildId, guildUuid), eq(guildConfigs.module, module)))
    .limit(1);
  return (row?.config as T | undefined) ?? null;
}

export async function listGuildConfigs(
  db: Database,
  guildUuid: string,
): Promise<Array<{ module: string; config: Record<string, unknown> }>> {
  return db
    .select({ module: guildConfigs.module, config: guildConfigs.config })
    .from(guildConfigs)
    .where(eq(guildConfigs.guildId, guildUuid));
}

export async function setGuildConfig(
  db: Database,
  guildUuid: string,
  module: string,
  config: Record<string, unknown>,
  updatedBy: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(guildConfigs)
      .values({ guildId: guildUuid, module, config, updatedBy })
      .onConflictDoUpdate({
        target: [guildConfigs.guildId, guildConfigs.module],
        set: { config, updatedBy, updatedAt: new Date() },
      });

    const [updated] = await tx
      .update(guilds)
      .set({ configRevision: sql`${guilds.configRevision} + 1`, updatedAt: new Date() })
      .where(eq(guilds.id, guildUuid))
      .returning({ revision: guilds.configRevision });

    await tx.execute(
      sql`select pg_notify('fluxbot_config', ${`${guildUuid}:${updated?.revision ?? 0}`})`,
    );
  });
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

export async function upsertGuildSnapshot(
  db: Database,
  guildUuid: string,
  channels: SnapshotChannel[],
  roles: SnapshotRole[],
): Promise<void> {
  await db
    .insert(guildSnapshots)
    .values({ guildId: guildUuid, channels, roles, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: guildSnapshots.guildId,
      set: { channels, roles, updatedAt: new Date() },
    });
}

export async function getGuildSnapshot(
  db: Database,
  guildUuid: string,
): Promise<{ channels: SnapshotChannel[]; roles: SnapshotRole[]; updatedAt: Date } | null> {
  const [row] = await db
    .select({
      channels: guildSnapshots.channels,
      roles: guildSnapshots.roles,
      updatedAt: guildSnapshots.updatedAt,
    })
    .from(guildSnapshots)
    .where(eq(guildSnapshots.guildId, guildUuid))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Command settings
// ---------------------------------------------------------------------------

export async function listCommandSettings(
  db: Database,
  guildUuid: string,
): Promise<Array<typeof commandSettings.$inferSelect>> {
  return db.select().from(commandSettings).where(eq(commandSettings.guildId, guildUuid));
}

export async function setCommandSetting(
  db: Database,
  guildUuid: string,
  command: string,
  patch: { enabled?: boolean; permissionLevel?: string; cooldownMs?: number | null },
): Promise<void> {
  await db
    .insert(commandSettings)
    .values({
      guildId: guildUuid,
      command,
      enabled: patch.enabled ?? true,
      permissionLevel: patch.permissionLevel ?? 'default',
      cooldownMs: patch.cooldownMs ?? null,
    })
    .onConflictDoUpdate({
      target: [commandSettings.guildId, commandSettings.command],
      set: { ...patch, updatedAt: new Date() },
    });
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------

export async function recordAudit(
  db: Database,
  input: {
    guildId: string;
    actorUserId: string | null;
    actorName: string | null;
    action: string;
    target?: string | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  },
): Promise<void> {
  await db.insert(auditLog).values({
    guildId: input.guildId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    action: input.action,
    target: input.target ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
  });
}

export async function listAudit(
  db: Database,
  guildUuid: string,
  limit = 50,
): Promise<Array<typeof auditLog.$inferSelect>> {
  return db
    .select()
    .from(auditLog)
    .where(eq(auditLog.guildId, guildUuid))
    .orderBy(desc(auditLog.createdAt))
    .limit(limit);
}

// ---------------------------------------------------------------------------
// Bot status
// ---------------------------------------------------------------------------

export async function setBotStatus(
  db: Database,
  instanceId: string,
  input: {
    guildCount: number;
    shardCount: number;
    latencyMs?: number | null;
    version?: string;
    startedAt?: Date;
  },
): Promise<void> {
  await db
    .insert(botStatus)
    .values({
      instanceId,
      guildCount: input.guildCount,
      shardCount: input.shardCount,
      latencyMs: input.latencyMs ?? null,
      version: input.version ?? null,
      startedAt: input.startedAt ?? new Date(),
      lastSeenAt: new Date(),
    })
    .onConflictDoUpdate({
      target: botStatus.instanceId,
      set: {
        guildCount: input.guildCount,
        shardCount: input.shardCount,
        latencyMs: input.latencyMs ?? null,
        version: input.version ?? null,
        lastSeenAt: new Date(),
      },
    });
}

export async function getBotStatus(
  db: Database,
  instanceId: string,
): Promise<typeof botStatus.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(botStatus)
    .where(eq(botStatus.instanceId, instanceId))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export type Job = typeof scheduledJobs.$inferSelect;

export async function enqueueJob(
  db: Database,
  input: { type: string; runAt: Date; payload?: Record<string, unknown> },
): Promise<void> {
  await db.insert(scheduledJobs).values({
    type: input.type,
    runAt: input.runAt,
    payload: input.payload ?? {},
  });
}

/**
 * Claim due jobs with `FOR UPDATE SKIP LOCKED` so several workers (or several
 * bot replicas) never run the same job twice.
 */
export async function claimJobs(db: Database, workerId: string, limit = 5): Promise<Job[]> {
  const rows = await db.execute(sql`
    update scheduled_jobs
       set status = 'running',
           locked_by = ${workerId},
           locked_at = now(),
           attempts = attempts + 1
     where id in (
       select id from scheduled_jobs
        where status = 'pending' and run_at <= now()
        order by run_at asc
        limit ${limit}
        for update skip locked
     )
     returning *
  `);
  return rows as unknown as Job[];
}

export async function completeJob(db: Database, id: string): Promise<void> {
  await db
    .update(scheduledJobs)
    .set({ status: 'done', lockedBy: null, lockedAt: null })
    .where(eq(scheduledJobs.id, id));
}

export async function failJob(db: Database, id: string, error: string): Promise<void> {
  await db
    .update(scheduledJobs)
    .set({
      status: 'pending',
      lastError: error.slice(0, 2000),
      lockedBy: null,
      lockedAt: null,
      runAt: sql`now() + interval '1 minute'`,
    })
    .where(eq(scheduledJobs.id, id));
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export async function recordAnalytics(
  db: Database,
  input: { guildId: string; type: string; name?: string | null; userId?: string | null },
): Promise<void> {
  await db.insert(analyticsEvents).values({
    guildId: input.guildId,
    type: input.type,
    name: input.name ?? null,
    userId: input.userId ?? null,
  });
}

export interface AnalyticsSummary {
  total: number;
  byType: Array<{ type: string; count: number }>;
  topCommands: Array<{ name: string; count: number }>;
}

export async function getAnalyticsSummary(
  db: Database,
  guildUuid: string,
  days = 7,
): Promise<AnalyticsSummary> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const byType = await db
    .select({ type: analyticsEvents.type, count: count() })
    .from(analyticsEvents)
    .where(and(eq(analyticsEvents.guildId, guildUuid), gte(analyticsEvents.createdAt, since)))
    .groupBy(analyticsEvents.type);

  const topCommands = await db
    .select({ name: analyticsEvents.name, count: count() })
    .from(analyticsEvents)
    .where(
      and(
        eq(analyticsEvents.guildId, guildUuid),
        eq(analyticsEvents.type, 'command'),
        gte(analyticsEvents.createdAt, since),
      ),
    )
    .groupBy(analyticsEvents.name)
    .orderBy(desc(count()))
    .limit(5);

  const normalized = byType.map((row) => ({ type: row.type, count: Number(row.count) }));
  return {
    total: normalized.reduce((sum, row) => sum + row.count, 0),
    byType: normalized,
    topCommands: topCommands
      .filter((row): row is { name: string; count: number } => row.name !== null)
      .map((row) => ({ name: row.name, count: Number(row.count) })),
  };
}

/** Create the guild row on first sight (bot join), or refresh its metadata. */
export async function ensureGuild(
  db: Database,
  instanceId: string,
  input: { guildId: string; name: string; icon?: string | null; botPresent?: boolean },
): Promise<Guild> {
  const [row] = await db
    .insert(guilds)
    .values({
      instanceId,
      guildId: input.guildId,
      name: input.name,
      icon: input.icon ?? null,
      botPresent: input.botPresent ?? true,
    })
    .onConflictDoUpdate({
      target: [guilds.instanceId, guilds.guildId],
      set: {
        name: input.name,
        icon: input.icon ?? null,
        botPresent: input.botPresent ?? true,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!row) throw new Error('Failed to ensure guild');
  return row;
}

export async function setGuildBotPresent(
  db: Database,
  instanceId: string,
  guildId: string,
  present: boolean,
): Promise<void> {
  await db
    .update(guilds)
    .set({ botPresent: present, updatedAt: new Date() })
    .where(and(eq(guilds.instanceId, instanceId), eq(guilds.guildId, guildId)));
}

export async function getCommandSetting(
  db: Database,
  guildUuid: string,
  command: string,
): Promise<typeof commandSettings.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(commandSettings)
    .where(and(eq(commandSettings.guildId, guildUuid), eq(commandSettings.command, command)))
    .limit(1);
  return row ?? null;
}

export async function listGuildEntries(
  db: Database,
  instanceId: string,
): Promise<Array<{ guildId: string; id: string; prefix: string }>> {
  return db
    .select({ guildId: guilds.guildId, id: guilds.id, prefix: guilds.prefix })
    .from(guilds)
    .where(eq(guilds.instanceId, instanceId));
}

/** Cheap connectivity check for container health probes. */
export async function pingDatabase(db: Database): Promise<boolean> {
  await db.execute(sql`select 1`);
  return true;
}
