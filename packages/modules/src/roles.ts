import {
  arg,
  type CommandContext,
  type CommandDefinition,
  type RoleLike,
  type RuntimeContext,
} from '@fluxbot/core';
import { findReactionRole, listAutoRoles, listReactionRoles, listSelfRoles } from '@fluxbot/db';
import { type RolesConfig, rolesConfigSchema } from './config';

const EMBED_COLOR = 0x06b6d4;

function configOf(ctx: RuntimeContext): RolesConfig {
  return ctx.config as unknown as RolesConfig;
}

async function resolveSelfRole(ctx: CommandContext, requested: RoleLike): Promise<RoleLike | null> {
  if (!ctx.guildUuid || !ctx.guild) return null;
  const self = await listSelfRoles(ctx.db, ctx.guildUuid);
  if (!self.some((row) => row.roleId === requested.id)) return null;
  const roles = await ctx.actions.guildRoles(ctx.guild.id);
  return roles.find((role) => role.id === requested.id) ?? null;
}

const rolesCommand: CommandDefinition = {
  name: 'roles',
  description: 'List the roles you can assign yourself',
  usage: 'roles',
  category: 'roles',
  module: 'roles',
  guildOnly: true,
  defaultCooldownSeconds: 5,
  async run(ctx) {
    const config = configOf(ctx);
    if (!config.enabled || !config.allowSelfRoles) {
      await ctx.reply('Self-assignable roles are disabled on this server.');
      return;
    }
    if (!ctx.guildUuid || !ctx.guild) return;

    const [self, reaction] = await Promise.all([
      listSelfRoles(ctx.db, ctx.guildUuid),
      listReactionRoles(ctx.db, ctx.guildUuid),
    ]);

    if (self.length === 0 && reaction.length === 0) {
      await ctx.reply(
        'No self-assignable roles yet. Server admins can set them up in the dashboard.',
      );
      return;
    }

    const lines: string[] = [];
    for (const row of self) {
      const roles = await ctx.actions.guildRoles(ctx.guild.id);
      const role = roles.find((candidate) => candidate.id === row.roleId);
      if (role) lines.push(`<@&${role.id}> — \`${ctx.prefix}iam ${role.name}\``);
    }

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
    if (lines.length > 0) {
      fields.push({ name: 'Self-assignable', value: lines.join('\n') });
    }
    if (reaction.length > 0) {
      fields.push({
        name: 'Reaction roles',
        value: `${reaction.length} message${reaction.length === 1 ? '' : 's'} with role menus — react on the message to toggle.`,
      });
    }

    await ctx.reply({
      embeds: [{ title: 'Roles', color: EMBED_COLOR, fields }],
    });
  },
};

const iamCommand: CommandDefinition = {
  name: 'iam',
  aliases: ['giverole'],
  description: 'Give yourself a self-assignable role',
  usage: 'iam <role>',
  category: 'roles',
  module: 'roles',
  guildOnly: true,
  permissions: { bot: ['MANAGE_ROLES'] },
  defaultCooldownSeconds: 3,
  args: { role: arg.role() },
  async run(ctx) {
    const config = configOf(ctx);
    if (!config.enabled || !config.allowSelfRoles) {
      await ctx.reply('Self-assignable roles are disabled on this server.');
      return;
    }
    if (!ctx.guild || !ctx.member) return;

    const requested = ctx.args.role as RoleLike;
    const role = await resolveSelfRole(ctx, requested);
    if (!role) {
      await ctx.reply('That role is not self-assignable. Run `roles` to see your options.');
      return;
    }
    if (ctx.member.roles.includes(role.id)) {
      await ctx.reply(`You already have <@&${role.id}>.`);
      return;
    }
    if (!(await ctx.actions.canManageRole(ctx.guild.id, role.id))) {
      await ctx.reply('I cannot assign that role — it is above my highest role.');
      return;
    }

    await ctx.actions.addRole(ctx.guild.id, ctx.member.id, role.id);
    await ctx.reply(`You now have <@&${role.id}>.`);
  },
};

const iamNotCommand: CommandDefinition = {
  name: 'iamnot',
  aliases: ['removerole'],
  description: 'Remove a self-assignable role from yourself',
  usage: 'iamnot <role>',
  category: 'roles',
  module: 'roles',
  guildOnly: true,
  permissions: { bot: ['MANAGE_ROLES'] },
  defaultCooldownSeconds: 3,
  args: { role: arg.role() },
  async run(ctx) {
    const config = configOf(ctx);
    if (!config.enabled || !config.allowSelfRoles) {
      await ctx.reply('Self-assignable roles are disabled on this server.');
      return;
    }
    if (!ctx.guild || !ctx.member) return;

    const requested = ctx.args.role as RoleLike;
    const role = await resolveSelfRole(ctx, requested);
    if (!role) {
      await ctx.reply('That role is not self-assignable.');
      return;
    }
    if (!ctx.member.roles.includes(role.id)) {
      await ctx.reply(`You do not have <@&${role.id}>.`);
      return;
    }
    if (!(await ctx.actions.canManageRole(ctx.guild.id, role.id))) {
      await ctx.reply('I cannot remove that role — it is above my highest role.');
      return;
    }

    await ctx.actions.removeRole(ctx.guild.id, ctx.member.id, role.id);
    await ctx.reply(`Removed <@&${role.id}>.`);
  },
};

export const rolesCommands: CommandDefinition[] = [rolesCommand, iamCommand, iamNotCommand];

export interface ReactionEvent {
  userId: string;
  channelId: string;
  messageId: string;
  /** Normalised as `name:id` for custom emoji or the unicode character. */
  emoji: string;
  added: boolean;
  isBot: boolean;
}

/** Toggle a reaction role. Ignored when the menu or module is disabled. */
export async function onRolesReaction(ctx: RuntimeContext, event: ReactionEvent): Promise<void> {
  const config = configOf(ctx);
  if (!config.enabled || !config.reactionRolesEnabled) return;
  if (event.isBot || !ctx.guild || !ctx.guildUuid) return;

  const mapping = await findReactionRole(ctx.db, ctx.guildUuid, event.messageId, event.emoji);
  if (!mapping) return;

  if (!(await ctx.actions.canManageRole(ctx.guild.id, mapping.roleId))) {
    ctx.logger.warn('Skipping reaction role above bot hierarchy', {
      guildId: ctx.guild.id,
      roleId: mapping.roleId,
    });
    return;
  }

  try {
    if (mapping.mode === 'unique') {
      const siblings = await listReactionRoles(ctx.db, ctx.guildUuid);
      for (const sibling of siblings) {
        if (sibling.messageId !== event.messageId) continue;
        if (sibling.roleId === mapping.roleId) continue;
        await ctx.actions.removeRole(ctx.guild.id, event.userId, sibling.roleId);
      }
    }

    if (event.added) {
      await ctx.actions.addRole(ctx.guild.id, event.userId, mapping.roleId);
    } else {
      await ctx.actions.removeRole(ctx.guild.id, event.userId, mapping.roleId);
    }
  } catch (error) {
    ctx.logger.warn('Reaction role update failed', {
      guildId: ctx.guild.id,
      userId: event.userId,
      roleId: mapping.roleId,
      error: (error as Error).message,
    });
  }
}

/** Grant auto-roles when a member joins. */
export async function onRolesMemberAdd(ctx: RuntimeContext, userId: string): Promise<void> {
  const config = configOf(ctx);
  if (!config.enabled || !config.autoRolesOnJoin) return;
  if (!ctx.guild || !ctx.guildUuid) return;

  const roles = await listAutoRoles(ctx.db, ctx.guildUuid);
  for (const row of roles) {
    if (!(await ctx.actions.canManageRole(ctx.guild.id, row.roleId))) continue;
    try {
      await ctx.actions.addRole(ctx.guild.id, userId, row.roleId);
    } catch (error) {
      ctx.logger.warn('Auto-role grant failed', {
        guildId: ctx.guild.id,
        userId,
        roleId: row.roleId,
        error: (error as Error).message,
      });
    }
  }
}

export const rolesConfig = {
  schema: rolesConfigSchema,
  parse(raw: Record<string, unknown> | null): Record<string, unknown> {
    return rolesConfigSchema.parse(raw ?? {}) as unknown as Record<string, unknown>;
  },
};
