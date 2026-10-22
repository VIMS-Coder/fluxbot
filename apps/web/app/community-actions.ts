'use server';

import {
  cancelGiveaway,
  deleteTempVoice,
  getGuildConfig,
  getGuildSnapshot,
  createGiveaway as insertGiveaway,
  recordAudit,
  setGiveawayEndsAt,
  setGiveawayMessage,
  setGuildConfig,
} from '@fluxbot/db';
import { giveawayEmbed, previewWelcome } from '@fluxbot/modules';
import {
  giveawaysConfigSchema,
  tempVoiceConfigSchema,
  ticketsConfigSchema,
  welcomeConfigSchema,
} from '@fluxbot/modules/config';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { botApi, reactAsBot } from '@/lib/botApi';
import { getDb } from '@/lib/db';
import { assertGuildAdmin } from '@/lib/guard';
import { getDiscovery } from '@/lib/instance';

function text(form: FormData, key: string): string {
  return String(form.get(key) ?? '').trim();
}

function number(form: FormData, key: string, fallback: number): number {
  const value = Number(form.get(key));
  return Number.isFinite(value) ? value : fallback;
}

function checked(form: FormData, key: string): boolean {
  const value = form.get(key);
  return value === 'on' || value === 'true' || value === '1';
}

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function admin(guildUuid: string) {
  try {
    return await assertGuildAdmin(guildUuid);
  } catch (error) {
    redirect(`/guilds?error=${encodeURIComponent((error as Error).message)}`);
  }
}

function zodMessage(error: { issues: Array<{ path: PropertyKey[]; message: string }> }): string {
  const issue = error.issues[0];
  if (!issue) return 'Invalid values';
  const path = issue.path.join('.');
  return path ? `${path}: ${issue.message}` : issue.message;
}

async function audit(
  guildUuid: string,
  actorId: string,
  actorName: string,
  action: string,
  before: unknown,
  after: unknown,
): Promise<void> {
  await recordAudit(getDb(), {
    guildId: guildUuid,
    actorUserId: actorId,
    actorName,
    action,
    before: (before ?? null) as Record<string, unknown> | null,
    after: (after ?? null) as Record<string, unknown> | null,
  });
}

async function channelExists(guildUuid: string, channelId: string): Promise<boolean> {
  const snapshot = await getGuildSnapshot(getDb(), guildUuid);
  return snapshot?.channels.some((channel) => channel.id === channelId) ?? false;
}

async function roleExists(guildUuid: string, roleId: string): Promise<boolean> {
  const snapshot = await getGuildSnapshot(getDb(), guildUuid);
  return snapshot?.roles.some((role) => role.id === roleId) ?? false;
}

async function sendBotMessage(
  channelId: string,
  payload: { content?: string; embeds?: unknown[] },
): Promise<{ id: string }> {
  const discovery = await getDiscovery();
  return botApi<{ id: string }>(discovery, 'POST', `/channels/${channelId}/messages`, payload);
}

// ---------------------------------------------------------------------------
// Welcome
// ---------------------------------------------------------------------------

export async function saveWelcomeAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/community`;

  const parsed = welcomeConfigSchema.safeParse({
    enabled: checked(form, 'enabled'),
    channelId: text(form, 'channelId') || null,
    joinMessage: text(form, 'joinMessage'),
    leaveMessage: text(form, 'leaveMessage'),
    sendLeave: checked(form, 'sendLeave'),
  });
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  if (parsed.data.enabled && !parsed.data.channelId) {
    fail(path, 'Pick a channel for welcome messages.');
  }
  if (parsed.data.channelId && !(await channelExists(guildUuid, parsed.data.channelId))) {
    fail(path, 'That channel no longer exists.');
  }

  const db = getDb();
  const before = await getGuildConfig(db, guildUuid, 'welcome');
  await setGuildConfig(
    db,
    guildUuid,
    'welcome',
    parsed.data as unknown as Record<string, unknown>,
    access.session.user.id,
  );
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'welcome.update',
    before,
    parsed.data,
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function testWelcomeAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/community`;
  const config = welcomeConfigSchema.parse(
    (await getGuildConfig(getDb(), guildUuid, 'welcome')) ?? {},
  );

  if (!config.channelId) fail(path, 'Pick a channel first.');

  try {
    await sendBotMessage(config.channelId, {
      embeds: [
        {
          title: 'Welcome preview',
          description: previewWelcome(config.joinMessage),
          color: 0x22c55e,
          footer: { text: 'Sent from the dashboard' },
        },
      ],
    });
  } catch (error) {
    fail(path, `Could not send the preview: ${(error as Error).message}`);
  }

  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'welcome.test',
    null,
    { channelId: config.channelId },
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

// ---------------------------------------------------------------------------
// Giveaways
// ---------------------------------------------------------------------------

export async function saveGiveawaysAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/community`;

  const parsed = giveawaysConfigSchema.safeParse({
    enabled: checked(form, 'enabled'),
    emoji: text(form, 'emoji') || '🎉',
    defaultDurationMinutes: number(form, 'defaultDurationMinutes', 60),
    defaultWinners: number(form, 'defaultWinners', 1),
  });
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const db = getDb();
  const before = await getGuildConfig(db, guildUuid, 'giveaways');
  await setGuildConfig(
    db,
    guildUuid,
    'giveaways',
    parsed.data as unknown as Record<string, unknown>,
    access.session.user.id,
  );
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'giveaways.update',
    before,
    parsed.data,
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function createGiveawayAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/community`;

  const channelId = text(form, 'channelId');
  const prize = text(form, 'prize');
  const durationMinutes = number(form, 'durationMinutes', 60);
  const winners = number(form, 'winners', 1);

  if (!channelId) fail(path, 'Pick a channel.');
  if (!(await channelExists(guildUuid, channelId))) fail(path, 'That channel no longer exists.');
  if (!prize || prize.length > 200) fail(path, 'Prize must be 1–200 characters.');
  if (durationMinutes < 1 || durationMinutes > 43_200)
    fail(path, 'Duration must be 1–43,200 minutes.');
  if (winners < 1 || winners > 20) fail(path, 'Winners must be between 1 and 20.');

  const config = giveawaysConfigSchema.parse(
    (await getGuildConfig(getDb(), guildUuid, 'giveaways')) ?? {},
  );
  if (!config.enabled) fail(path, 'Enable giveaways first.');

  const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  const db = getDb();
  const giveaway = await insertGiveaway(db, {
    guildId: guildUuid,
    channelId,
    prize,
    emoji: config.emoji,
    winnersCount: winners,
    endsAt,
    createdBy: access.session.user.fluxerId,
  });

  try {
    const message = await sendBotMessage(channelId, {
      embeds: [
        giveawayEmbed({
          prize,
          emoji: config.emoji,
          winnersCount: winners,
          endsAt,
          entries: 0,
          hostId: access.session.user.fluxerId,
        }) as unknown as Record<string, unknown>,
      ],
    });
    await setGiveawayMessage(db, giveaway.id, message.id);
    await reactAsBot({ channelId, messageId: message.id, emoji: config.emoji }).catch(() => {});
  } catch (error) {
    await cancelGiveaway(db, giveaway.id);
    fail(path, `Could not post the giveaway: ${(error as Error).message}`);
  }

  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'giveaways.create',
    null,
    { prize, channelId, winners, endsAt: endsAt.toISOString() },
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function endGiveawayNowAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/community`;
  const id = text(form, 'id');

  await setGiveawayEndsAt(getDb(), id, new Date());
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'giveaways.end',
    { id },
    { endsAt: 'now' },
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function cancelGiveawayAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/community`;
  const id = text(form, 'id');

  await cancelGiveaway(getDb(), id);
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'giveaways.cancel',
    { id },
    null,
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export async function saveTicketsAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/community`;

  const parsed = ticketsConfigSchema.safeParse({
    enabled: checked(form, 'enabled'),
    parentChannelId: text(form, 'parentChannelId') || null,
    staffRoleId: text(form, 'staffRoleId') || null,
    welcomeMessage: text(form, 'welcomeMessage'),
  });
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  if (parsed.data.enabled && !parsed.data.parentChannelId) {
    fail(path, 'Pick a parent channel for tickets.');
  }
  if (
    parsed.data.parentChannelId &&
    !(await channelExists(guildUuid, parsed.data.parentChannelId))
  ) {
    fail(path, 'That parent channel no longer exists.');
  }
  if (parsed.data.staffRoleId && !(await roleExists(guildUuid, parsed.data.staffRoleId))) {
    fail(path, 'That staff role no longer exists.');
  }

  const db = getDb();
  const before = await getGuildConfig(db, guildUuid, 'tickets');
  await setGuildConfig(
    db,
    guildUuid,
    'tickets',
    parsed.data as unknown as Record<string, unknown>,
    access.session.user.id,
  );
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'tickets.update',
    before,
    parsed.data,
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

// ---------------------------------------------------------------------------
// Temporary voice
// ---------------------------------------------------------------------------

export async function saveTempVoiceAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/community`;

  const parsed = tempVoiceConfigSchema.safeParse({
    enabled: checked(form, 'enabled'),
    hubChannelId: text(form, 'hubChannelId') || null,
    categoryId: text(form, 'categoryId') || null,
    nameTemplate: text(form, 'nameTemplate'),
    userLimit: number(form, 'userLimit', 0),
  });
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  if (parsed.data.enabled && !parsed.data.hubChannelId) {
    fail(path, 'Pick a hub voice channel.');
  }
  if (parsed.data.hubChannelId && !(await channelExists(guildUuid, parsed.data.hubChannelId))) {
    fail(path, 'That hub channel no longer exists.');
  }
  if (parsed.data.categoryId && !(await channelExists(guildUuid, parsed.data.categoryId))) {
    fail(path, 'That category no longer exists.');
  }

  const db = getDb();
  const before = await getGuildConfig(db, guildUuid, 'tempvoice');
  await setGuildConfig(
    db,
    guildUuid,
    'tempvoice',
    parsed.data as unknown as Record<string, unknown>,
    access.session.user.id,
  );
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'tempvoice.update',
    before,
    parsed.data,
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function deleteTempVoiceAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/community`;
  const channelId = text(form, 'channelId');
  if (!channelId) fail(path, 'Missing channel.');

  const discovery = await getDiscovery();
  await botApi(discovery, 'DELETE', `/channels/${channelId}`).catch(() => {});
  await deleteTempVoice(getDb(), channelId);
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'tempvoice.delete',
    { channelId },
    null,
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}
