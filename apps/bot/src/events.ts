import { type Logger, normalizeReactionEmoji } from '@fluxbot/core';
import { type Database, upsertGuildSnapshot } from '@fluxbot/db';
import { onRolesMemberAdd, onRolesReaction } from '@fluxbot/modules';
import type {
  Client,
  Guild,
  GuildMember,
  Message,
  MessageReactionPayload,
  Role,
} from '@fluxerjs/core';
import { Events } from '@fluxerjs/core';
import { type CommandDeps, createRuntimeContext, handleMessage } from './commands';
import { toMemberLike } from './runtime/actions';

export interface EventDeps extends CommandDeps {
  client: Client;
  db: Database;
  logger: Logger;
}

const pendingSnapshots = new Map<string, NodeJS.Timeout>();

async function writeSnapshot(guild: Guild, deps: EventDeps): Promise<void> {
  try {
    const entry = await deps.registry.ensure(guild);
    const channels = [...guild.channels.values()].map((channel) => ({
      id: channel.id,
      name: channel.name ?? null,
      type: Number(channel.type),
      parentId: (channel as { parentId?: string | null }).parentId ?? null,
      position: (channel as { position?: number }).position ?? 0,
    }));
    const roles = [...guild.roles.values()].map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
    }));
    await upsertGuildSnapshot(deps.db, entry.uuid, channels, roles);
  } catch (error) {
    deps.logger.warn('Snapshot failed', {
      guildId: guild.id,
      error: (error as Error).message,
    });
  }
}

function scheduleSnapshot(guild: Guild | null, deps: EventDeps): void {
  if (!guild) return;
  const existing = pendingSnapshots.get(guild.id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    pendingSnapshots.delete(guild.id);
    void writeSnapshot(guild, deps);
  }, 1_500);
  pendingSnapshots.set(guild.id, timer);
}

async function rolesContextFor(guild: Guild, channelId: string, deps: EventDeps) {
  const entry = await deps.registry.ensure(guild);
  const config = await deps.configs.get(entry.uuid, 'roles');
  return createRuntimeContext(deps, {
    guild,
    guildUuid: entry.uuid,
    member: null,
    channelId,
    message: {
      id: '0',
      channelId,
      guildId: guild.id,
      content: '',
      author: { id: '0', username: 'system' },
    },
    config,
    isCommand: false,
  });
}

export function wireEvents(deps: EventDeps): void {
  const { client, logger } = deps;

  client.on(Events.MessageCreate, (message: Message) => {
    void handleMessage(message, deps).catch((error) => {
      logger.error('Message handler crashed', {
        messageId: message.id,
        error: (error as Error).message,
      });
    });
  });

  client.on(Events.MessageReactionAdd, (payload: MessageReactionPayload) => {
    void handleReaction(payload, true, deps).catch((error) => {
      logger.error('Reaction add handler crashed', { error: (error as Error).message });
    });
  });

  client.on(Events.MessageReactionRemove, (payload: MessageReactionPayload) => {
    void handleReaction(payload, false, deps).catch((error) => {
      logger.error('Reaction remove handler crashed', { error: (error as Error).message });
    });
  });

  client.on(Events.GuildMemberAdd, (member: GuildMember) => {
    void (async () => {
      const guild = member.guild;
      const entry = await deps.registry.ensure(guild);
      const config = await deps.configs.get(entry.uuid, 'roles');
      const ctx = createRuntimeContext(deps, {
        guild,
        guildUuid: entry.uuid,
        member: toMemberLike(member),
        channelId: guild.systemChannelId ?? guild.id,
        message: {
          id: '0',
          channelId: guild.systemChannelId ?? guild.id,
          guildId: guild.id,
          content: '',
          author: { id: '0', username: 'system' },
        },
        config,
        isCommand: false,
      });
      await onRolesMemberAdd(ctx, member.id);
    })().catch((error) => {
      logger.error('Member add handler crashed', { error: (error as Error).message });
    });
  });

  client.on(Events.GuildCreate, (guild: Guild) => {
    void deps.registry
      .ensure(guild)
      .then(() => writeSnapshot(guild, deps))
      .catch((error) =>
        logger.error('Guild create handler crashed', { error: (error as Error).message }),
      );
  });

  client.on(Events.GuildUpdate, (_oldGuild: Guild, guild: Guild) => {
    void deps.registry
      .ensure(guild)
      .then(() => scheduleSnapshot(guild, deps))
      .catch(() => {});
  });

  client.on(Events.GuildDelete, (guild: Guild) => {
    void deps.registry.markLeft(guild.id).catch(() => {});
  });

  const snapshotById = (guildId: string | null) => {
    if (!guildId) return;
    scheduleSnapshot(client.guilds.cache.get(guildId) ?? null, deps);
  };

  client.on(Events.ChannelCreate, (channel) =>
    snapshotById((channel as { guildId?: string | null }).guildId ?? null),
  );
  client.on(Events.ChannelUpdate, (_old, channel) =>
    snapshotById((channel as { guildId?: string | null }).guildId ?? null),
  );
  client.on(Events.ChannelDelete, (channel) =>
    snapshotById((channel as { guildId?: string | null }).guildId ?? null),
  );
  client.on(Events.GuildRoleCreate, (role: Role) => snapshotById(role.guildId));
  client.on(Events.GuildRoleUpdate, (_oldRole: Role | null, role: Role) =>
    snapshotById(role.guildId),
  );
  client.on(Events.GuildRoleDelete, (payload) => snapshotById(payload?.guildId ?? null));

  client.on(Events.Ready, () => {
    logger.info('Gateway ready', {
      user: client.user?.username,
      guilds: client.guilds.cache.size,
    });
    for (const guild of client.guilds.cache.values()) {
      void writeSnapshot(guild, deps);
    }
  });

  client.on(Events.Error, (error) => {
    logger.error('Gateway error', { error: error.message });
  });
}

async function handleReaction(
  payload: MessageReactionPayload,
  added: boolean,
  deps: EventDeps,
): Promise<void> {
  const guildId =
    payload.message?.guildId ??
    (payload.channel as { guildId?: string | null } | null)?.guildId ??
    null;
  if (!guildId) return;

  const guild = deps.client.guilds.cache.get(guildId);
  if (!guild) return;

  const emoji = normalizeReactionEmoji(payload.emoji);
  if (!emoji) return;

  const ctx = await rolesContextFor(guild, payload.channelId, deps);
  await onRolesReaction(ctx, {
    userId: payload.userId,
    channelId: payload.channelId,
    messageId: payload.messageId,
    emoji,
    added,
    isBot: payload.user.bot ?? false,
  });
}
