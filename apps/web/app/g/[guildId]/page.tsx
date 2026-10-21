import type { LevelsConfig } from '@fluxbot/modules/config';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleOff,
  ScrollText,
  Sparkles,
  UserCog,
} from 'lucide-react';
import Link from 'next/link';
import { Badge, Card, CardHeader, PageHeader, Stat } from '@/components/ui';
import { getFunConfig, getLevelsConfig, getOverviewData, getRolesConfig } from '@/lib/data';
import { channelName, relativeTime, roleName } from '@/lib/format';
import { requireGuildAdmin } from '@/lib/guard';

export const metadata = { title: 'Overview' };

export default async function GuildOverviewPage({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const access = await requireGuildAdmin(guildId);

  const [data, levels, fun, roles] = await Promise.all([
    getOverviewData(access.guild.id, access.session),
    getLevelsConfig(access.guild.id),
    getFunConfig(access.guild.id),
    getRolesConfig(access.guild.id),
  ]);

  const botOnline = data.bot !== null && Date.now() - data.bot.lastSeenAt.getTime() < 120_000;

  const modules = [
    {
      href: `/g/${guildId}/levels`,
      icon: BarChart3,
      name: 'Levels',
      enabled: levels.enabled,
      detail: `${data.ranked} ranked members`,
    },
    {
      href: `/g/${guildId}/fun`,
      icon: Sparkles,
      name: 'Fun',
      enabled: fun.enabled,
      detail: `${['dice', 'coinflip', 'eightball', 'choose', 'ship'].filter((key) => fun[key as keyof typeof fun] === true).length} commands on`,
    },
    {
      href: `/g/${guildId}/roles`,
      icon: UserCog,
      name: 'Roles',
      enabled: roles.enabled,
      detail: `${data.reactionRoles} reaction menus`,
    },
  ];

  return (
    <>
      <PageHeader
        title={access.guild.name}
        description="Everything Fluxbot knows about this server, and the levers to change it."
        actions={
          botOnline ? (
            <Badge tone="green">
              <CheckCircle2 className="size-3.5" /> Bot online
            </Badge>
          ) : (
            <Badge tone="red">
              <CircleOff className="size-3.5" /> Bot offline
            </Badge>
          )
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Ranked members" value={data.ranked} hint="Members with XP" />
        <Stat label="Reaction roles" value={data.reactionRoles} hint="Active menus" />
        <Stat
          label="Commands (7d)"
          value={data.analytics.total}
          hint={
            data.analytics.topCommands[0]
              ? `Top: !${data.analytics.topCommands[0].name}`
              : 'No usage yet'
          }
        />
        <Stat
          label="Gateway"
          value={botOnline ? 'online' : 'offline'}
          hint={data.bot ? `Seen ${relativeTime(data.bot.lastSeenAt)}` : 'Bot has not reported yet'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Link
              key={module.name}
              href={module.href}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-violet-400/40 hover:bg-white/[0.05]"
            >
              <div className="flex items-start justify-between">
                <Icon className="size-5 text-violet-300" />
                <Badge tone={module.enabled ? 'green' : 'zinc'}>
                  {module.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-zinc-100">{module.name}</div>
                  <div className="mt-0.5 text-xs text-zinc-500">{module.detail}</div>
                </div>
                <ArrowRight className="size-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-violet-300" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent changes"
            description="Who changed what, straight from the audit log."
            actions={
              <Link
                href={`/g/${guildId}/audit`}
                className="text-xs text-violet-300 hover:text-violet-200"
              >
                View all
              </Link>
            }
          />
          {data.audit.length === 0 ? (
            <p className="text-sm text-zinc-500">No changes yet.</p>
          ) : (
            <ul className="space-y-3">
              {data.audit.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 text-sm">
                  <ScrollText className="mt-0.5 size-4 shrink-0 text-zinc-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-zinc-300">
                      {entry.actorName ?? 'Fluxbot'} · {entry.action}
                    </div>
                    <div className="text-xs text-zinc-500">{relativeTime(entry.createdAt)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Server snapshot"
            description="Cached from the gateway; refreshes on changes."
          />
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-zinc-500">Channels</div>
              <div className="mt-1 text-lg font-semibold text-zinc-100">
                {data.snapshot.channels.length}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <div className="text-xs text-zinc-500">Roles</div>
              <div className="mt-1 text-lg font-semibold text-zinc-100">
                {data.snapshot.roles.length}
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-1 text-xs text-zinc-500">
            <div>
              Snapshot updated {relativeTime(data.snapshot.updatedAt)}. If the bot is offline,
              channel and role pickers may be stale.
            </div>
            {data.snapshot.roles.length > 0 ? (
              <div>
                Highest role: {roleName(data.snapshot.roles, topRoleId(data.snapshot.roles))}
              </div>
            ) : null}
            {data.snapshot.channels.length > 0 ? (
              <div>
                {channelName(
                  data.snapshot.channels,
                  data.snapshot.channels.find((channel) => channel.type === 0)?.id ?? null,
                )}{' '}
                is visible to the snapshot.
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Levels curve preview"
          description="Roughly what the current curve demands."
        />
        <CurvePreview config={levels} />
      </Card>
    </>
  );
}

function topRoleId(roles: Array<{ id: string; position: number }>): string {
  return [...roles].sort((a, b) => b.position - a.position)[0]?.id ?? '';
}

function CurvePreview({ config }: { config: LevelsConfig }) {
  const levels = [0, 1, 5, 10, 25, 50];
  return (
    <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {levels.map((level) => {
        let total = 0;
        for (let index = 0; index < level; index += 1) {
          total += Math.floor(config.curveBase + config.curveFactor * index * index);
        }
        return (
          <div key={level} className="rounded-lg border border-white/10 bg-black/20 p-3">
            <div className="text-xs text-zinc-500">Level {level}</div>
            <div className="mt-1 text-sm font-medium text-zinc-200">
              {total.toLocaleString()} XP
            </div>
          </div>
        );
      })}
    </div>
  );
}
