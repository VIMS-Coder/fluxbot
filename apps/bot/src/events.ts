import { type Logger, normalizeReactionEmoji } from '@fluxbot/core';
import {
  createTempVoice,
  type Database,
  deleteTempVoice,
  getTempVoiceByChannel,
  setBotPresence,
  upsertGuildSnapshot,
} from '@fluxbot/db';
import {
  onGiveawayReaction,
  onRolesMemberAdd,
  onRolesReaction,
  renderVoiceName,
  renderWelcome,
} from '@fluxbot/modules';
import { tempVoiceConfigSchema, welcomeConfigSchema } from '@fluxbot/modules/config';
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

interface VoiceStateLike {
  guild_id?: string | null;
  channel_id: string | null;
  user_id: string;
  member?: { user?: { bot?: boolean } };
}

const pendingSnapshots = new Map<string, NodeJS.Timeout>();

/** guildId → userId → current voice channel (null when disconnected). */
const voiceByUser = new Map<string, Map<string, string | null>>();
const pendingTempChannels = new Set<string>();

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

async function contextFor(guild: Guild, channelId: string, deps: EventDeps, moduleId: string) {
  const entry = await deps.registry.ensure(guild);
  const config = await deps.configs.get(entry.uuid, moduleId);
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

async function sendWelcome(
  member: { id: string; name: string },
  guild: Guild,
  event: 'join' | 'leave',
  deps: EventDeps,
): Promise<void> {
  const entry = await deps.registry.ensure(guild);
  const config = welcomeConfigSchema.parse(await deps.configs.get(entry.uuid, 'welcome'));
  if (!config.enabled || !config.channelId) return;
  if (event === 'leave' && !config.sendLeave) return;

  const memberCount = await deps.actions.guildMemberCount(guild.id);
  const body = renderWelcome(event === 'join' ? config.joinMessage : config.leaveMessage, {
    mention: `<@${member.id}>`,
    name: member.name,
    server: guild.name,
    count: memberCount,
  });

  try {
    await deps.actions.send(config.channelId, {
      embeds: [
        {
          description: body,
          color: event === 'join' ? 0x22c55e : 0x71717a,
        },
      ],
    });
  } catch (error) {
    deps.logger.warn('Welcome message failed', {
      guildId: guild.id,
      channelId: config.channelId,
      error: (error as Error).message,
    });
  }
}

function countInChannel(guildId: string, channelId: string): number {
  const users = voiceByUser.get(guildId);
  if (!users) return 0;
  let count = 0;
  for (const channel of users.values()) {
    if (channel === channelId) count += 1;
  }
  return count;
}

async function handleVoiceState(data: VoiceStateLike, deps: EventDeps): Promise<void> {
  if (!data.guild_id || data.member?.user?.bot) return;

  const guild = deps.client.guilds.cache.get(data.guild_id);
  if (!guild) return;

  const entry = await deps.registry.ensure(guild);
  const config = tempVoiceConfigSchema.parse(await deps.configs.get(entry.uuid, 'tempvoice'));
  if (!config.enabled || !config.hubChannelId) return;

  const users = voiceByUser.get(guild.id) ?? new Map<string, string | null>();
  voiceByUser.set(guild.id, users);

  const previous = users.get(data.user_id) ?? null;
  users.set(data.user_id, data.channel_id);

  // Clean up a temporary channel once its last occupant leaves.
  if (previous && previous !== data.channel_id) {
    const temp = await getTempVoiceByChannel(deps.db, previous).catch(() => null);
    if (temp && countInChannel(guild.id, previous) === 0) {
      try {
        await deps.actions.deleteChannel(previous);
      } catch (error) {
        deps.logger.warn('Could not delete temporary voice channel', {
          channelId: previous,
          error: (error as Error).message,
        });
      }
      await deleteTempVoice(deps.db, previous).catch(() => {});
    }
  }

  if (data.channel_id !== config.hubChannelId) return;
  if (pendingTempChannels.has(data.user_id)) return;

  pendingTempChannels.add(data.user_id);
  try {
    const member = await deps.actions.fetchMember(guild.id, data.user_id);
    const name = renderVoiceName(
      config.nameTemplate,
      member?.displayName ?? member?.username ?? 'Voice',
    );

    const channel = await deps.actions.createVoiceChannel(guild.id, {
      name,
      parentId: config.categoryId,
      userLimit: config.userLimit,
    });

    await createTempVoice(deps.db, {
      guildId: entry.uuid,
      channelId: channel.id,
      ownerId: data.user_id,
    });

    await deps.actions.moveMember(guild.id, data.user_id, channel.id);
    users.set(data.user_id, channel.id);
  } catch (error) {
    deps.logger.warn('Could not create temporary voice channel', {
      guildId: guild.id,
      userId: data.user_id,
      error: (error as Error).message,
    });
  } finally {
    pendingTempChannels.delete(data.user_id);
  }
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
      await sendWelcome(
        { id: member.id, name: member.displayName ?? member.user.username },
        guild,
        'join',
        deps,
      );
    })().catch((error) => {
      logger.error('Member add handler crashed', { error: (error as Error).message });
    });
  });

  client.on(Events.GuildMemberRemove, (member) => {
    void (async () => {
      const partial = member as unknown as {
        guild: Guild;
        id: string;
        user?: { username: string };
        displayName?: string;
      };
      if (!partial.guild) return;
      await sendWelcome(
        {
          id: partial.id,
          name: partial.displayName ?? partial.user?.username ?? partial.id,
        },
        partial.guild,
        'leave',
        deps,
      );
    })().catch((error) => {
      logger.error('Member remove handler crashed', { error: (error as Error).message });
    });
  });

  client.on(Events.VoiceStateUpdate, (data) => {
    void handleVoiceState(data as VoiceStateLike, deps).catch((error) => {
      logger.error('Voice state handler crashed', { error: (error as Error).message });
    });
  });

  client.on(Events.GuildCreate, (guild: Guild) => {
    void deps.registry
      .markPresent(guild)
      .then(() => writeSnapshot(guild, deps))
      .catch((error) =>
        logger.error('Guild create handler crashed', { error: (error as Error).message }),
      );
  });

  client.on(Events.GuildUpdate, (_oldGuild: Guild, guild: Guild) => {
    void deps.registry
      .markPresent(guild)
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

    // Reconcile presence for every guild the gateway knows about. This heals
    // rows created by a dashboard login before the bot joined.
    void (async () => {
      const guildIds = [...client.guilds.cache.keys()];
      await setBotPresence(deps.db, deps.instanceId, guildIds);
      for (const guild of client.guilds.cache.values()) {
        await writeSnapshot(guild, deps);
      }
    })().catch((error) => {
      logger.error('Ready reconciliation failed', { error: (error as Error).message });
    });
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

  const event = {
    userId: payload.userId,
    channelId: payload.channelId,
    messageId: payload.messageId,
    emoji,
    added,
    isBot: payload.user.bot ?? false,
  };

  const rolesCtx = await contextFor(guild, payload.channelId, deps, 'roles');
  await onRolesReaction(rolesCtx, event);

  const giveawayCtx = await contextFor(guild, payload.channelId, deps, 'giveaways');
  await onGiveawayReaction(giveawayCtx, event);
}
