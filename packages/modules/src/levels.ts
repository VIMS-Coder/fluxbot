import {
  arg,
  type CommandContext,
  type CommandDefinition,
  type MemberLike,
  type RuntimeContext,
} from '@fluxbot/core';
import {
  countRankedMembers,
  getLeaderboard,
  getUserRank,
  getXpUser,
  grantXp,
  listLevelRewards,
  recordAudit,
  removeLevelReward,
  setGuildConfig,
  setLevelReward,
} from '@fluxbot/db';
import { type LevelsConfig, levelsConfigSchema } from './config';

export const LEVELS_MODULE = 'levels';
export const MAX_LEVEL = 500;
const EMBED_COLOR = 0x8b5cf6;

export interface CurveOptions {
  curveBase: number;
  curveFactor: number;
}

/** XP required to move from `level` to `level + 1`. */
export function xpForLevel(level: number, curve: CurveOptions): number {
  return Math.floor(curve.curveBase + curve.curveFactor * level * level);
}

/** Total XP required to reach `level` from zero. */
export function totalXpForLevel(level: number, curve: CurveOptions): number {
  let total = 0;
  for (let index = 0; index < level; index += 1) {
    total += xpForLevel(index, curve);
  }
  return total;
}

export interface LevelProgress {
  level: number;
  /** XP accumulated inside the current level. */
  current: number;
  /** XP required to finish the current level. */
  needed: number;
}

/** Invert the curve: total XP → level plus progress within that level. */
export function levelFromXp(totalXp: number, curve: CurveOptions): LevelProgress {
  let level = 0;
  let remaining = Math.max(0, Math.floor(totalXp));

  while (level < MAX_LEVEL) {
    const needed = xpForLevel(level, curve);
    if (remaining < needed) {
      return { level, current: remaining, needed };
    }
    remaining -= needed;
    level += 1;
  }

  return { level: MAX_LEVEL, current: 0, needed: xpForLevel(MAX_LEVEL, curve) };
}

function curveOf(config: LevelsConfig): CurveOptions {
  return { curveBase: config.curveBase, curveFactor: config.curveFactor };
}

function displayNameFor(member: MemberLike | null, fallback?: string): string {
  return member?.displayName ?? member?.username ?? fallback ?? `<@${member?.id ?? '0'}>`;
}

function progressBar(current: number, needed: number, size = 14): string {
  const ratio = needed <= 0 ? 1 : Math.min(1, current / needed);
  const filled = Math.round(ratio * size);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, size - filled))}`;
}

function randomBetween(min: number, max: number): number {
  const low = Math.min(min, max);
  const high = Math.max(min, max);
  return Math.floor(low + Math.random() * (high - low + 1));
}

async function saveConfig(
  ctx: CommandContext | RuntimeContext,
  patch: Partial<LevelsConfig>,
): Promise<LevelsConfig> {
  if (!ctx.guildUuid || !ctx.guild) throw new Error('Guild context required');
  const current = ctx.config as unknown as LevelsConfig;
  const next = levelsConfigSchema.parse({ ...current, ...patch });
  await setGuildConfig(
    ctx.db,
    ctx.guildUuid,
    LEVELS_MODULE,
    next as unknown as Record<string, unknown>,
    null,
  );
  await recordAudit(ctx.db, {
    guildId: ctx.guildUuid,
    actorUserId: null,
    actorName: 'Fluxbot',
    action: 'levels.config',
    target: ctx.guild.id,
    after: next as unknown as Record<string, unknown>,
  });
  return next;
}

const rankCommand: CommandDefinition = {
  name: 'rank',
  aliases: ['level'],
  description: 'Show your level and XP progress',
  usage: 'rank [user]',
  category: 'levels',
  module: LEVELS_MODULE,
  guildOnly: true,
  defaultCooldownSeconds: 5,
  args: { user: arg.member({ optional: true }) },
  async run(ctx) {
    const config = ctx.config as unknown as LevelsConfig;
    if (!config.enabled) {
      await ctx.reply('Levels are disabled on this server.');
      return;
    }
    if (!ctx.guildUuid) return;

    const target = (ctx.args.user as MemberLike | undefined) ?? ctx.member;
    if (!target) {
      await ctx.reply('Could not resolve that member.');
      return;
    }

    const xpUser = await getXpUser(ctx.db, ctx.guildUuid, target.id);
    if (!xpUser) {
      await ctx.reply(`**${displayNameFor(target)}** has not earned any XP yet.`);
      return;
    }

    const progress = levelFromXp(xpUser.xp, curveOf(config));
    const rank = await getUserRank(ctx.db, ctx.guildUuid, target.id);

    await ctx.reply({
      embeds: [
        {
          title: `${displayNameFor(target)}'s rank`,
          color: EMBED_COLOR,
          description: `${progressBar(progress.current, progress.needed)}\n${progress.current.toLocaleString()} / ${progress.needed.toLocaleString()} XP`,
          fields: [
            { name: 'Level', value: String(progress.level), inline: true },
            { name: 'Total XP', value: xpUser.xp.toLocaleString(), inline: true },
            {
              name: 'Rank',
              value: rank ? `#${rank.rank} of ${rank.total}` : 'Unranked',
              inline: true,
            },
            { name: 'Messages', value: xpUser.messages.toLocaleString(), inline: true },
          ],
          footer: { text: 'Fluxbot levels' },
        },
      ],
    });
  },
};

const leaderboardCommand: CommandDefinition = {
  name: 'leaderboard',
  aliases: ['lb', 'top'],
  description: 'Show the server XP leaderboard',
  usage: 'leaderboard [page]',
  category: 'levels',
  module: LEVELS_MODULE,
  guildOnly: true,
  defaultCooldownSeconds: 10,
  args: { page: arg.integer({ optional: true, min: 1, max: 100, defaultValue: 1 }) },
  async run(ctx) {
    const config = ctx.config as unknown as LevelsConfig;
    if (!config.enabled) {
      await ctx.reply('Levels are disabled on this server.');
      return;
    }
    if (!ctx.guildUuid) return;

    const page = (ctx.args.page as number | undefined) ?? 1;
    const pageSize = 10;
    const rows = await getLeaderboard(ctx.db, ctx.guildUuid, pageSize, (page - 1) * pageSize);
    const total = await countRankedMembers(ctx.db, ctx.guildUuid);

    if (rows.length === 0) {
      await ctx.reply('Nobody has earned XP yet. Start chatting!');
      return;
    }

    const lines = rows.map((row, index) => {
      const position = (page - 1) * pageSize + index + 1;
      const progress = levelFromXp(row.xp, curveOf(config));
      const medal =
        position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `**#${position}**`;
      return `${medal} <@${row.userId}> — level **${progress.level}** · ${row.xp.toLocaleString()} XP`;
    });

    const pages = Math.max(1, Math.ceil(total / pageSize));
    await ctx.reply({
      embeds: [
        {
          title: `${ctx.guild?.name ?? 'Server'} leaderboard`,
          color: EMBED_COLOR,
          description: lines.join('\n'),
          footer: { text: `Page ${page} of ${pages} · ${total} ranked members` },
        },
      ],
    });
  },
};

const rewardsCommand: CommandDefinition = {
  name: 'rewards',
  description: 'List roles awarded at specific levels',
  usage: 'rewards',
  category: 'levels',
  module: LEVELS_MODULE,
  guildOnly: true,
  defaultCooldownSeconds: 10,
  async run(ctx) {
    if (!ctx.guildUuid) return;
    const rewards = await listLevelRewards(ctx.db, ctx.guildUuid);
    if (rewards.length === 0) {
      await ctx.reply('No level rewards configured yet. Add them from the dashboard.');
      return;
    }
    await ctx.reply({
      embeds: [
        {
          title: 'Level rewards',
          color: EMBED_COLOR,
          description: rewards
            .map((reward) => `Level **${reward.level}** → <@&${reward.roleId}>`)
            .join('\n'),
        },
      ],
    });
  },
};

const xpAdminCommand: CommandDefinition = {
  name: 'xp',
  description: 'Configure the levels module',
  usage: 'xp <status|enable|disable|rate|cooldown|announce|reward|unreward> [...]',
  category: 'levels',
  module: LEVELS_MODULE,
  guildOnly: true,
  permissions: { user: ['MANAGE_GUILD'] },
  defaultCooldownSeconds: 2,
  args: {
    action: arg.string(),
    rest: arg.rest({ optional: true }),
  },
  async run(ctx) {
    const config = ctx.config as unknown as LevelsConfig;
    const action = (ctx.args.action as string).toLowerCase();
    const tokens = ((ctx.args.rest as string) || '').split(/\s+/).filter(Boolean);
    const guildId = ctx.guild?.id;

    switch (action) {
      case 'status': {
        await ctx.reply({
          embeds: [
            {
              title: 'Levels configuration',
              color: EMBED_COLOR,
              fields: [
                { name: 'Enabled', value: config.enabled ? 'yes' : 'no', inline: true },
                {
                  name: 'XP per message',
                  value: `${config.minXp}–${config.maxXp}`,
                  inline: true,
                },
                { name: 'Cooldown', value: `${config.cooldownSeconds}s`, inline: true },
                {
                  name: 'Curve',
                  value: `${config.curveBase} + ${config.curveFactor}·L²`,
                  inline: true,
                },
                {
                  name: 'Announce',
                  value: config.announceChannelId
                    ? `<#${config.announceChannelId}>`
                    : 'same channel',
                  inline: true,
                },
              ],
              footer: { text: 'Configure everything from the web dashboard' },
            },
          ],
        });
        return;
      }
      case 'enable':
      case 'disable': {
        const next = await saveConfig(ctx, { enabled: action === 'enable' });
        await ctx.reply(`Levels ${next.enabled ? 'enabled' : 'disabled'}.`);
        return;
      }
      case 'rate': {
        const min = Number.parseInt(tokens[0] ?? '', 10);
        const max = Number.parseInt(tokens[1] ?? '', 10);
        if (!Number.isFinite(min) || !Number.isFinite(max) || min < 1 || max < min) {
          await ctx.reply('Usage: `xp rate <min> <max>` (e.g. `xp rate 15 25`)');
          return;
        }
        await saveConfig(ctx, { minXp: min, maxXp: max });
        await ctx.reply(`XP per message set to **${min}–${max}**.`);
        return;
      }
      case 'cooldown': {
        const seconds = Number.parseInt(tokens[0] ?? '', 10);
        if (!Number.isFinite(seconds) || seconds < 0) {
          await ctx.reply('Usage: `xp cooldown <seconds>`');
          return;
        }
        await saveConfig(ctx, { cooldownSeconds: seconds });
        await ctx.reply(`XP cooldown set to **${seconds}s**.`);
        return;
      }
      case 'announce': {
        const token = tokens[0];
        if (!token) {
          await ctx.reply('Usage: `xp announce <#channel|none>`');
          return;
        }
        const channelId = token === 'none' ? null : token.replace(/[<#>]/g, '');
        await saveConfig(ctx, {
          announceChannelId: channelId,
          announceLevelUp: channelId !== null,
        });
        await ctx.reply(
          channelId
            ? `Level-ups will be announced in <#${channelId}>.`
            : 'Level-up announcements disabled.',
        );
        return;
      }
      case 'reward': {
        const level = Number.parseInt(tokens[0] ?? '', 10);
        const roleToken = tokens.slice(1).join(' ');
        if (!Number.isFinite(level) || level < 1 || !roleToken) {
          await ctx.reply('Usage: `xp reward <level> <role>`');
          return;
        }
        if (!guildId || !ctx.guildUuid) return;
        const roles = await ctx.actions.guildRoles(guildId);
        const needle = roleToken.replace(/[<@&>]/g, '').toLowerCase();
        const role = roles.find(
          (candidate) =>
            candidate.id === needle ||
            candidate.name.toLowerCase() === roleToken.toLowerCase() ||
            candidate.name.toLowerCase() === needle,
        );
        if (!role) {
          await ctx.reply(`Could not find a role named \`${roleToken}\`.`);
          return;
        }
        if (!(await ctx.actions.canManageRole(guildId, role.id))) {
          await ctx.reply('I cannot manage that role — it is above my highest role.');
          return;
        }
        await setLevelReward(ctx.db, ctx.guildUuid, level, role.id);
        await ctx.reply(`Members reaching level **${level}** will receive <@&${role.id}>.`);
        return;
      }
      case 'unreward': {
        const level = Number.parseInt(tokens[0] ?? '', 10);
        if (!Number.isFinite(level) || !ctx.guildUuid) {
          await ctx.reply('Usage: `xp unreward <level>`');
          return;
        }
        await removeLevelReward(ctx.db, ctx.guildUuid, level);
        await ctx.reply(`Removed the reward for level **${level}**.`);
        return;
      }
      default: {
        await ctx.reply(
          'Unknown action. Use `status`, `enable`, `disable`, `rate`, `cooldown`, `announce`, `reward`, or `unreward`.',
        );
      }
    }
  },
};

export const levelsCommands: CommandDefinition[] = [
  rankCommand,
  leaderboardCommand,
  rewardsCommand,
  xpAdminCommand,
];

/**
 * Message handler: grant XP with a per-user cooldown and handle level-ups.
 */
export async function onLevelsMessage(ctx: RuntimeContext): Promise<void> {
  const config = ctx.config as unknown as LevelsConfig;
  if (!config.enabled) return;

  const { guild, guildUuid, member, message } = ctx;
  if (!guild || !guildUuid || !member || !message) return;
  if (message.author.bot) return;
  if (config.ignoreCommands && ctx.isCommand) return;
  if (config.ignoredChannels.includes(message.channelId)) return;
  if (config.ignoredRoles.some((roleId) => member.roles.includes(roleId))) return;

  const existing = await getXpUser(ctx.db, guildUuid, message.author.id);
  const now = Date.now();
  if (existing?.lastXpAt && now - existing.lastXpAt.getTime() < config.cooldownSeconds * 1000) {
    return;
  }

  const amount = randomBetween(config.minXp, config.maxXp);
  const total = Math.min((existing?.xp ?? 0) + amount, 1_000_000_000);
  const progress = levelFromXp(total, curveOf(config));

  const updated = await grantXp(ctx.db, {
    guildId: guildUuid,
    userId: message.author.id,
    amount,
    level: progress.level,
  });

  const previousLevel = existing?.level ?? 0;
  if (updated.level > previousLevel) {
    await handleLevelUp(ctx, updated.level, message.author.id);
  }
}

async function handleLevelUp(ctx: RuntimeContext, level: number, userId: string): Promise<void> {
  const config = ctx.config as unknown as LevelsConfig;
  if (!ctx.guildUuid || !ctx.guild) return;

  const awarded: string[] = [];

  if (config.enabled) {
    const rewards = await listLevelRewards(ctx.db, ctx.guildUuid);
    const member = await ctx.actions.fetchMember(ctx.guild.id, userId);
    const owned = new Set(member?.roles ?? []);

    for (const reward of rewards) {
      if (reward.level > level || owned.has(reward.roleId)) continue;
      if (!(await ctx.actions.canManageRole(ctx.guild.id, reward.roleId))) continue;
      try {
        await ctx.actions.addRole(ctx.guild.id, userId, reward.roleId);
        awarded.push(`<@&${reward.roleId}>`);
      } catch (error) {
        ctx.logger.warn('Failed to grant level reward', {
          guildId: ctx.guild.id,
          userId,
          roleId: reward.roleId,
          error: (error as Error).message,
        });
      }
    }
  }

  if (!config.announceLevelUp) return;

  const channelId = config.announceChannelId ?? ctx.channel?.id ?? ctx.message?.channelId;
  if (!channelId) return;

  const rewardLine = awarded.length > 0 ? `\nReward: ${awarded.join(', ')}` : '';
  const payload = {
    embeds: [
      {
        color: EMBED_COLOR,
        description: `🎉 <@${userId}> reached **level ${level}**!${rewardLine}`,
      },
    ],
  };

  try {
    await ctx.actions.send(channelId, payload);
  } catch (error) {
    ctx.logger.warn('Failed to announce level-up', {
      guildId: ctx.guild.id,
      channelId,
      error: (error as Error).message,
    });
  }
}

export const levelsConfig = {
  schema: levelsConfigSchema,
  parse(raw: Record<string, unknown> | null): Record<string, unknown> {
    return levelsConfigSchema.parse(raw ?? {}) as unknown as Record<string, unknown>;
  },
};
