import type { Database } from '@fluxbot/db';
import type { PermissionName } from '@fluxbot/fluxer';

export interface UserLike {
  id: string;
  username: string;
  globalName?: string | null;
  bot?: boolean;
}

export interface MemberLike {
  id: string;
  roles: string[];
  permissions: string;
  displayName?: string;
  username?: string;
  joinedAt?: Date | null;
}

export interface GuildLike {
  id: string;
  name: string;
  icon?: string | null;
  ownerId?: string | null;
  memberCount?: number | null;
}

export interface ChannelLike {
  id: string;
  name: string | null;
  type: number;
}

export interface RoleLike {
  id: string;
  name: string;
  position: number;
  color?: number;
}

export interface MessageLike {
  id: string;
  channelId: string;
  guildId: string | null;
  content: string;
  author: UserLike;
  member?: MemberLike | null;
  createdAt?: Date;
}

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface Embed {
  title?: string;
  description?: string;
  url?: string;
  color?: number;
  fields?: EmbedField[];
  footer?: { text: string; icon_url?: string };
  author?: { name: string; icon_url?: string; url?: string };
  image?: { url: string };
  thumbnail?: { url: string };
  timestamp?: string;
}

export interface SendPayload {
  content?: string;
  embeds?: Embed[];
}

export interface BotActions {
  send(channelId: string, payload: SendPayload): Promise<{ id: string }>;
  reply(message: MessageLike, payload: SendPayload): Promise<{ id: string }>;
  deleteMessage(channelId: string, messageId: string): Promise<void>;
  addReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
  removeUserReaction(
    channelId: string,
    messageId: string,
    emoji: string,
    userId: string,
  ): Promise<void>;
  addRole(guildId: string, userId: string, roleId: string): Promise<void>;
  removeRole(guildId: string, userId: string, roleId: string): Promise<void>;
  fetchMember(guildId: string, userId: string): Promise<MemberLike | null>;
  botHasPermission(guildId: string, permission: PermissionName): Promise<boolean>;
  /** Whether the bot's highest role is above `roleId`. */
  canManageRole(guildId: string, roleId: string): Promise<boolean>;
  guildRoles(guildId: string): Promise<RoleLike[]>;
  guildMemberCount(guildId: string): Promise<number>;
}

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

export type CommandCategory = 'core' | 'levels' | 'fun' | 'roles' | 'moderation';

export interface RuntimeContext {
  guild: GuildLike | null;
  /** Local database row id for the guild, or null in DMs. */
  guildUuid: string | null;
  member: MemberLike | null;
  channel: ChannelLike | null;
  message?: MessageLike;
  /** Module configuration for this guild, already validated. */
  config: Record<string, unknown>;
  db: Database;
  actions: BotActions;
  logger: Logger;
  commands: CommandDefinition[];
  latencyMs?: number;
  instanceOrigin?: string;
  botVersion?: string;
  /** True when the message was already recognised as a command. */
  isCommand?: boolean;
  reply(payload: string | SendPayload): Promise<void>;
  send(channelId: string, payload: string | SendPayload): Promise<void>;
}

export interface CommandContext extends RuntimeContext {
  message: MessageLike;
  /** Parsed positional arguments. Cast at the command boundary. */
  args: Record<string, unknown>;
  rawArgs: string;
  command: CommandDefinition;
  prefix: string;
}

export interface CommandDefinition {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  category: CommandCategory;
  module: string;
  guildOnly?: boolean;
  operatorOnly?: boolean;
  permissions?: {
    user?: PermissionName[];
    bot?: PermissionName[];
  };
  defaultCooldownSeconds?: number;
  args?: ArgSchema;
  run(ctx: CommandContext): Promise<unknown>;
}

export interface ArgSpec {
  kind: 'member' | 'role' | 'string' | 'integer' | 'duration' | 'choices' | 'rest';
  optional?: boolean;
  choices?: readonly string[];
  min?: number;
  max?: number;
  defaultValue?: unknown;
}

export type ArgSchema = Record<string, ArgSpec>;

export type ParsedArgs = Record<string, unknown>;

export interface ArgResolvers {
  resolveMember(token: string): Promise<MemberLike | null>;
  resolveRole(token: string): Promise<RoleLike | null>;
}

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  commands: CommandDefinition[];
  /** Returns the validated config for a guild (defaults merged in). */
  getConfig?(raw: Record<string, unknown> | null): Record<string, unknown>;
  requiredBotPermissions?: PermissionName[];
}
