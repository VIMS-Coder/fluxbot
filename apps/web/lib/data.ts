import {
  countRankedMembers,
  getAnalyticsSummary,
  getBotStatus,
  getGuildConfig,
  getGuildSnapshot,
  listAudit,
  listAutoRoles,
  listCommandSettings,
  listGuildsForUser,
  listLevelRewards,
  listReactionRoles,
  listSelfRoles,
  type SessionWithUser,
} from '@fluxbot/db';
import {
  type FunConfig,
  funConfigSchema,
  type LevelsConfig,
  levelsConfigSchema,
  type RolesConfig,
  rolesConfigSchema,
} from '@fluxbot/modules/config';
import { getDb } from './db';

export async function getLevelsConfig(guildUuid: string): Promise<LevelsConfig> {
  const raw = await getGuildConfig(getDb(), guildUuid, 'levels');
  return levelsConfigSchema.parse(raw ?? {});
}

export async function getFunConfig(guildUuid: string): Promise<FunConfig> {
  const raw = await getGuildConfig(getDb(), guildUuid, 'fun');
  return funConfigSchema.parse(raw ?? {});
}

export async function getRolesConfig(guildUuid: string): Promise<RolesConfig> {
  const raw = await getGuildConfig(getDb(), guildUuid, 'roles');
  return rolesConfigSchema.parse(raw ?? {});
}

export async function getSnapshot(guildUuid: string) {
  const snapshot = await getGuildSnapshot(getDb(), guildUuid);
  return {
    channels: snapshot?.channels ?? [],
    roles: snapshot?.roles ?? [],
    updatedAt: snapshot?.updatedAt ?? null,
  };
}

export async function getLevelsPageData(guildUuid: string) {
  const db = getDb();
  const [config, rewards, ranked, snapshot] = await Promise.all([
    getLevelsConfig(guildUuid),
    listLevelRewards(db, guildUuid),
    countRankedMembers(db, guildUuid),
    getSnapshot(guildUuid),
  ]);
  return { config, rewards, ranked, snapshot };
}

export async function getRolesPageData(guildUuid: string) {
  const db = getDb();
  const [config, reactionRoles, autoRoleRows, selfRoleRows, snapshot] = await Promise.all([
    getRolesConfig(guildUuid),
    listReactionRoles(db, guildUuid),
    listAutoRoles(db, guildUuid),
    listSelfRoles(db, guildUuid),
    getSnapshot(guildUuid),
  ]);
  return {
    config,
    reactionRoles,
    autoRoles: autoRoleRows,
    selfRoles: selfRoleRows,
    snapshot,
  };
}

export async function getOverviewData(guildUuid: string, session: SessionWithUser) {
  const db = getDb();
  const [snapshot, ranked, reactionRoles, audit, analytics, bot, guilds] = await Promise.all([
    getSnapshot(guildUuid),
    countRankedMembers(db, guildUuid),
    listReactionRoles(db, guildUuid),
    listAudit(db, guildUuid, 6),
    getAnalyticsSummary(db, guildUuid, 7),
    getBotStatus(db, session.instance.id),
    listGuildsForUser(db, session.user.id),
  ]);

  return {
    snapshot,
    ranked,
    reactionRoles: reactionRoles.length,
    audit,
    analytics,
    bot,
    guildCount: guilds.length,
  };
}

export async function getCommandsPageData(guildUuid: string) {
  const settings = await listCommandSettings(getDb(), guildUuid);
  return new Map(settings.map((setting) => [setting.command, setting]));
}
