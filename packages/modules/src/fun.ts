import { arg, type CommandContext, type CommandDefinition } from '@fluxbot/core';
import { type FunConfig, funConfigSchema } from './config';

const EMBED_COLOR = 0xf59e0b;

const EIGHT_BALL_ANSWERS = [
  'It is certain.',
  'Without a doubt.',
  'Yes — definitely.',
  'Most likely.',
  'Outlook good.',
  'Signs point to yes.',
  'Reply hazy, try again.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  "Don't count on it.",
  'My reply is no.',
  'My sources say no.',
  'Outlook not so good.',
  'Very doubtful.',
];

function configOf(ctx: CommandContext): FunConfig {
  return ctx.config as unknown as FunConfig;
}

async function guard(ctx: CommandContext, key: keyof FunConfig): Promise<boolean> {
  const config = configOf(ctx);
  if (!config.enabled) {
    await ctx.reply('Fun commands are disabled on this server.');
    return false;
  }
  if (config[key] === false) {
    await ctx.reply(`\`${ctx.command.name}\` is disabled on this server.`);
    return false;
  }
  return true;
}

function parseDice(spec: string): { count: number; sides: number } | null {
  const match = /^(\d{1,3})d(\d{1,5})$/i.exec(spec.trim());
  if (!match) return null;
  const count = Number.parseInt(match[1] ?? '', 10);
  const sides = Number.parseInt(match[2] ?? '', 10);
  if (!Number.isFinite(count) || !Number.isFinite(sides)) return null;
  if (count < 1 || count > 100 || sides < 2 || sides > 100_000) return null;
  return { count, sides };
}

const diceCommand: CommandDefinition = {
  name: 'dice',
  aliases: ['roll'],
  description: 'Roll dice using NdM notation',
  usage: 'dice [NdM]',
  category: 'fun',
  module: 'fun',
  defaultCooldownSeconds: 3,
  args: { spec: arg.string({ optional: true, defaultValue: '1d6' }) },
  async run(ctx) {
    if (!(await guard(ctx, 'dice'))) return;

    const spec = (ctx.args.spec as string | undefined) ?? '1d6';
    const parsed = parseDice(spec);
    if (!parsed) {
      await ctx.reply(
        'Use dice notation like `1d6`, `2d20`, or `4d8` (max 100 dice, 100000 sides).',
      );
      return;
    }

    const rolls = Array.from(
      { length: parsed.count },
      () => Math.floor(Math.random() * parsed.sides) + 1,
    );
    const total = rolls.reduce((sum, value) => sum + value, 0);

    await ctx.reply({
      embeds: [
        {
          title: `🎲 ${parsed.count}d${parsed.sides}`,
          color: EMBED_COLOR,
          description: `**${total.toLocaleString()}**${parsed.count > 1 ? `\n${rolls.join(' + ')}` : ''}`,
        },
      ],
    });
  },
};

const coinflipCommand: CommandDefinition = {
  name: 'coinflip',
  aliases: ['flip', 'coin'],
  description: 'Flip a coin',
  usage: 'coinflip',
  category: 'fun',
  module: 'fun',
  defaultCooldownSeconds: 3,
  async run(ctx) {
    if (!(await guard(ctx, 'coinflip'))) return;
    const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
    await ctx.reply(`🪙 **${result}**`);
  },
};

const eightballCommand: CommandDefinition = {
  name: '8ball',
  aliases: ['eightball'],
  description: 'Ask the magic 8-ball a question',
  usage: '8ball <question>',
  category: 'fun',
  module: 'fun',
  defaultCooldownSeconds: 3,
  args: { question: arg.rest() },
  async run(ctx) {
    if (!(await guard(ctx, 'eightball'))) return;
    const question = (ctx.args.question as string) ?? '';
    if (!question) {
      await ctx.reply('Ask a question: `8ball will I win the lottery?`');
      return;
    }
    const answer = EIGHT_BALL_ANSWERS[Math.floor(Math.random() * EIGHT_BALL_ANSWERS.length)];
    await ctx.reply({
      embeds: [
        {
          color: 0x6366f1,
          title: '🎱 The 8-ball says…',
          description: `> ${question}\n\n**${answer}**`,
        },
      ],
    });
  },
};

const chooseCommand: CommandDefinition = {
  name: 'choose',
  aliases: ['pick'],
  description: 'Pick one option at random',
  usage: 'choose option A | option B | option C',
  category: 'fun',
  module: 'fun',
  defaultCooldownSeconds: 3,
  args: { options: arg.rest() },
  async run(ctx) {
    if (!(await guard(ctx, 'choose'))) return;

    const raw = (ctx.args.options as string) ?? '';
    const options = raw
      .split('|')
      .map((option) => option.trim())
      .filter(Boolean);

    if (options.length < 2) {
      await ctx.reply('Give me at least two options separated by `|`.');
      return;
    }

    const choice = options[Math.floor(Math.random() * options.length)];
    await ctx.reply({
      embeds: [
        {
          color: 0x10b981,
          title: 'I choose…',
          description: `**${choice}**`,
          footer: { text: `${options.length} options` },
        },
      ],
    });
  },
};

function loveScore(a: string, b: string): number {
  const key = [a, b].sort().join(':');
  let hash = 7;
  for (const char of key) {
    hash = (hash * 31 + char.charCodeAt(0)) % 101;
  }
  return hash;
}

const shipCommand: CommandDefinition = {
  name: 'ship',
  aliases: ['love'],
  description: 'Compute the compatibility between two people',
  usage: 'ship [user] [user]',
  category: 'fun',
  module: 'fun',
  defaultCooldownSeconds: 5,
  args: {
    first: arg.member({ optional: true }),
    second: arg.member({ optional: true }),
  },
  async run(ctx) {
    if (!(await guard(ctx, 'ship'))) return;

    const first = ctx.args.first as { id: string } | undefined;
    const second = ctx.args.second as { id: string } | undefined;

    const a = first?.id ?? ctx.message.author.id;
    const b = second?.id ?? first?.id;

    if (!b || a === b) {
      await ctx.reply('Mention someone to ship with: `ship @someone` or `ship @a @b`.');
      return;
    }

    const score = loveScore(a, b);
    const filled = Math.round(score / 5);
    const bar = `${'♥'.repeat(filled)}${'♡'.repeat(20 - filled)}`;
    const verdict =
      score >= 85
        ? 'Soulmates. No notes.'
        : score >= 60
          ? 'There is something there.'
          : score >= 35
            ? 'Could work with effort.'
            : 'Perhaps stay friends.';

    await ctx.reply({
      embeds: [
        {
          color: 0xec4899,
          title: '❤️ Compatibility',
          description: `<@${a}> + <@${b}>\n\n${bar}\n**${score}%** — ${verdict}`,
        },
      ],
    });
  },
};

export const funCommands: CommandDefinition[] = [
  diceCommand,
  coinflipCommand,
  eightballCommand,
  chooseCommand,
  shipCommand,
];

export const funConfig = {
  schema: funConfigSchema,
  parse(raw: Record<string, unknown> | null): Record<string, unknown> {
    return funConfigSchema.parse(raw ?? {}) as unknown as Record<string, unknown>;
  },
};
