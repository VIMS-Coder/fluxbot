import { listGuildsForUser } from '@fluxbot/db';
import { buildInviteUrl, invitePermissions } from '@fluxbot/fluxer';
import { ArrowRight, Bot, Code2, LogOut, Plus } from 'lucide-react';
import Link from 'next/link';
import { Badge, Banner } from '@/components/ui';
import { requireSession, syncGuildsForSession } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { env } from '@/lib/env';
import { guildColor, initials } from '@/lib/format';
import { getDiscovery } from '@/lib/instance';

export const metadata = { title: 'Your servers' };

export default async function GuildsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const session = await requireSession();

  let syncError: string | null = null;
  try {
    await syncGuildsForSession(session);
  } catch (refreshError) {
    syncError =
      refreshError instanceof Error
        ? `Could not refresh your servers from Fluxer: ${refreshError.message}`
        : 'Could not refresh your servers from Fluxer.';
  }

  const guilds = await listGuildsForUser(getDb(), session.user.id);
  const discovery = await getDiscovery();

  const permissions = invitePermissions(['levels', 'fun', 'roles']);
  const inviteBase = buildInviteUrl({
    webapp: discovery.endpoints.webapp,
    clientId: env.appId,
    permissions,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-100">
          fluxbot
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-right">
            <div className="text-zinc-300">{session.user.globalName ?? session.user.username}</div>
            <div className="text-xs text-zinc-500">{session.instance.origin}</div>
          </div>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-white/10 p-2 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </header>

      <main className="mt-12">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Your servers</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Fluxbot only lists servers where you hold <strong>Manage Server</strong> or{' '}
          <strong>Administrator</strong>.
        </p>

        {error ? (
          <div className="mt-6">
            <Banner tone="red">{decodeURIComponent(error)}</Banner>
          </div>
        ) : null}
        {syncError ? (
          <div className="mt-6">
            <Banner tone="amber">{syncError}</Banner>
          </div>
        ) : null}

        {guilds.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-white/15 bg-black/20 p-10 text-center">
            <Bot className="mx-auto size-8 text-zinc-600" />
            <div className="mt-3 text-sm font-medium text-zinc-300">
              No manageable servers found
            </div>
            <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">
              Create a server on your instance, or ask an admin to give you Manage Server. Then
              reload this page.
            </p>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {guilds.map(({ guild, member }) => {
              const present = guild.botPresent;
              const invite = buildInviteUrl({
                webapp: discovery.endpoints.webapp,
                clientId: env.appId,
                permissions,
                guildId: guild.guildId,
                disableGuildSelect: true,
              });

              return (
                <div
                  key={guild.id}
                  className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white"
                      style={{ backgroundColor: guildColor(guild.guildId) }}
                    >
                      {initials(guild.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-zinc-100">
                        {guild.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        {present ? (
                          <Badge tone="green">Bot installed</Badge>
                        ) : (
                          <Badge tone="amber">Bot not installed</Badge>
                        )}
                        {member.isOwner ? <Badge tone="violet">Owner</Badge> : null}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center gap-2">
                    {present ? (
                      <Link
                        href={`/g/${guild.id}`}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-400"
                      >
                        Open dashboard <ArrowRight className="size-4" />
                      </Link>
                    ) : (
                      <a
                        href={invite}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-400"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Plus className="size-4" /> Invite Fluxbot
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-4 text-xs text-zinc-600">
          <a
            href={inviteBase}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-zinc-400"
          >
            <Bot className="size-3.5" /> Invite to another server
          </a>
          <a
            href="https://github.com/martintondel02/fluxbot"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-zinc-400"
          >
            <Code2 className="size-3.5" /> Source
          </a>
          <span>Signed in as {session.user.fluxerId}</span>
        </div>
      </main>
    </div>
  );
}
