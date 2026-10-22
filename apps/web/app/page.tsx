import {
  ArrowRight,
  BarChart3,
  Code2,
  Gift,
  MessageSquare,
  Server,
  ShieldCheck,
  Sparkles,
  Ticket,
  UserCog,
  Users,
  Volume2,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SiteFooter } from '@/components/site-footer';
import { Code } from '@/components/ui';
import { getSession } from '@/lib/auth';
import { env } from '@/lib/env';

const newFeatures = [
  {
    icon: MessageSquare,
    title: 'Welcome messages',
    description: 'Greet every join with variables and a live preview.',
  },
  {
    icon: Gift,
    title: 'Giveaways',
    description: 'Reaction entry, timed draws and automatic winners.',
  },
  {
    icon: Ticket,
    title: 'Support tickets',
    description: 'Private threads with your staff role.',
  },
  {
    icon: Volume2,
    title: 'Temp voice',
    description: 'Join to create; auto-delete when everyone leaves.',
  },
];

const features = [
  {
    icon: BarChart3,
    title: 'Levels that stick',
    description:
      'XP per message with a configurable curve, cooldowns, announcements and role rewards. Rank and leaderboard included.',
  },
  {
    icon: Users,
    title: 'A real community kit',
    description:
      'Welcome and leave messages, reaction giveaways, private-thread tickets and join-to-create voice channels.',
  },
  {
    icon: UserCog,
    title: 'Roles people can pick',
    description:
      'Reaction roles, join auto-roles and self-assignable menus — with hierarchy checks so the bot never oversteps.',
  },
  {
    icon: Sparkles,
    title: 'Fun without setup',
    description:
      'Dice, coinflips, the 8-ball, random picks and compatibility scores, on by default and individually toggleable.',
  },
  {
    icon: Server,
    title: 'Any Fluxer instance',
    description:
      'Endpoints come from /.well-known/fluxer. Works on fluxer.app and on your own deployment, with no code changes.',
  },
  {
    icon: ShieldCheck,
    title: 'Admin-grade controls',
    description:
      'Fluxer OAuth2, permission-derived access, per-command overrides and an audit log of every change.',
  },
];

const selfHostPoints = [
  'One docker compose up — Postgres included.',
  'OAuth2 login against your own instance.',
  'Config changes reach the bot instantly via LISTEN/NOTIFY.',
  'MIT licensed, no vendor lock-in, no external services.',
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
      <header className="flex items-center justify-between gap-6">
        <Link href="/" className="text-sm font-semibold tracking-tight text-zinc-100">
          fluxbot
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-zinc-400 sm:flex">
          <a href="#features" className="transition hover:text-zinc-100">
            Features
          </a>
          <a href="#self-host" className="transition hover:text-zinc-100">
            Self-host
          </a>
          <a
            href="https://github.com/martintondel02/fluxbot"
            className="inline-flex items-center gap-2 transition hover:text-zinc-100"
            target="_blank"
            rel="noreferrer"
          >
            <Code2 className="size-4" /> GitHub
          </a>
        </nav>
        <Link
          href="/login"
          className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-400"
        >
          Sign in
        </Link>
      </header>

      <main className="flex-1">
        <section className="grid items-center gap-12 py-16 lg:grid-cols-[1.05fr_1fr] lg:py-24">
          <div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-200">
              <span className="size-1.5 rounded-full bg-violet-400" />
              Self-hosted · MIT · works with any Fluxer instance
            </div>

            <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight text-zinc-50 sm:text-5xl">
              A Fluxer bot that is actually{' '}
              <span className="bg-gradient-to-r from-violet-300 to-cyan-300 bg-clip-text text-transparent">
                configurable
              </span>
              .
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-400">
              Levels, welcome messages, giveaways, tickets, temporary voice and roles — configured
              in a browser, not a wall of commands. Fluxer has no slash commands or buttons, so the
              dashboard becomes the interface.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-400"
              >
                Sign in with Fluxer <ArrowRight className="size-4" />
              </Link>
              <a
                href="#self-host"
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
              >
                Self-host in one command
              </a>
            </div>

            <p className="mt-5 text-xs text-zinc-600">
              No cloud service required · your Postgres · changes apply live
            </p>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-tr from-violet-500/20 via-transparent to-cyan-400/10 blur-2xl"
            />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b12] shadow-2xl shadow-black/60">
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
                <span className="size-2 rounded-full bg-red-400/60" />
                <span className="size-2 rounded-full bg-amber-400/60" />
                <span className="size-2 rounded-full bg-emerald-400/60" />
                <span className="ml-3 truncate text-[11px] text-zinc-500">fluxbot.mtenk.no</span>
              </div>
              <Image
                src="/screenshots/dashboard.webp"
                width={1600}
                height={1111}
                alt="Fluxbot dashboard showing a guild overview with levels, roles and recent changes"
                className="w-full"
                priority
                unoptimized
              />
            </div>
            <p className="mt-3 text-center text-xs text-zinc-600">
              A real guild — levels, community, roles and audit log in one place.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2 px-1">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
              New
            </span>
            <span className="text-xs text-zinc-500">Just shipped in the community update</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {newFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-xl bg-black/20 p-4">
                  <Icon className="size-4 text-violet-300" />
                  <div className="mt-2 text-sm font-medium text-zinc-100">{feature.title}</div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="features" className="scroll-mt-8 pt-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-violet-300">
                Everything in one bot
              </div>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
                Built around the dashboard
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Every module is opt-in, permission-checked and configured per server. No prefix
                memorisation required.
              </p>
            </div>
            <a
              href="https://github.com/martintondel02/fluxbot/blob/main/ROADMAP.md"
              className="text-sm text-violet-300 transition hover:text-violet-200"
              target="_blank"
              rel="noreferrer"
            >
              See the roadmap →
            </a>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-white/20"
                >
                  <Icon className="size-5 text-violet-300" />
                  <h3 className="mt-3 text-sm font-semibold text-zinc-100">{feature.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section
          id="self-host"
          className="mt-24 grid scroll-mt-8 gap-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6 lg:grid-cols-2 lg:p-10"
        >
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-violet-300">
              Self-hosting first
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">
              Your server. Your database. Your rules.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Fluxbot is designed to run next to your Fluxer deployment, not on someone else&apos;s
              platform. One Compose stack, one dashboard, no external queue or cloud account.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-zinc-300">
              {selfHostPoints.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-400" />
                  {point}
                </li>
              ))}
            </ul>
            <a
              href="https://github.com/martintondel02/fluxbot/blob/main/docs/self-hosting.md"
              className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-violet-300 transition hover:text-violet-200"
              target="_blank"
              rel="noreferrer"
            >
              Read the self-hosting guide <ArrowRight className="size-4" />
            </a>
          </div>

          <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-black/50 p-5 font-mono text-sm text-zinc-300">
            <div className="mb-3 text-xs text-zinc-500"># anywhere with Docker</div>
            <div>
              <Code>git clone https://github.com/martintondel02/fluxbot</Code>
            </div>
            <div className="mt-2">
              <Code>cd fluxbot && cp .env.example .env</Code>
            </div>
            <div className="mt-2">
              <Code>docker compose up -d</Code>
            </div>
            <div className="mt-4 border-t border-white/10 pt-4 text-xs text-zinc-500">
              Then open <span className="text-zinc-300">http://localhost:3000</span> and sign in
              with your Fluxer account.
            </div>
          </div>
        </section>

        <section className="py-24 text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 sm:text-3xl">
            Give your Fluxer community a proper bot.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-zinc-400">
            Sign in with the account that manages your server, or run it yourself. Either way, you
            keep control of the data.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-violet-500 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-400"
            >
              Sign in with Fluxer <ArrowRight className="size-4" />
            </Link>
            <a
              href="https://github.com/martintondel02/fluxbot"
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
              target="_blank"
              rel="noreferrer"
            >
              <Code2 className="size-4" /> View the source
            </a>
          </div>
        </section>

        {env.demoMode ? (
          <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            Demo mode is enabled. Sign in to explore the dashboard with sample data.
          </div>
        ) : null}
      </main>

      <SiteFooter className="mt-0" />
    </div>
  );
}
