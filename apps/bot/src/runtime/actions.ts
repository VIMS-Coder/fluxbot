import type {
  BotActions,
  ChannelLike,
  GuildLike,
  MemberLike,
  MessageLike,
  RoleLike,
  SendPayload,
} from '@fluxbot/core';
import { hasPermission, Permission, type PermissionName } from '@fluxbot/fluxer';
import type { Channel, Client, Guild, GuildMember, Message, Role } from '@fluxerjs/core';

function textChannel(client: Client, channelId: string) {
  return client.channels.fetch(channelId).then((channel: Channel) => {
    if (!channel.isTextBased()) {
      throw new Error(`Channel ${channelId} is not text-based`);
    }
    return channel;
  });
}

export class FluxerActions implements BotActions {
  constructor(private readonly client: Client) {}

  private get guilds() {
    return this.client.guilds;
  }

  private guild(guildId: string): Guild {
    const guild = this.guilds.cache.get(guildId);
    if (!guild) throw new Error(`Guild ${guildId} is not cached`);
    return guild;
  }

  async send(channelId: string, payload: SendPayload): Promise<{ id: string }> {
    const channel = await textChannel(this.client, channelId);
    const message = await channel.send({
      content: payload.content,
      embeds: payload.embeds as never,
    });
    return { id: message.id };
  }

  async reply(message: MessageLike, payload: SendPayload): Promise<{ id: string }> {
    const channel = await textChannel(this.client, message.channelId);
    const sent = await channel.send({
      content: payload.content,
      embeds: payload.embeds as never,
      replyTo: { channelId: message.channelId, messageId: message.id },
    });
    return { id: sent.id };
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    const channel = await textChannel(this.client, channelId);
    const message = await channel.messages.fetch(messageId);
    await message.delete();
  }

  async addReaction(channelId: string, messageId: string, emoji: string): Promise<void> {
    const channel = await textChannel(this.client, channelId);
    const message = await channel.messages.fetch(messageId);
    await message.react(emoji);
  }

  async removeUserReaction(
    channelId: string,
    messageId: string,
    emoji: string,
    userId: string,
  ): Promise<void> {
    const channel = await textChannel(this.client, channelId);
    const message = await channel.messages.fetch(messageId);
    await message.removeReaction(emoji, userId);
  }

  async addRole(guildId: string, userId: string, roleId: string): Promise<void> {
    const member = await this.fetchSdkMember(guildId, userId);
    await member.roles.add(roleId);
  }

  async removeRole(guildId: string, userId: string, roleId: string): Promise<void> {
    const member = await this.fetchSdkMember(guildId, userId);
    await member.roles.remove(roleId);
  }

  async fetchMember(guildId: string, userId: string): Promise<MemberLike | null> {
    try {
      const member = await this.fetchSdkMember(guildId, userId);
      return toMemberLike(member);
    } catch {
      return null;
    }
  }

  async botHasPermission(guildId: string, permission: PermissionName): Promise<boolean> {
    const guild = this.guild(guildId);
    const me = await guild.members.fetchMe();
    return hasPermission(me.permissions.bitfield, Permission[permission]);
  }

  async canManageRole(guildId: string, roleId: string): Promise<boolean> {
    const guild = this.guild(guildId);
    if (roleId === guild.id) return false;
    const role = guild.roles.get(roleId);
    if (!role) return false;
    const me = await guild.members.fetchMe();
    const highest = me.roles.cache.reduce(
      (max: number, botRole: Role) => Math.max(max, botRole.position),
      0,
    );
    return role.position < highest;
  }

  async guildRoles(guildId: string): Promise<RoleLike[]> {
    const guild = this.guild(guildId);
    return [...guild.roles.values()].map(toRoleLike);
  }

  async guildMemberCount(guildId: string): Promise<number> {
    const guild = this.guild(guildId);
    return guild.memberCount ?? guild.members.size;
  }

  private async fetchSdkMember(guildId: string, userId: string): Promise<GuildMember> {
    const guild = this.guild(guildId);
    return guild.members.resolve(userId);
  }
}

export function toMemberLike(member: GuildMember): MemberLike {
  return {
    id: member.id,
    roles: [...member.roles.roleIds],
    permissions: member.permissions.bitfield.toString(),
    displayName: member.displayName,
    username: member.user.username,
    joinedAt: member.joinedAt ?? null,
  };
}

export function toGuildLike(guild: Guild): GuildLike {
  return {
    id: guild.id,
    name: guild.name,
    icon: guild.icon,
    ownerId: guild.ownerId,
    memberCount: guild.memberCount,
  };
}

export function toChannelLike(channel: Channel): ChannelLike {
  return {
    id: channel.id,
    name: 'name' in channel ? (channel.name ?? null) : null,
    type: Number(channel.type),
  };
}

export function toMessageLike(message: Message): MessageLike {
  return {
    id: message.id,
    channelId: message.channelId,
    guildId: message.guildId,
    content: message.content,
    author: {
      id: message.author.id,
      username: message.author.username,
      globalName: message.author.globalName,
      bot: message.author.bot,
    },
    member: message.member ? toMemberLike(message.member) : null,
    createdAt: message.createdAt,
  };
}

export function toRoleLike(role: Role): RoleLike {
  return {
    id: role.id,
    name: role.name,
    position: role.position,
    color: role.color,
  };
}
