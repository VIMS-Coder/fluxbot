import { randomInt } from 'node:crypto';
import {
  arg,
  type CommandContext,
  type CommandDefinition,
  type Embed,
  type Logger,
  type RuntimeContext,
} from '@fluxbot/core';
import {
  addGiveawayEntry,
  createGiveaway,
  type Database,
  endGiveaway,
  findActiveGiveawayByMessage,
  getGiveaway,
  listGiveawayEntries,
  listGiveaways,
  removeGiveawayEntry,
  setGiveawayMessage,
} from '@fluxbot/db';
import { giveawaysConfigSchema } from './config';

const EMBED_COLOR = 0x8b5cf6;

/** Pick up to `count` unique winners. Fair to every entry, even for huge lists. */
export function pickWinners(userIds: string[], count: number): string[] {
  const pool = [...userIds];
  const winners: string[] = [];
  const target = Math.min(Math.max(1, count), pool.length);

  while (winners.length < target && pool.length > 0) {
    const index = randomInt(pool.length);
    winners.push(pool.splice(index, 1)[0]!);
  }
  return winners;
}

export function giveawayEmbed(input: {
  prize: string;
  emoji: string;
  winnersCount: number;
  endsAt: Date;
  entries: number;
  hostId: string;
  ended?: boolean;
  winners?: string[];
}): Embed {
  if (input.ended) {
    const result =
      input.winners && input.winners.length > 0
        ? input.winners.map((id) => `<@${id}>`).join(', ')
        : 'No valid entries';

    return {
      title: '🎉 Giveaway ended',
      description: `**${input.prize}**\n\nWinner${input.winners && input.winners.length === 1 ? '' : 's'}: ${result}`,
      color: EMBED_COLOR,
      fields: [{ name: 'Entries', value: String(input.entries), inline: true }],
      footer: { text: `Hosted by ${input.hostId}` },
    };
  }

  return {
    title: '🎉 Giveaway',
    description: `**${input.prize}**\n\nReact with ${input.emoji} to enter!`,
    color: EMBED_COLOR,
    fields: [
      { name: 'Ends', value: input.endsAt.toISOString(), inline: true },
      {
        name: 'Winners',
        value: String(input.winnersCount),
        inline: true,
      },
      { name: 'Entries', value: String(input.entries), inline: true },
    ],
    footer: { text: 'Fluxbot giveaways' },
  };
}

export interface GiveawayFinishDeps {
  db: Database;
  actions: RuntimeContext['actions'];
  logger: Logger;
}

/** End a giveaway, pick winners, edit the original message and announce. */
export async function finishGiveaway(
  deps: GiveawayFinishDeps,
  giveaway: Awaited<ReturnType<typeof getGiveaway>>,
): Promise<string[]> {
  if (!giveaway) return [];
  if (giveaway.status !== 'active') return [];

  const entries = await listGiveawayEntries(deps.db, giveaway.id);
  const winners = pickWinners(
    entries.map((entry) => entry.userId),
    giveaway.winnersCount,
  );

  await endGiveaway(deps.db, giveaway.id);

  const endedEmbed = giveawayEmbed({
    prize: giveaway.prize,
    emoji: giveaway.emoji,
    winnersCount: giveaway.winnersCount,
    endsAt: giveaway.endsAt,
    entries: entries.length,
    hostId: giveaway.createdBy,
    ended: true,
    winners,
  });

  if (giveaway.messageId) {
    try {
      await deps.actions.editMessage(giveaway.channelId, giveaway.messageId, {
        embeds: [endedEmbed],
      });
    } catch (error) {
      deps.logger.warn('Could not edit giveaway message', {
        giveawayId: giveaway.id,
        error: (error as Error).message,
      });
    }
  }

  const announcement =
    winners.length > 0
      ? winners.map((id) => `<@${id}>`).join(', ')
      : 'No one entered — no winner this time.';

  try {
    await deps.actions.send(giveaway.channelId, {
      content: `🎉 Giveaway for **${giveaway.prize}** ended. ${announcement}`,
    });
  } catch (error) {
    deps.logger.warn('Could not announce giveaway winner', {
      giveawayId: giveaway.id,
      error: (error as Error).message,
    });
  }

  return winners;
}

const giveawayCommand: CommandDefinition = {
  name: 'giveaway',
  aliases: ['gw'],
  description: 'Start, end or list giveaways',
  usage: 'giveaway <start|end|list> [...]',
  category: 'community',
  module: 'giveaways',
  guildOnly: true,
  permissions: {
    user: ['MANAGE_GUILD'],
    bot: ['SEND_MESSAGES', 'EMBED_LINKS', 'ADD_REACTIONS', 'READ_MESSAGE_HISTORY'],
  },
  defaultCooldownSeconds: 3,
  args: {
    action: arg.choices(['start', 'end', 'list'] as const),
    rest: arg.rest({ optional: true }),
  },
  async run(ctx: CommandContext) {
    const config = giveawaysConfigSchema.parse(ctx.config);
    if (!config.enabled) {
      await ctx.reply('Giveaways are disabled on this server.');
      return;
    }
    if (!ctx.guildUuid || !ctx.channel) return;

    const action = ctx.args.action as string;
    const tokens = ((ctx.args.rest as string) || '').split(/\s+/).filter(Boolean);

    if (action === 'start') {
      const duration = Number.parseInt(tokens[0] ?? '', 10);
      const winners = Number.parseInt(tokens[1] ?? '', 10);
      const prize = tokens.slice(2).join(' ').trim();

      if (!Number.isFinite(duration) || duration < 1 || !Number.isFinite(winners)) {
        await ctx.reply('Usage: `giveaway start <minutes> <winners> <prize>`');
        return;
      }
      if (winners < 1 || winners > 20) {
        await ctx.reply('Winners must be between 1 and 20.');
        return;
      }
      if (!prize) {
        await ctx.reply('Add a prize: `giveaway start 60 1 Nitro`');
        return;
      }

      const endsAt = new Date(Date.now() + duration * 60 * 1000);
      const giveaway = await createGiveaway(ctx.db, {
        guildId: ctx.guildUuid,
        channelId: ctx.channel.id,
        prize,
        emoji: config.emoji,
        winnersCount: winners,
        endsAt,
        createdBy: ctx.message.author.id,
      });

      const sent = await ctx.actions.send(ctx.channel.id, {
        embeds: [
          giveawayEmbed({
            prize,
            emoji: config.emoji,
            winnersCount: winners,
            endsAt,
            entries: 0,
            hostId: ctx.message.author.id,
          }),
        ],
      });

      await setGiveawayMessage(ctx.db, giveaway.id, sent.id);
      await ctx.actions.addReaction(ctx.channel.id, sent.id, config.emoji);

      await ctx.reply(`Giveaway started for **${prize}**. React with ${config.emoji} to enter.`);
      return;
    }

    if (action === 'end') {
      const id = tokens[0];
      const giveaway = id
        ? await getGiveaway(ctx.db, ctx.guildUuid, id)
        : (await listGiveaways(ctx.db, ctx.guildUuid, 10)).find(
            (row) => row.giveaway.status === 'active',
          )?.giveaway;

      if (!giveaway) {
        await ctx.reply('No active giveaway found.');
        return;
      }
      if (giveaway.status !== 'active') {
        await ctx.reply('No active giveaway found.');
        return;
      }

      const winners = await finishGiveaway(
        { db: ctx.db, actions: ctx.actions, logger: ctx.logger },
        giveaway,
      );
      await ctx.reply(
        winners.length > 0
          ? `Giveaway ended. Winner${winners.length === 1 ? '' : 's'}: ${winners.map((w) => `<@${w}>`).join(', ')}`
          : 'Giveaway ended with no entries.',
      );
      return;
    }

    const rows = (await listGiveaways(ctx.db, ctx.guildUuid, 10)).filter(
      (row) => row.giveaway.status === 'active',
    );
    if (rows.length === 0) {
      await ctx.reply('No active giveaways.');
      return;
    }

    await ctx.reply({
      embeds: [
        {
          title: 'Active giveaways',
          color: EMBED_COLOR,
          description: rows
            .map(
              (row) =>
                `**${row.giveaway.prize}** — ${row.entries} entries · ends ${row.giveaway.endsAt.toISOString()} · \`${row.giveaway.id}\``,
            )
            .join('\n'),
        },
      ],
    });
  },
};

export const giveawayCommands: CommandDefinition[] = [giveawayCommand];

export interface GiveawayReactionEvent {
  userId: string;
  messageId: string;
  emoji: string;
  added: boolean;
  isBot: boolean;
}

/** Track giveaway entries from reactions. */
export async function onGiveawayReaction(
  ctx: RuntimeContext,
  event: GiveawayReactionEvent,
): Promise<void> {
  if (event.isBot || !ctx.guildUuid) return;

  const giveaway = await findActiveGiveawayByMessage(ctx.db, ctx.guildUuid, event.messageId);
  if (!giveaway || giveaway.emoji !== event.emoji) return;

  if (event.added) {
    await addGiveawayEntry(ctx.db, giveaway.id, event.userId);
  } else {
    await removeGiveawayEntry(ctx.db, giveaway.id, event.userId);
  }
}

export const giveawaysConfig = {
  schema: giveawaysConfigSchema,
  parse(raw: Record<string, unknown> | null): Record<string, unknown> {
    return giveawaysConfigSchema.parse(raw ?? {}) as unknown as Record<string, unknown>;
  },
};
