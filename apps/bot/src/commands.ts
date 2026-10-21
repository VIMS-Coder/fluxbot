import {
  type CommandContext,
  type CommandDefinition,
  type CooldownStore,
  cooldownKey,
  type Logger,
  type MemberLike,
  type MessageLike,
  parseArgs,
  parsePrefixCommand,
  type RuntimeContext,
  type SendPayload,
} from '@fluxbot/core';
import { type Database, getCommandSetting, recordAnalytics } from '@fluxbot/db';
import {
  hasAnyPermission,
  hasPermission,
  Permission,
  type PermissionName,
  parsePermissionMask,
} from '@fluxbot/fluxer';
import { onLevelsMessage } from '@fluxbot/modules';
import type { Guild, Message } from '@fluxerjs/core';
import {
  type FluxerActions,
  toChannelLike,
  toGuildLike,
  toMemberLike,
  toMessageLike,
} from './runtime/actions';
import type { ConfigService } from './runtime/configService';
import type { GuildRegistry } from './runtime/guildRegistry';

export class CommandIndex {
  private readonly byName = new Map<string, CommandDefinition>();

  constructor(commands: CommandDefinition[]) {
    for (const command of commands) {
      this.byName.set(command.name, command);
      for (const alias of command.aliases ?? []) this.byName.set(alias, command);
    }
  }

  get(name: string): CommandDefinition | undefined {
    return this.byName.get(name);
  }

  getAll(): CommandDefinition[] {
    return [...new Set(this.byName.values())];
  }
}

export interface CommandDeps {
  db: Database;
  actions: FluxerActions;
  configs: ConfigService;
  registry: GuildRegistry;
  index: CommandIndex;
  cooldowns: CooldownStore;
  logger: Logger;
  botId: string;
  operatorIds: string[];
  instanceOrigin: string;
  version: string;
}

function normalize(payload: string | SendPayload): SendPayload {
  return typeof payload === 'string' ? { content: payload } : payload;
}

export interface BaseContextInput {
  guild: Guild | null;
  guildUuid: string | null;
  member: MemberLike | null;
  channelId: string;
  message: MessageLike;
  config: Record<string, unknown>;
  isCommand: boolean;
}

export function createRuntimeContext(deps: CommandDeps, input: BaseContextInput): RuntimeContext {
  return {
    guild: input.guild ? toGuildLike(input.guild) : null,
    guildUuid: input.guildUuid,
    member: input.member,
    channel: { id: input.channelId, name: null, type: 0 },
    message: input.message,
    config: input.config,
    db: deps.db,
    actions: deps.actions,
    logger: deps.logger,
    commands: deps.index.getAll(),
    instanceOrigin: deps.instanceOrigin,
    botVersion: deps.version,
    isCommand: input.isCommand,
    reply: async (payload) => {
      await deps.actions.reply(input.message, normalize(payload));
    },
    send: async (channelId, payload) => {
      await deps.actions.send(channelId, normalize(payload));
    },
  };
}

export function permissionLevelAllows(level: string, mask: bigint): boolean {
  switch (level) {
    case 'admin':
      return hasPermission(mask, Permission.MANAGE_GUILD);
    case 'moderator':
      return hasAnyPermission(mask, [
        Permission.MODERATE_MEMBERS,
        Permission.MANAGE_MESSAGES,
        Permission.KICK_MEMBERS,
        Permission.BAN_MEMBERS,
        Permission.VIEW_AUDIT_LOG,
      ]);
    default:
      return true;
  }
}

function missingPermissions(mask: bigint, required: PermissionName[]): PermissionName[] {
  return required.filter((name) => !hasPermission(mask, Permission[name]));
}

/**
 * Handle one gateway message: resolve the prefix, run guards, execute, and
 * grant XP.
 *
 * Called for every visible message, so the early exits are deliberately cheap.
 */
export async function handleMessage(message: Message, deps: CommandDeps): Promise<void> {
  if (message.author.bot || message.webhookId) return;

  const messageLike = toMessageLike(message);
  const guild = message.guild;

  let guildUuid: string | null = null;
  let prefix = '!';

  if (guild) {
    const entry = await deps.registry.ensure(guild);
    guildUuid = entry.uuid;
    prefix = entry.prefix;
  }

  const parsed = parsePrefixCommand(messageLike.content, [prefix], deps.botId);
  const isCommand = parsed !== null;
  const command = parsed ? deps.index.get(parsed.name) : undefined;

  const member = messageLike.member ?? null;

  // XP runs on plain chat and (by config) on commands.
  if (guildUuid) {
    try {
      const levelsConfig = await deps.configs.get(guildUuid, 'levels');
      const xpContext = createRuntimeContext(deps, {
        guild,
        guildUuid,
        member,
        channelId: message.channelId,
        message: messageLike,
        config: levelsConfig,
        isCommand,
      });
      await onLevelsMessage(xpContext);
    } catch (error) {
      deps.logger.error('XP handler failed', { error: (error as Error).message });
    }
  }

  if (!parsed || !command) return;

  if (command.guildOnly && !guild) {
    await deps.actions.reply(messageLike, {
      content: `\`${command.name}\` only works inside a server.`,
    });
    return;
  }

  if (command.operatorOnly && !deps.operatorIds.includes(messageLike.author.id)) {
    return;
  }

  const mask = parsePermissionMask(member?.permissions ?? '0');

  // Per-guild overrides from the dashboard.
  let enabled = true;
  let permissionLevel = 'default';
  let cooldownMs = (command.defaultCooldownSeconds ?? 0) * 1000;

  if (guildUuid) {
    try {
      const setting = await getCommandSetting(deps.db, guildUuid, command.name);
      if (setting) {
        enabled = setting.enabled;
        permissionLevel = setting.permissionLevel;
        if (setting.cooldownMs !== null) cooldownMs = setting.cooldownMs;
      }
    } catch (error) {
      deps.logger.warn('Could not read command settings', {
        command: command.name,
        error: (error as Error).message,
      });
    }
  }

  if (!enabled) return;

  if (!permissionLevelAllows(permissionLevel, mask)) {
    await deps.actions.reply(messageLike, {
      content: `You do not have permission to use \`${command.name}\`.`,
    });
    return;
  }

  const requiredUserPermissions = command.permissions?.user ?? [];
  const missingUser = missingPermissions(mask, requiredUserPermissions);
  if (missingUser.length > 0) {
    await deps.actions.reply(messageLike, {
      content: `You need ${missingUser.map((name) => `**${name.replaceAll('_', ' ').toLowerCase()}**`).join(', ')} to use \`${command.name}\`.`,
    });
    return;
  }

  if (guild && command.permissions?.bot?.length) {
    const missingBot: PermissionName[] = [];
    for (const permission of command.permissions.bot) {
      if (!(await deps.actions.botHasPermission(guild.id, permission))) {
        missingBot.push(permission);
      }
    }
    if (missingBot.length > 0) {
      await deps.actions.reply(messageLike, {
        content: `I need ${missingBot.map((name) => `**${name.replaceAll('_', ' ').toLowerCase()}**`).join(', ')} to run \`${command.name}\`.`,
      });
      return;
    }
  }

  const coolKey = cooldownKey(guild?.id ?? null, messageLike.author.id, command.name);
  if (cooldownMs > 0) {
    const remaining = deps.cooldowns.remaining(coolKey);
    if (remaining > 0) return;
  }

  const config = guildUuid ? await deps.configs.get(guildUuid, command.module) : {};

  const parsedArgs = await parseArgs(command.args ?? {}, parsed.rawArgs, {
    resolveMember: async (token) => {
      if (!guild) return null;
      if (!/^\d+$/.test(token)) return null;
      return deps.actions.fetchMember(guild.id, token);
    },
    resolveRole: async (token) => {
      if (!guild) return null;
      const roles = await deps.actions.guildRoles(guild.id);
      return (
        roles.find((role) => role.id === token) ??
        roles.find((role) => role.name.toLowerCase() === token.toLowerCase()) ??
        null
      );
    },
  });

  if (!parsedArgs.ok) {
    await deps.actions.reply(messageLike, {
      content: `${parsedArgs.error}\n**Usage:** \`${prefix}${command.usage ?? command.name}\``,
    });
    return;
  }

  if (cooldownMs > 0) deps.cooldowns.set(coolKey, cooldownMs);

  const context: CommandContext = {
    ...createRuntimeContext(deps, {
      guild,
      guildUuid,
      member,
      channelId: message.channelId,
      message: messageLike,
      config,
      isCommand: true,
    }),
    message: messageLike,
    args: parsedArgs.values,
    rawArgs: parsed.rawArgs,
    command,
    prefix: parsed.prefix,
  };

  try {
    await command.run(context);
    if (guildUuid) {
      void recordAnalytics(deps.db, {
        guildId: guildUuid,
        type: 'command',
        name: command.name,
        userId: messageLike.author.id,
      }).catch(() => {});
    }
  } catch (error) {
    deps.logger.error('Command failed', {
      command: command.name,
      guildId: guild?.id,
      userId: messageLike.author.id,
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    await deps.actions
      .reply(messageLike, {
        content: 'Something went wrong while running that command. The error has been logged.',
      })
      .catch(() => {});
  }
}

/** Convert a gateway guild member into the shared shape. */
export function memberFromMessage(message: Message): MemberLike | null {
  return message.member ? toMemberLike(message.member) : null;
}

export { toChannelLike };
