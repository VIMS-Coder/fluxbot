import { and, asc, count, desc, eq, gt, sql } from 'drizzle-orm';
import type { Database } from '../client';
import { autoRoles, levelRewards, reactionRoles, selfRoles, xpUsers } from '../schema';

export type XpUser = typeof xpUsers.$inferSelect;

export async function getXpUser(
  db: Database,
  guildUuid: string,
  userId: string,
): Promise<XpUser | null> {
  const [row] = await db
    .select()
    .from(xpUsers)
    .where(and(eq(xpUsers.guildId, guildUuid), eq(xpUsers.userId, userId)))
    .limit(1);
  return row ?? null;
}

/**
 * Add XP to a member. The level is supplied by the caller (computed from the
 * new total) so the curve stays in one place — `@fluxbot/modules/levels`.
 */
export async function grantXp(
  db: Database,
  input: {
    guildId: string;
    userId: string;
    amount: number;
    level: number;
  },
): Promise<XpUser> {
  const [row] = await db
    .insert(xpUsers)
    .values({
      guildId: input.guildId,
      userId: input.userId,
      xp: input.amount,
      level: input.level,
      messages: 1,
      lastXpAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [xpUsers.guildId, xpUsers.userId],
      set: {
        xp: sql`${xpUsers.xp} + ${input.amount}`,
        level: input.level,
        messages: sql`${xpUsers.messages} + 1`,
        lastXpAt: new Date(),
      },
    })
    .returning();

  if (!row) throw new Error('Failed to grant XP');
  return row;
}

export async function setXpState(
  db: Database,
  guildUuid: string,
  userId: string,
  input: { xp?: number; level?: number },
): Promise<void> {
  await db
    .update(xpUsers)
    .set(input)
    .where(and(eq(xpUsers.guildId, guildUuid), eq(xpUsers.userId, userId)));
}

export async function getLeaderboard(
  db: Database,
  guildUuid: string,
  limit = 10,
  offset = 0,
): Promise<XpUser[]> {
  return db
    .select()
    .from(xpUsers)
    .where(eq(xpUsers.guildId, guildUuid))
    .orderBy(desc(xpUsers.xp))
    .limit(limit)
    .offset(offset);
}

export async function getUserRank(
  db: Database,
  guildUuid: string,
  userId: string,
): Promise<{ rank: number; total: number } | null> {
  const user = await getXpUser(db, guildUuid, userId);
  if (!user) return null;

  const [ahead] = await db
    .select({ value: count() })
    .from(xpUsers)
    .where(and(eq(xpUsers.guildId, guildUuid), gt(xpUsers.xp, user.xp)));

  const [total] = await db
    .select({ value: count() })
    .from(xpUsers)
    .where(eq(xpUsers.guildId, guildUuid));

  return { rank: Number(ahead?.value ?? 0) + 1, total: Number(total?.value ?? 0) };
}

export async function countRankedMembers(db: Database, guildUuid: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(xpUsers)
    .where(eq(xpUsers.guildId, guildUuid));
  return Number(row?.value ?? 0);
}

// ---------------------------------------------------------------------------
// Level rewards
// ---------------------------------------------------------------------------

export type LevelReward = typeof levelRewards.$inferSelect;

export async function listLevelRewards(db: Database, guildUuid: string): Promise<LevelReward[]> {
  return db
    .select()
    .from(levelRewards)
    .where(eq(levelRewards.guildId, guildUuid))
    .orderBy(asc(levelRewards.level));
}

export async function setLevelReward(
  db: Database,
  guildUuid: string,
  level: number,
  roleId: string,
): Promise<void> {
  await db
    .insert(levelRewards)
    .values({ guildId: guildUuid, level, roleId })
    .onConflictDoUpdate({
      target: [levelRewards.guildId, levelRewards.level],
      set: { roleId },
    });
}

export async function removeLevelReward(
  db: Database,
  guildUuid: string,
  level: number,
): Promise<void> {
  await db
    .delete(levelRewards)
    .where(and(eq(levelRewards.guildId, guildUuid), eq(levelRewards.level, level)));
}

// ---------------------------------------------------------------------------
// Reaction roles
// ---------------------------------------------------------------------------

export type ReactionRole = typeof reactionRoles.$inferSelect;

export async function listReactionRoles(db: Database, guildUuid: string): Promise<ReactionRole[]> {
  return db
    .select()
    .from(reactionRoles)
    .where(eq(reactionRoles.guildId, guildUuid))
    .orderBy(desc(reactionRoles.createdAt));
}

export async function findReactionRole(
  db: Database,
  guildUuid: string,
  messageId: string,
  emoji: string,
): Promise<ReactionRole | null> {
  const [row] = await db
    .select()
    .from(reactionRoles)
    .where(
      and(
        eq(reactionRoles.guildId, guildUuid),
        eq(reactionRoles.messageId, messageId),
        eq(reactionRoles.emoji, emoji),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function addReactionRole(
  db: Database,
  input: {
    guildId: string;
    channelId: string;
    messageId: string;
    emoji: string;
    roleId: string;
    mode?: 'toggle' | 'unique';
  },
): Promise<ReactionRole> {
  const [row] = await db
    .insert(reactionRoles)
    .values({
      guildId: input.guildId,
      channelId: input.channelId,
      messageId: input.messageId,
      emoji: input.emoji,
      roleId: input.roleId,
      mode: input.mode ?? 'toggle',
    })
    .returning();

  if (!row) throw new Error('Failed to add reaction role');
  return row;
}

export async function removeReactionRole(db: Database, id: string): Promise<void> {
  await db.delete(reactionRoles).where(eq(reactionRoles.id, id));
}

// ---------------------------------------------------------------------------
// Auto roles & self roles
// ---------------------------------------------------------------------------

export type AutoRole = typeof autoRoles.$inferSelect;
export type SelfRole = typeof selfRoles.$inferSelect;

export async function listAutoRoles(db: Database, guildUuid: string): Promise<AutoRole[]> {
  return db.select().from(autoRoles).where(eq(autoRoles.guildId, guildUuid));
}

export async function addAutoRole(db: Database, guildUuid: string, roleId: string): Promise<void> {
  await db
    .insert(autoRoles)
    .values({ guildId: guildUuid, roleId })
    .onConflictDoNothing({ target: [autoRoles.guildId, autoRoles.roleId] });
}

export async function removeAutoRole(
  db: Database,
  guildUuid: string,
  roleId: string,
): Promise<void> {
  await db
    .delete(autoRoles)
    .where(and(eq(autoRoles.guildId, guildUuid), eq(autoRoles.roleId, roleId)));
}

export async function listSelfRoles(db: Database, guildUuid: string): Promise<SelfRole[]> {
  return db.select().from(selfRoles).where(eq(selfRoles.guildId, guildUuid));
}

export async function addSelfRole(db: Database, guildUuid: string, roleId: string): Promise<void> {
  await db
    .insert(selfRoles)
    .values({ guildId: guildUuid, roleId })
    .onConflictDoNothing({ target: [selfRoles.guildId, selfRoles.roleId] });
}

export async function removeSelfRole(
  db: Database,
  guildUuid: string,
  roleId: string,
): Promise<void> {
  await db
    .delete(selfRoles)
    .where(and(eq(selfRoles.guildId, guildUuid), eq(selfRoles.roleId, roleId)));
}
