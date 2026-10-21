import { ArrowRight, BarChart3, Code2, Server, Sparkles, UserCog } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Code } from '@/components/ui';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';

const features = [
  {
    icon: BarChart3,
    title: 'Levels that stick',
    description:
      'XP per message with a configurable curve, cooldowns and role rewards. Rank and leaderboard included.',
  },
  {
    icon: Sparkles,
    title: 'Fun without setup',
    description:
      'Dice, coinflips, the 8-ball, random picks and compatibility scores — on by default.',
  },
  {
    icon: UserCog,
    title: 'Roles people can pick',
    description:
      'Reaction roles, join auto-roles and self-assignable menus, all built from the dashboard.',
  },
  {
    icon: Server,
    title: 'Any Fluxer instance',
    description:
      'Endpoints come from /.well-known/fluxer. Works on fluxer.app and on your own deployment.',
  },
];

export default async function HomePage() {
  let signedIn = false;
  try {
    signedIn = (await getSession()) !== null;
  } catch {
    signedIn = false;
  }

  if (signedIn) redirect('/guilds');

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <div className="text-sm font-semibold tracking-tight text-zinc-100">fluxbot</div>
        <div className="flex items-center gap-4 text-sm">
          <a
            href="https://github.com/martintondel02/fluxbot"
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-100"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 className="size-4" /> GitHub
          </a>
          <Link
            href="/login"
            className="rounded-lg bg-violet-500 px-4 py-2 font-medium text-white transition hover:bg-violet-400"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center py-20">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
          <span className="size-1.5 rounded-full bg-violet-400" />
          Self-hosted · MIT · works with any Fluxer instance
        </div>

        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-5xl">
          A Fluxer bot that is actually{' '}
          <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
            configurable
          </span>
          .
        </h1>

        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-400">
          Fluxer has no slash commands or buttons, so the dashboard becomes the interface. Fluxbot
          gives your community levels, fun and roles — and gives you a browser to manage all of it.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-400"
          >
            Sign in with Fluxer <ArrowRight className="size-4" />
          </Link>
          <a
            href="https://github.com/martintondel02/fluxbot#quick-start-docker"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
            target="_blank"
            rel="noreferrer"
          >
            Self-host in one command
          </a>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
              >
                <Icon className="size-5 text-violet-300" />
                <h3 className="mt-3 text-sm font-semibold text-zinc-100">{feature.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{feature.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-black/40 p-5 font-mono text-sm text-zinc-300">
          <div className="mb-2 text-xs text-zinc-500"># docker-compose.yml</div>
          <div>
            <Code>git clone https://github.com/martintondel02/fluxbot</Code>
          </div>
          <div className="mt-1">
            <Code>cp .env.example .env && docker compose up -d</Code>
          </div>
        </div>

        {env.demoMode ? (
          <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Demo mode is enabled. Sign in to explore the dashboard with sample data.
          </div>
        ) : null}
      </main>

      <footer className="border-t border-white/10 pt-6 text-xs text-zinc-600">
        Fluxbot is an independent community project and is not affiliated with Fluxer.
      </footer>
    </div>
  );
}
