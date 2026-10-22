import { and, count, desc, eq, lte } from 'drizzle-orm';
import type { Database } from '../client';
import { giveawayEntries, giveaways, tempVoices, tickets } from '../schema';

export type Giveaway = typeof giveaways.$inferSelect;
export type GiveawayEntry = typeof giveawayEntries.$inferSelect;
export type Ticket = typeof tickets.$inferSelect;
export type TempVoice = typeof tempVoices.$inferSelect;

// ---------------------------------------------------------------------------
// Giveaways
// ---------------------------------------------------------------------------

export async function createGiveaway(
  db: Database,
  input: {
    guildId: string;
    channelId: string;
    prize: string;
    emoji: string;
    winnersCount: number;
    endsAt: Date;
    createdBy: string;
  },
): Promise<Giveaway> {
  const [row] = await db.insert(giveaways).values(input).returning();
  if (!row) throw new Error('Failed to create giveaway');
  return row;
}

export async function setGiveawayMessage(
  db: Database,
  id: string,
  messageId: string,
): Promise<void> {
  await db.update(giveaways).set({ messageId }).where(eq(giveaways.id, id));
}

export async function setGiveawayEndsAt(db: Database, id: string, endsAt: Date): Promise<void> {
  await db.update(giveaways).set({ endsAt }).where(eq(giveaways.id, id));
}

export async function listGiveaways(
  db: Database,
  guildUuid: string,
  limit = 30,
): Promise<Array<{ giveaway: Giveaway; entries: number }>> {
  const rows = await db
    .select({ giveaway: giveaways, entries: count(giveawayEntries.id) })
    .from(giveaways)
    .leftJoin(giveawayEntries, eq(giveawayEntries.giveawayId, giveaways.id))
    .where(eq(giveaways.guildId, guildUuid))
    .groupBy(giveaways.id)
    .orderBy(desc(giveaways.createdAt))
    .limit(limit);

  return rows.map((row) => ({ giveaway: row.giveaway, entries: Number(row.entries) }));
}

export async function getGiveaway(
  db: Database,
  guildUuid: string,
  id: string,
): Promise<Giveaway | null> {
  const [row] = await db
    .select()
    .from(giveaways)
    .where(and(eq(giveaways.guildId, guildUuid), eq(giveaways.id, id)))
    .limit(1);
  return row ?? null;
}

export async function findActiveGiveawayByMessage(
  db: Database,
  guildUuid: string,
  messageId: string,
): Promise<Giveaway | null> {
  const [row] = await db
    .select()
    .from(giveaways)
    .where(
      and(
        eq(giveaways.guildId, guildUuid),
        eq(giveaways.messageId, messageId),
        eq(giveaways.status, 'active'),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listDueGiveaways(db: Database, now = new Date()): Promise<Giveaway[]> {
  return db
    .select()
    .from(giveaways)
    .where(and(eq(giveaways.status, 'active'), lte(giveaways.endsAt, now)));
}

export async function addGiveawayEntry(
  db: Database,
  giveawayId: string,
  userId: string,
): Promise<void> {
  await db
    .insert(giveawayEntries)
    .values({ giveawayId, userId })
    .onConflictDoNothing({ target: [giveawayEntries.giveawayId, giveawayEntries.userId] });
}

export async function removeGiveawayEntry(
  db: Database,
  giveawayId: string,
  userId: string,
): Promise<void> {
  await db
    .delete(giveawayEntries)
    .where(and(eq(giveawayEntries.giveawayId, giveawayId), eq(giveawayEntries.userId, userId)));
}

export async function listGiveawayEntries(
  db: Database,
  giveawayId: string,
): Promise<GiveawayEntry[]> {
  return db.select().from(giveawayEntries).where(eq(giveawayEntries.giveawayId, giveawayId));
}

export async function endGiveaway(db: Database, id: string): Promise<void> {
  await db
    .update(giveaways)
    .set({ status: 'ended', endedAt: new Date() })
    .where(eq(giveaways.id, id));
}

export async function cancelGiveaway(db: Database, id: string): Promise<void> {
  await db
    .update(giveaways)
    .set({ status: 'cancelled', endedAt: new Date() })
    .where(eq(giveaways.id, id));
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export async function createTicket(
  db: Database,
  input: { guildId: string; channelId: string; userId: string },
): Promise<Ticket> {
  const [row] = await db.insert(tickets).values(input).returning();
  if (!row) throw new Error('Failed to create ticket');
  return row;
}

export async function getTicketByChannel(db: Database, channelId: string): Promise<Ticket | null> {
  const [row] = await db.select().from(tickets).where(eq(tickets.channelId, channelId)).limit(1);
  return row ?? null;
}

export async function listTickets(db: Database, guildUuid: string, limit = 20): Promise<Ticket[]> {
  return db
    .select()
    .from(tickets)
    .where(eq(tickets.guildId, guildUuid))
    .orderBy(desc(tickets.createdAt))
    .limit(limit);
}

export async function closeTicket(db: Database, id: string): Promise<void> {
  await db
    .update(tickets)
    .set({ status: 'closed', closedAt: new Date() })
    .where(eq(tickets.id, id));
}

// ---------------------------------------------------------------------------
// Temporary voice channels
// ---------------------------------------------------------------------------

export async function createTempVoice(
  db: Database,
  input: { guildId: string; channelId: string; ownerId: string },
): Promise<TempVoice> {
  const [row] = await db.insert(tempVoices).values(input).returning();
  if (!row) throw new Error('Failed to create temporary voice channel');
  return row;
}

export async function getTempVoiceByChannel(
  db: Database,
  channelId: string,
): Promise<TempVoice | null> {
  const [row] = await db
    .select()
    .from(tempVoices)
    .where(eq(tempVoices.channelId, channelId))
    .limit(1);
  return row ?? null;
}

export async function deleteTempVoice(db: Database, channelId: string): Promise<void> {
  await db.delete(tempVoices).where(eq(tempVoices.channelId, channelId));
}

export async function listTempVoices(db: Database, guildUuid: string): Promise<TempVoice[]> {
  return db.select().from(tempVoices).where(eq(tempVoices.guildId, guildUuid));
}

export async function findOpenTicketForUser(
  db: Database,
  guildUuid: string,
  userId: string,
): Promise<Ticket | null> {
  const [row] = await db
    .select()
    .from(tickets)
    .where(
      and(eq(tickets.guildId, guildUuid), eq(tickets.userId, userId), eq(tickets.status, 'open')),
    )
    .limit(1);
  return row ?? null;
}
