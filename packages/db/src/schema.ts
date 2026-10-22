import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export interface SnapshotChannel {
  id: string;
  name: string | null;
  type: number;
  parentId?: string | null;
  position?: number;
}

export interface SnapshotRole {
  id: string;
  name: string;
  color: number;
  position: number;
  managed?: boolean;
}

export const instances = pgTable('instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  origin: text('origin').notNull().unique(),
  discovery: jsonb('discovery').$type<Record<string, unknown>>().notNull(),
  appId: text('app_id'),
  clientSecretEnc: text('client_secret_enc'),
  botTokenEnc: text('bot_token_enc'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => instances.id, { onDelete: 'cascade' }),
    fluxerId: text('fluxer_id').notNull(),
    username: text('username').notNull(),
    globalName: text('global_name'),
    avatar: text('avatar'),
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('users_instance_fluxer_idx').on(table.instanceId, table.fluxerId)],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    accessTokenEnc: text('access_token_enc'),
    refreshTokenEnc: text('refresh_token_enc'),
    accessExpiresAt: timestamp('access_expires_at', { withTimezone: true }),
    refreshExpiresAt: timestamp('refresh_expires_at', { withTimezone: true }),
    userAgent: text('user_agent'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('sessions_user_idx').on(table.userId)],
);

export const guilds = pgTable(
  'guilds',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    instanceId: uuid('instance_id')
      .notNull()
      .references(() => instances.id, { onDelete: 'cascade' }),
    guildId: text('guild_id').notNull(),
    name: text('name').notNull(),
    icon: text('icon'),
    ownerId: text('owner_id'),
    botPresent: boolean('bot_present').notNull().default(false),
    prefix: text('prefix').notNull().default('!'),
    configRevision: integer('config_revision').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('guilds_instance_guild_idx').on(table.instanceId, table.guildId)],
);

export const guildMembers = pgTable(
  'guild_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permissions: text('permissions').notNull().default('0'),
    isOwner: boolean('is_owner').notNull().default(false),
    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('guild_members_guild_user_idx').on(table.guildId, table.userId)],
);

export const guildConfigs = pgTable(
  'guild_configs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    module: text('module').notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().notNull(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('guild_configs_guild_module_idx').on(table.guildId, table.module)],
);

export const guildSnapshots = pgTable('guild_snapshots', {
  guildId: uuid('guild_id')
    .primaryKey()
    .references(() => guilds.id, { onDelete: 'cascade' }),
  channels: jsonb('channels').$type<SnapshotChannel[]>().notNull(),
  roles: jsonb('roles').$type<SnapshotRole[]>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const commandSettings = pgTable(
  'command_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    command: text('command').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    permissionLevel: text('permission_level').notNull().default('default'),
    cooldownMs: integer('cooldown_ms'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('command_settings_guild_command_idx').on(table.guildId, table.command)],
);

export const xpUsers = pgTable(
  'xp_users',
  {
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    xp: bigint('xp', { mode: 'number' }).notNull().default(0),
    level: integer('level').notNull().default(0),
    messages: integer('messages').notNull().default(0),
    lastXpAt: timestamp('last_xp_at', { withTimezone: true }),
  },
  (table) => [
    primaryKey({ columns: [table.guildId, table.userId] }),
    index('xp_users_leaderboard_idx').on(table.guildId, table.xp),
  ],
);

export const levelRewards = pgTable(
  'level_rewards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    level: integer('level').notNull(),
    roleId: text('role_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('level_rewards_guild_level_idx').on(table.guildId, table.level)],
);

export const reactionRoles = pgTable(
  'reaction_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    channelId: text('channel_id').notNull(),
    messageId: text('message_id').notNull(),
    emoji: text('emoji').notNull(),
    roleId: text('role_id').notNull(),
    mode: text('mode').notNull().default('toggle'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('reaction_roles_message_emoji_idx').on(table.guildId, table.messageId, table.emoji),
    index('reaction_roles_guild_idx').on(table.guildId),
  ],
);

export const autoRoles = pgTable(
  'auto_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('auto_roles_guild_role_idx').on(table.guildId, table.roleId)],
);

export const selfRoles = pgTable(
  'self_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    roleId: text('role_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('self_roles_guild_role_idx').on(table.guildId, table.roleId)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorName: text('actor_name'),
    action: text('action').notNull(),
    target: text('target'),
    before: jsonb('before').$type<Record<string, unknown> | null>(),
    after: jsonb('after').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('audit_log_guild_created_idx').on(table.guildId, table.createdAt)],
);

export const botStatus = pgTable('bot_status', {
  instanceId: uuid('instance_id')
    .primaryKey()
    .references(() => instances.id, { onDelete: 'cascade' }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  guildCount: integer('guild_count').notNull().default(0),
  shardCount: integer('shard_count').notNull().default(1),
  latencyMs: integer('latency_ms'),
  version: text('version'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
});

export const scheduledJobs = pgTable(
  'scheduled_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(),
    runAt: timestamp('run_at', { withTimezone: true }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lockedBy: text('locked_by'),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('scheduled_jobs_status_run_idx').on(table.status, table.runAt)],
);

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    name: text('name'),
    userId: text('user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('analytics_guild_created_idx').on(table.guildId, table.createdAt)],
);

export const giveaways = pgTable(
  'giveaways',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    channelId: text('channel_id').notNull(),
    messageId: text('message_id'),
    prize: text('prize').notNull(),
    emoji: text('emoji').notNull().default('🎉'),
    winnersCount: integer('winners_count').notNull().default(1),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('active'),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (table) => [
    index('giveaways_guild_status_idx').on(table.guildId, table.status, table.endsAt),
    uniqueIndex('giveaways_message_idx').on(table.messageId),
  ],
);

export const giveawayEntries = pgTable(
  'giveaway_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    giveawayId: uuid('giveaway_id')
      .notNull()
      .references(() => giveaways.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('giveaway_entries_unique_idx').on(table.giveawayId, table.userId),
    index('giveaway_entries_giveaway_idx').on(table.giveawayId),
  ],
);

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    channelId: text('channel_id').notNull().unique(),
    userId: text('user_id').notNull(),
    status: text('status').notNull().default('open'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (table) => [index('tickets_guild_status_idx').on(table.guildId, table.status)],
);

export const tempVoices = pgTable(
  'temp_voices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    guildId: uuid('guild_id')
      .notNull()
      .references(() => guilds.id, { onDelete: 'cascade' }),
    channelId: text('channel_id').notNull().unique(),
    ownerId: text('owner_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('temp_voices_guild_idx').on(table.guildId)],
);
