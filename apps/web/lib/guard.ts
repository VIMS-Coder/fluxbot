import type { SessionWithUser } from '@fluxbot/db';
import { type Guild, type GuildMember, getGuildForUser } from '@fluxbot/db';
import { canManageGuild, parsePermissionMask } from '@fluxbot/fluxer';
import { notFound, redirect } from 'next/navigation';
import { requireSession, syncGuildsForSession } from './auth';
import { getDb } from './db';
import { env } from './env';

export interface GuildAccess {
  session: SessionWithUser;
  guild: Guild;
  member: GuildMember;
  permissions: bigint;
}

const STALE_MS = 5 * 60 * 1000;

/**
 * Authorise the current user for one guild, from local cached permissions.
 *
 * The mask comes from the instance's `GET /users/@me/guilds` response. It is
 * refreshed when stale, then re-checked on every request — never trusted from
 * the client.
 */
export async function requireGuildAdmin(guildUuid: string): Promise<GuildAccess> {
  const session = await requireSession();
  const db = getDb();

  let row = await getGuildForUser(db, session.user.id, guildUuid);
  if (!row) notFound();

  const stale = Date.now() - row.member.syncedAt.getTime() > STALE_MS;
  if (stale && !env.demoMode) {
    try {
      await syncGuildsForSession(session);
      row = await getGuildForUser(db, session.user.id, guildUuid);
    } catch {
      // Keep the cached permissions if Fluxer is unreachable; the next request
      // will try again.
    }
  }

  if (!row) notFound();

  const permissions = parsePermissionMask(row.member.permissions);
  if (!canManageGuild(permissions)) {
    redirect('/guilds?error=You%20need%20Manage%20Server%20in%20that%20guild.');
  }

  return { session, guild: row.guild, member: row.member, permissions };
}

/** Same guard for server actions (returns an error instead of redirecting). */
export async function assertGuildAdmin(guildUuid: string): Promise<GuildAccess> {
  const session = await requireSession();
  const db = getDb();
  const row = await getGuildForUser(db, session.user.id, guildUuid);
  if (!row) throw new Error('Guild not found or you are not a member');

  const permissions = parsePermissionMask(row.member.permissions);
  if (!canManageGuild(permissions)) {
    throw new Error('You need Manage Server in that guild');
  }

  return { session, guild: row.guild, member: row.member, permissions };
}
