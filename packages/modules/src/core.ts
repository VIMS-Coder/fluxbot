import { arg, type CommandDefinition } from '@fluxbot/core';
import { recordAudit, updateGuildSettings } from '@fluxbot/db';
import { hasPermission, Permission, parsePermissionMask } from '@fluxbot/fluxer';
import { coreConfigSchema } from './config';

const EMBED_COLOR = 0x8b5cf6;

const helpCommand: CommandDefinition = {
  name: 'help',
  aliases: ['commands', 'h'],
  description: 'List every command, or explain one',
  usage: 'help [command]',
  category: 'core',
  module: 'core',
  defaultCooldownSeconds: 2,
  args: { command: arg.string({ optional: true }) },
  async run(ctx) {
    const requested = (ctx.args.command as string | undefined)?.toLowerCase();

    if (requested) {
      const command = ctx.commands.find(
        (candidate) =>
          candidate.name === requested || candidate.aliases?.includes(requested) === true,
      );
      if (!command) {
        await ctx.reply(`No command called \`${requested}\`. Run \`${ctx.prefix}help\`.`);
        return;
      }

      const fields = [
        { name: 'Usage', value: `\`${ctx.prefix}${command.usage ?? command.name}\`` },
        { name: 'Module', value: command.module, inline: true },
      ];
      if (command.aliases?.length) {
        fields.push({ name: 'Aliases', value: command.aliases.join(', '), inline: true });
      }
      const userPermissions = command.permissions?.user;
      if (userPermissions?.length) {
        fields.push({ name: 'Requires', value: userPermissions.join(', ') });
      }

      await ctx.reply({
        embeds: [
          {
            title: `${ctx.prefix}${command.name}`,
            color: EMBED_COLOR,
            description: command.description,
            fields,
          },
        ],
      });
      return;
    }

    const categories: Array<{ key: string; label: string }> = [
      { key: 'core', label: 'Core' },
      { key: 'levels', label: 'Levels' },
      { key: 'fun', label: 'Fun' },
      { key: 'roles', label: 'Roles' },
      { key: 'moderation', label: 'Moderation' },
    ];

    const fields = categories
      .map(({ key, label }) => {
        const commands = ctx.commands.filter((command) => command.category === key);
        if (commands.length === 0) return null;
        return {
          name: label,
          value: commands
            .map((command) => `\`${ctx.prefix}${command.name}\` — ${command.description}`)
            .join('\n'),
        };
      })
      .filter((field): field is { name: string; value: string } => field !== null);

    await ctx.reply({
      embeds: [
        {
          title: 'Fluxbot commands',
          color: EMBED_COLOR,
          description: `Prefix: \`${ctx.prefix}\` · Use \`${ctx.prefix}help <command>\` for details.`,
          fields,
          footer: { text: 'Configuration lives in the web dashboard' },
        },
      ],
    });
  },
};

const pingCommand: CommandDefinition = {
  name: 'ping',
  description: 'Check that the bot is alive',
  usage: 'ping',
  category: 'core',
  module: 'core',
  defaultCooldownSeconds: 2,
  async run(ctx) {
    const latency = ctx.latencyMs ?? 0;
    await ctx.reply(`🏓 Pong! ${latency > 0 ? `${latency}ms` : 'gateway is healthy'}`);
  },
};

const aboutCommand: CommandDefinition = {
  name: 'about',
  aliases: ['info'],
  description: 'About Fluxbot',
  usage: 'about',
  category: 'core',
  module: 'core',
  defaultCooldownSeconds: 10,
  async run(ctx) {
    await ctx.reply({
      embeds: [
        {
          title: 'Fluxbot',
          color: EMBED_COLOR,
          description:
            'A self-hostable all-in-one bot for Fluxer, with a web dashboard for configuration.',
          fields: [
            { name: 'Version', value: ctx.botVersion ?? 'dev', inline: true },
            { name: 'Instance', value: ctx.instanceOrigin ?? 'unknown', inline: true },
            { name: 'Dashboard', value: 'Ask your server admin for the link', inline: false },
          ],
          footer: { text: 'MIT licensed · not affiliated with Fluxer' },
        },
      ],
    });
  },
};

const prefixCommand: CommandDefinition = {
  name: 'prefix',
  description: 'Show or change the command prefix',
  usage: 'prefix [new prefix]',
  category: 'core',
  module: 'core',
  guildOnly: true,
  permissions: { user: ['MANAGE_GUILD'] },
  defaultCooldownSeconds: 3,
  args: { next: arg.string({ optional: true }) },
  async run(ctx) {
    const next = ctx.args.next as string | undefined;

    if (!next) {
      await ctx.reply(`The command prefix is \`${ctx.prefix}\`.`);
      return;
    }

    if (!ctx.guild || !ctx.guildUuid || !ctx.member) return;
    const mask = parsePermissionMask(ctx.member.permissions);
    if (!hasPermission(mask, Permission.MANAGE_GUILD)) {
      await ctx.reply('You need the **Manage Server** permission to change the prefix.');
      return;
    }

    const cleaned = next.trim();
    if (cleaned.length === 0 || cleaned.length > 3 || /\s/.test(cleaned)) {
      await ctx.reply('The prefix must be 1–3 characters with no spaces.');
      return;
    }

    await updateGuildSettings(ctx.db, ctx.guildUuid, { prefix: cleaned });
    await recordAudit(ctx.db, {
      guildId: ctx.guildUuid,
      actorUserId: null,
      actorName: `${ctx.message.author.username} (${ctx.message.author.id})`,
      action: 'settings.prefix',
      target: ctx.guild.id,
      before: { prefix: ctx.prefix },
      after: { prefix: cleaned },
    });

    await ctx.reply(`Prefix updated to \`${cleaned}\`.`);
  },
};

export const coreCommands: CommandDefinition[] = [
  helpCommand,
  pingCommand,
  aboutCommand,
  prefixCommand,
];

export const coreConfig = {
  schema: coreConfigSchema,
  parse(raw: Record<string, unknown> | null): Record<string, unknown> {
    return coreConfigSchema.parse(raw ?? {}) as unknown as Record<string, unknown>;
  },
};
