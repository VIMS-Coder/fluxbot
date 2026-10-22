import { arg, type CommandContext, type CommandDefinition } from '@fluxbot/core';
import { welcomeConfigSchema } from './config';

export interface WelcomeVariables {
  mention: string;
  name: string;
  server: string;
  count: number | string;
}

/**
 * Replace `{mention}`, `{name}`, `{server}` and `{count}` in a template.
 * Unknown placeholders are left untouched so typos are visible in the preview.
 */
export function renderWelcome(template: string, variables: WelcomeVariables): string {
  return template
    .replaceAll('{mention}', variables.mention)
    .replaceAll('{name}', variables.name)
    .replaceAll('{server}', variables.server)
    .replaceAll('{count}', String(variables.count))
    .slice(0, 2000);
}

export function previewWelcome(template: string): string {
  return renderWelcome(template, {
    mention: '@new-member',
    name: 'new-member',
    server: 'Your Server',
    count: 128,
  });
}

const welcomeCommand: CommandDefinition = {
  name: 'welcome',
  description: 'Preview the welcome message',
  usage: 'welcome test',
  category: 'community',
  module: 'welcome',
  guildOnly: true,
  permissions: { user: ['MANAGE_GUILD'], bot: ['SEND_MESSAGES', 'EMBED_LINKS'] },
  defaultCooldownSeconds: 5,
  args: { action: arg.choices(['test'] as const) },
  async run(ctx: CommandContext) {
    const config = welcomeConfigSchema.parse(ctx.config);
    if (!config.channelId) {
      await ctx.reply('No welcome channel configured yet. Set one in the dashboard.');
      return;
    }

    const memberCount = ctx.guild ? await ctx.actions.guildMemberCount(ctx.guild.id) : 0;
    const body = renderWelcome(config.joinMessage, {
      mention: `<@${ctx.message.author.id}>`,
      name: ctx.member?.displayName ?? ctx.message.author.username,
      server: ctx.guild?.name ?? 'this server',
      count: memberCount,
    });

    await ctx.actions.send(config.channelId, {
      embeds: [
        {
          title: 'Welcome preview',
          description: body,
          color: 0x8b5cf6,
          footer: { text: 'This is what new members will see' },
        },
      ],
    });
    await ctx.reply('Welcome preview sent.');
  },
};

export const welcomeCommands: CommandDefinition[] = [welcomeCommand];

export const welcomeConfig = {
  schema: welcomeConfigSchema,
  parse(raw: Record<string, unknown> | null): Record<string, unknown> {
    return welcomeConfigSchema.parse(raw ?? {}) as unknown as Record<string, unknown>;
  },
};
