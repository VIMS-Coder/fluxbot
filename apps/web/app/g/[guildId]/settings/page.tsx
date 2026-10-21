import { getBotStatus } from '@fluxbot/db';
import { buildInviteUrl, invitePermissions, permissionsToNames } from '@fluxbot/fluxer';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { savePrefixAction } from '@/app/actions';
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Stat,
} from '@/components/ui';
import { getFunConfig, getLevelsConfig, getRolesConfig } from '@/lib/data';
import { getDb } from '@/lib/db';
import { env } from '@/lib/env';
import { relativeTime } from '@/lib/format';
import { requireGuildAdmin } from '@/lib/guard';
import { getDiscovery } from '@/lib/instance';

export const metadata = { title: 'Settings' };

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { guildId } = await params;
  const { saved, error } = await searchParams;
  const access = await requireGuildAdmin(guildId);

  const [discovery, bot, levels, fun, roles] = await Promise.all([
    getDiscovery(),
    getBotStatus(getDb(), access.session.instance.id),
    getLevelsConfig(access.guild.id),
    getFunConfig(access.guild.id),
    getRolesConfig(access.guild.id),
  ]);

  const enabledModules: Array<'levels' | 'fun' | 'roles'> = [];
  if (levels.enabled) enabledModules.push('levels');
  if (fun.enabled) enabledModules.push('fun');
  if (roles.enabled) enabledModules.push('roles');

  const invite = buildInviteUrl({
    webapp: discovery.endpoints.webapp,
    clientId: env.appId,
    permissions: invitePermissions(enabledModules),
  });

  const botOnline = bot !== null && Date.now() - bot.lastSeenAt.getTime() < 120_000;
  const requiredPermissions = permissionsToNames(invitePermissions(enabledModules));

  return (
    <>
      <PageHeader title="Settings" description="Server-level options and connection details." />

      {saved ? <Banner tone="green">Saved.</Banner> : null}
      {error ? <Banner tone="red">{error}</Banner> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Command prefix" description="1–3 characters, no spaces." />
          <form action={savePrefixAction} className="flex items-end gap-3">
            <input type="hidden" name="guildId" value={access.guild.id} />
            <div className="w-28">
              <Field label="Prefix" htmlFor="prefix">
                <Input
                  id="prefix"
                  name="prefix"
                  defaultValue={access.guild.prefix}
                  maxLength={3}
                  required
                />
              </Field>
            </div>
            <Button type="submit" variant="secondary">
              Save
            </Button>
          </form>
          <p className="mt-3 text-xs text-zinc-500">
            Members can also mention the bot, e.g.{' '}
            <span className="text-zinc-400">@Fluxbot ping</span>.
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Bot status"
            description="Reported by the bot process every 30 seconds."
          />
          <div className="mb-4 flex items-center gap-2">
            <Badge tone={botOnline ? 'green' : 'red'}>{botOnline ? 'Online' : 'Offline'}</Badge>
            {bot ? (
              <span className="text-xs text-zinc-500">
                last seen {relativeTime(bot.lastSeenAt)}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Guilds" value={bot?.guildCount ?? 0} />
            <Stat label="Shards" value={bot?.shardCount ?? 1} />
            <Stat label="Version" value={bot?.version ?? '—'} />
            <Stat label="Latency" value={bot?.latencyMs ? `${bot.latencyMs}ms` : '—'} />
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Invite link"
          description="Regenerated from the modules you have enabled, so the bot never asks for more than it needs."
          actions={
            <a
              href={invite}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-violet-300 hover:text-violet-200"
            >
              Open <ExternalLink className="size-3.5" />
            </a>
          }
        />
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
              Required bot permissions
            </div>
            <div className="flex flex-wrap gap-1.5">
              {enabledModules.length === 0 ? (
                <span className="text-sm text-zinc-500">Enable a module first.</span>
              ) : (
                requiredPermissions.map((name) => (
                  <Badge key={name} tone="violet">
                    {name.replaceAll('_', ' ').toLowerCase()}
                  </Badge>
                ))
              )}
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <code className="break-all text-xs text-zinc-400">{invite}</code>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Instance" description="Read from /.well-known/fluxer at startup." />
          <dl className="space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-zinc-500">Origin</dt>
              <dd className="text-right text-zinc-300">{access.session.instance.origin}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-zinc-500">Public API</dt>
              <dd className="break-all text-right text-zinc-300">
                {discovery.endpoints.api_public}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-zinc-500">Gateway</dt>
              <dd className="break-all text-right text-zinc-300">{discovery.endpoints.gateway}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-zinc-500">Deployment</dt>
              <dd className="text-right">
                <Badge tone={discovery.features.self_hosted ? 'violet' : 'zinc'}>
                  {discovery.features.self_hosted ? 'Self-hosted' : 'Hosted'}
                </Badge>
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader
            title="Your access"
            description="Derived from your Fluxer permissions in this guild."
          />
          <div className="flex flex-wrap gap-1.5">
            {permissionsToNames(access.permissions).map((name) => (
              <Badge key={name} tone="zinc">
                {name.replaceAll('_', ' ').toLowerCase()}
              </Badge>
            ))}
          </div>
          <p className="mt-4 flex items-start gap-2 text-xs text-zinc-500">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
            Permissions are re-checked on every request. If they change in Fluxer, they are
            refreshed here within five minutes.
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Modules" description="Jump to the configuration for each module." />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { href: `/g/${guildId}/levels`, name: 'Levels', enabled: levels.enabled },
            { href: `/g/${guildId}/fun`, name: 'Fun', enabled: fun.enabled },
            { href: `/g/${guildId}/roles`, name: 'Roles', enabled: roles.enabled },
          ].map((module) => (
            <Link
              key={module.name}
              href={module.href}
              className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 p-4 text-sm transition hover:border-violet-400/40"
            >
              <span className="text-zinc-200">{module.name}</span>
              <Badge tone={module.enabled ? 'green' : 'zinc'}>
                {module.enabled ? 'On' : 'Off'}
              </Badge>
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}
