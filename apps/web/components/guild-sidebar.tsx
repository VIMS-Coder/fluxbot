import { ArrowLeft, Code2, LogOut } from 'lucide-react';
import Link from 'next/link';
import { env } from '@/lib/env';
import { guildColor, initials } from '@/lib/format';
import { NavLinks } from './nav-links';

export function GuildSidebar({
  guildId,
  guildFluxerId,
  guildName,
  userName,
  userFluxerId,
}: {
  guildId: string;
  guildFluxerId: string;
  guildName: string;
  userName: string;
  userFluxerId: string;
}) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-6 border-b border-white/10 bg-black/20 p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r">
      <div className="flex items-center gap-3">
        <Link
          href="/guilds"
          className="flex size-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-zinc-400 transition hover:text-zinc-100"
          aria-label="Back to servers"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-100">
          fluxbot
        </Link>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: guildColor(guildFluxerId) }}
        >
          {initials(guildName)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-100">{guildName}</div>
          <div className="truncate text-xs text-zinc-500">{guildFluxerId}</div>
        </div>
      </div>

      <NavLinks guildId={guildId} />

      <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="min-w-0">
            <div className="truncate text-sm text-zinc-300">{userName}</div>
            <div className="truncate text-xs text-zinc-500">{userFluxerId}</div>
          </div>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-lg p-2 text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
              aria-label="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
        <div className="flex items-center gap-3 px-1 text-xs text-zinc-600">
          <a
            href="https://github.com/martintondel02/fluxbot"
            className="inline-flex items-center gap-1 hover:text-zinc-400"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 className="size-3.5" /> Source
          </a>
          <span className="truncate">{env.instanceOrigin || 'demo instance'}</span>
        </div>
      </div>
    </aside>
  );
}
