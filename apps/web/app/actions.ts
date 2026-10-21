'use server';

import {
  addAutoRole,
  addReactionRole,
  addSelfRole,
  getGuildConfig,
  getGuildSnapshot,
  recordAudit,
  removeAutoRole,
  removeLevelReward,
  removeReactionRole,
  removeSelfRole,
  setCommandSetting,
  setGuildConfig,
  setLevelReward,
  updateGuildSettings,
} from '@fluxbot/db';
import { commandCatalog } from '@fluxbot/modules/catalog';
import { funConfigSchema, levelsConfigSchema, rolesConfigSchema } from '@fluxbot/modules/config';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { reactAsBot } from '@/lib/botApi';
import { getDb } from '@/lib/db';
import { assertGuildAdmin } from '@/lib/guard';

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

async function roleExists(guildUuid: string, roleId: string): Promise<boolean> {
  const snapshot = await getGuildSnapshot(getDb(), guildUuid);
  return snapshot?.roles.some((role) => role.id === roleId) ?? false;
}

// ---------------------------------------------------------------------------
// Module configuration
// ---------------------------------------------------------------------------

export async function saveLevelsAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/levels`;

  const minXp = number(form, 'minXp', 15);
  const maxXp = number(form, 'maxXp', 25);
  if (maxXp < minXp) fail(path, 'Max XP must be greater than or equal to min XP.');

  const parsed = levelsConfigSchema.safeParse({
    enabled: checked(form, 'enabled'),
    minXp,
    maxXp,
    cooldownSeconds: number(form, 'cooldownSeconds', 60),
    announceLevelUp: checked(form, 'announceLevelUp'),
    announceChannelId: text(form, 'announceChannelId') || null,
    curveBase: number(form, 'curveBase', 100),
    curveFactor: number(form, 'curveFactor', 25),
    ignoredChannels: form.getAll('ignoredChannels').map(String),
    ignoredRoles: form.getAll('ignoredRoles').map(String),
    ignoreCommands: checked(form, 'ignoreCommands'),
  });

  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const db = getDb();
  const before = await getGuildConfig(db, guildUuid, 'levels');
  await setGuildConfig(
    db,
    guildUuid,
    'levels',
    parsed.data as unknown as Record<string, unknown>,
    access.session.user.id,
  );
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'levels.update',
    before,
    parsed.data,
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function saveFunAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/fun`;

  const parsed = funConfigSchema.safeParse({
    enabled: checked(form, 'enabled'),
    cooldownSeconds: number(form, 'cooldownSeconds', 3),
    dice: checked(form, 'dice'),
    coinflip: checked(form, 'coinflip'),
    eightball: checked(form, 'eightball'),
    choose: checked(form, 'choose'),
    ship: checked(form, 'ship'),
  });
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const db = getDb();
  const before = await getGuildConfig(db, guildUuid, 'fun');
  await setGuildConfig(
    db,
    guildUuid,
    'fun',
    parsed.data as unknown as Record<string, unknown>,
    access.session.user.id,
  );
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'fun.update',
    before,
    parsed.data,
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function saveRolesAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/roles`;

  const parsed = rolesConfigSchema.safeParse({
    enabled: checked(form, 'enabled'),
    allowSelfRoles: checked(form, 'allowSelfRoles'),
    autoRolesOnJoin: checked(form, 'autoRolesOnJoin'),
    reactionRolesEnabled: checked(form, 'reactionRolesEnabled'),
  });
  if (!parsed.success) fail(path, zodMessage(parsed.error));

  const db = getDb();
  const before = await getGuildConfig(db, guildUuid, 'roles');
  await setGuildConfig(
    db,
    guildUuid,
    'roles',
    parsed.data as unknown as Record<string, unknown>,
    access.session.user.id,
  );
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'roles.update',
    before,
    parsed.data,
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function saveCommandAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/commands`;
  const command = text(form, 'command');

  if (!commandCatalog.some((entry) => entry.name === command)) {
    fail(path, 'Unknown command');
  }

  const permissionLevel = text(form, 'permissionLevel');
  if (!['default', 'moderator', 'admin'].includes(permissionLevel)) {
    fail(path, 'Unknown permission level');
  }

  const cooldownRaw = text(form, 'cooldownSeconds');
  const cooldownMs = cooldownRaw === '' ? null : Math.max(0, Number(cooldownRaw) || 0) * 1000;

  await setCommandSetting(getDb(), guildUuid, command, {
    enabled: checked(form, 'enabled'),
    permissionLevel,
    cooldownMs,
  });
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'commands.update',
    { command },
    { command, enabled: checked(form, 'enabled'), permissionLevel, cooldownMs },
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function savePrefixAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/settings`;
  const prefix = text(form, 'prefix');

  if (prefix.length === 0 || prefix.length > 3 || /\s/.test(prefix)) {
    fail(path, 'The prefix must be 1–3 characters with no spaces.');
  }

  await updateGuildSettings(getDb(), guildUuid, { prefix });
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'settings.prefix',
    { prefix: access.guild.prefix },
    { prefix },
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

// ---------------------------------------------------------------------------
// Level rewards
// ---------------------------------------------------------------------------

export async function addLevelRewardAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/levels`;
  const level = number(form, 'level', 0);
  const roleId = text(form, 'roleId');

  if (!Number.isInteger(level) || level < 1 || level > 500) fail(path, 'Level must be 1–500.');
  if (!roleId) fail(path, 'Pick a role.');
  if (!(await roleExists(guildUuid, roleId))) fail(path, 'That role no longer exists.');

  await setLevelReward(getDb(), guildUuid, level, roleId);
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'levels.reward.add',
    null,
    { level, roleId },
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function deleteLevelRewardAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/levels`;
  const level = number(form, 'level', 0);

  await removeLevelReward(getDb(), guildUuid, level);
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'levels.reward.remove',
    { level },
    null,
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

// ---------------------------------------------------------------------------
// Reaction roles, auto roles, self roles
// ---------------------------------------------------------------------------

export async function addReactionRoleAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/roles`;

  const channelId = text(form, 'channelId');
  const messageId = text(form, 'messageId');
  const emoji = text(form, 'emoji');
  const roleId = text(form, 'roleId');
  const mode = text(form, 'mode') === 'unique' ? 'unique' : 'toggle';

  if (!channelId) fail(path, 'Pick a channel.');
  if (!/^\d{5,}$/.test(messageId)) fail(path, 'Message ID must be a snowflake.');
  if (!emoji) fail(path, 'Pick an emoji.');
  if (!roleId) fail(path, 'Pick a role.');
  if (!(await roleExists(guildUuid, roleId))) fail(path, 'That role no longer exists.');

  try {
    await addReactionRole(getDb(), {
      guildId: guildUuid,
      channelId,
      messageId,
      emoji,
      roleId,
      mode,
    });
  } catch {
    fail(path, 'That emoji is already mapped on this message.');
  }

  // Best effort: the bot reacts so the menu is usable immediately. A missing
  // reaction is not fatal (the message may be in a channel the bot cannot see).
  try {
    await reactAsBot({ channelId, messageId, emoji });
  } catch {
    // Recorded implicitly by the missing reaction; the mapping still works.
  }

  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'roles.reaction.add',
    null,
    { channelId, messageId, emoji, roleId, mode },
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function deleteReactionRoleAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/roles`;
  const id = text(form, 'id');

  await removeReactionRole(getDb(), id);
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'roles.reaction.remove',
    { id },
    null,
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function addAutoRoleAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/roles`;
  const roleId = text(form, 'roleId');

  if (!roleId) fail(path, 'Pick a role.');
  if (!(await roleExists(guildUuid, roleId))) fail(path, 'That role no longer exists.');

  await addAutoRole(getDb(), guildUuid, roleId);
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'roles.auto.add',
    null,
    { roleId },
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function deleteAutoRoleAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/roles`;
  const roleId = text(form, 'roleId');

  await removeAutoRole(getDb(), guildUuid, roleId);
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'roles.auto.remove',
    { roleId },
    null,
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function addSelfRoleAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/roles`;
  const roleId = text(form, 'roleId');

  if (!roleId) fail(path, 'Pick a role.');
  if (!(await roleExists(guildUuid, roleId))) fail(path, 'That role no longer exists.');

  await addSelfRole(getDb(), guildUuid, roleId);
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'roles.self.add',
    null,
    { roleId },
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}

export async function deleteSelfRoleAction(form: FormData): Promise<void> {
  const guildUuid = text(form, 'guildId');
  const access = await admin(guildUuid);
  const path = `/g/${guildUuid}/roles`;
  const roleId = text(form, 'roleId');

  await removeSelfRole(getDb(), guildUuid, roleId);
  await audit(
    guildUuid,
    access.session.user.id,
    access.session.user.globalName ?? access.session.user.username,
    'roles.self.remove',
    { roleId },
    null,
  );

  revalidatePath(path);
  redirect(`${path}?saved=1`);
}
