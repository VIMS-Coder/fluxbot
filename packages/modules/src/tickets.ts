import { arg, type CommandContext, type CommandDefinition } from '@fluxbot/core';
import { closeTicket, createTicket, findOpenTicketForUser, getTicketByChannel } from '@fluxbot/db';
import { hasPermission, Permission, parsePermissionMask } from '@fluxbot/fluxer';
import { ticketsConfigSchema } from './config';

function renderTicketWelcome(template: string, vars: { user: string; staff: string }): string {
  return template.replaceAll('{user}', vars.user).replaceAll('{staff}', vars.staff).slice(0, 2000);
}

const ticketCommand: CommandDefinition = {
  name: 'ticket',
  description: 'Open, close or add someone to a support ticket',
  usage: 'ticket [open|close|add <user>]',
  category: 'community',
  module: 'tickets',
  guildOnly: true,
  permissions: {
    bot: [
      'CREATE_PRIVATE_THREADS',
      'SEND_MESSAGES_IN_THREADS',
      'MANAGE_THREADS',
      'READ_MESSAGE_HISTORY',
    ],
  },
  defaultCooldownSeconds: 5,
  args: {
    action: arg.string({ optional: true }),
    rest: arg.rest({ optional: true }),
  },
  async run(ctx: CommandContext) {
    const config = ticketsConfigSchema.parse(ctx.config);
    if (!config.enabled) {
      await ctx.reply('Tickets are disabled on this server.');
      return;
    }
    if (!ctx.guild || !ctx.guildUuid || !ctx.channel || !ctx.member) return;

    const action = ((ctx.args.action as string | undefined) ?? 'open').toLowerCase();
    const tokens = ((ctx.args.rest as string) || '').split(/\s+/).filter(Boolean);

    if (action === 'close') {
      const ticket = await getTicketByChannel(ctx.db, ctx.channel.id);
      if (!ticket) {
        await ctx.reply('This channel is not a ticket.');
        return;
      }

      const mask = parsePermissionMask(ctx.member.permissions);
      const isStaff =
        hasPermission(mask, Permission.MANAGE_THREADS) ||
        (config.staffRoleId !== null && ctx.member.roles.includes(config.staffRoleId));

      if (!isStaff && ticket.userId !== ctx.member.id) {
        await ctx.reply('Only staff or the ticket opener can close this ticket.');
        return;
      }

      await closeTicket(ctx.db, ticket.id);
      await ctx.actions.archiveThread(ctx.channel.id);
      await ctx.reply('Ticket closed and archived.');
      return;
    }

    if (action === 'add') {
      const ticket = await getTicketByChannel(ctx.db, ctx.channel.id);
      if (!ticket) {
        await ctx.reply('This channel is not a ticket.');
        return;
      }
      const token = tokens[0];
      if (!token) {
        await ctx.reply('Usage: `ticket add <user>`');
        return;
      }
      const userId = token.replace(/[<@!>]/g, '');
      const member = await ctx.actions.fetchMember(ctx.guild.id, userId);
      if (!member) {
        await ctx.reply('Could not find that member.');
        return;
      }
      await ctx.actions.addThreadMember(ctx.channel.id, member.id);
      await ctx.reply(`Added ${member.displayName ?? `<@${member.id}>`} to the ticket.`);
      return;
    }

    if (action !== 'open') {
      await ctx.reply('Usage: `ticket [open|close|add <user>]`');
      return;
    }

    if (!config.parentChannelId) {
      await ctx.reply('Tickets are not configured yet. Ask an admin to set a parent channel.');
      return;
    }

    const existing = await findOpenTicketForUser(ctx.db, ctx.guildUuid, ctx.member.id);
    if (existing) {
      await ctx.reply(`You already have an open ticket: <#${existing.channelId}>`);
      return;
    }

    const name = `ticket-${ctx.message.author.username}`.slice(0, 100);
    const thread = await ctx.actions.createPrivateThread(config.parentChannelId, name);
    await ctx.actions.addThreadMember(thread.id, ctx.member.id);

    await createTicket(ctx.db, {
      guildId: ctx.guildUuid,
      channelId: thread.id,
      userId: ctx.member.id,
    });

    const staffMention = config.staffRoleId ? `<@&${config.staffRoleId}>` : 'Staff';
    const welcome = renderTicketWelcome(config.welcomeMessage, {
      user: `<@${ctx.member.id}>`,
      staff: staffMention,
    });

    await ctx.actions.send(thread.id, { content: welcome });
    await ctx.actions.send(thread.id, {
      content: `${staffMention} — a new ticket was opened by <@${ctx.member.id}>. Use \`!ticket close\` when it is resolved.`,
    });

    await ctx.reply(`Ticket opened: <#${thread.id}>`);
  },
};

export const ticketCommands: CommandDefinition[] = [ticketCommand];

export const ticketsConfig = {
  schema: ticketsConfigSchema,
  parse(raw: Record<string, unknown> | null): Record<string, unknown> {
    return ticketsConfigSchema.parse(raw ?? {}) as unknown as Record<string, unknown>;
  },
};
