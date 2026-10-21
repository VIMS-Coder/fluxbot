import { Plus, Trash2 } from 'lucide-react';
import { addLevelRewardAction, deleteLevelRewardAction, saveLevelsAction } from '@/app/actions';
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Stat,
  Toggle,
} from '@/components/ui';
import { getLevelsPageData } from '@/lib/data';
import { roleName } from '@/lib/format';
import { requireGuildAdmin } from '@/lib/guard';

export const metadata = { title: 'Levels' };

export default async function LevelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { guildId } = await params;
  const { saved, error } = await searchParams;
  const access = await requireGuildAdmin(guildId);

  const { config, rewards, ranked, snapshot } = await getLevelsPageData(access.guild.id);
  const textChannels = snapshot.channels.filter(
    (channel) => channel.name && (channel.type === 0 || channel.type === 5),
  );
  const channels = textChannels.length > 0 ? textChannels : snapshot.channels.filter((c) => c.name);

  return (
    <>
      <PageHeader
        title="Levels"
        description="Give every message a little XP, then reward the people who stick around."
        actions={
          <Badge tone={config.enabled ? 'green' : 'zinc'}>
            {config.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        }
      />

      {saved ? <Banner tone="green">Saved. The bot picks this up immediately.</Banner> : null}
      {error ? <Banner tone="red">{error}</Banner> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Ranked members" value={ranked} hint="Members with XP" />
        <Stat label="XP per message" value={`${config.minXp}–${config.maxXp}`} />
        <Stat label="Cooldown" value={`${config.cooldownSeconds}s`} />
      </div>

      <form action={saveLevelsAction} className="space-y-6">
        <input type="hidden" name="guildId" value={access.guild.id} />

        <Card>
          <CardHeader title="XP" description="How much members earn and how often." />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Minimum XP" htmlFor="minXp">
              <Input
                id="minXp"
                name="minXp"
                type="number"
                min={1}
                max={1000}
                defaultValue={config.minXp}
              />
            </Field>
            <Field label="Maximum XP" htmlFor="maxXp">
              <Input
                id="maxXp"
                name="maxXp"
                type="number"
                min={1}
                max={1000}
                defaultValue={config.maxXp}
              />
            </Field>
            <Field
              label="Cooldown (seconds)"
              hint="0 means every message earns XP."
              htmlFor="cooldownSeconds"
            >
              <Input
                id="cooldownSeconds"
                name="cooldownSeconds"
                type="number"
                min={0}
                max={86400}
                defaultValue={config.cooldownSeconds}
              />
            </Field>
            <Field label="Ignore commands" hint="Do not award XP for commands.">
              <label className="flex h-[38px] items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-zinc-300">
                <input
                  type="checkbox"
                  name="ignoreCommands"
                  defaultChecked={config.ignoreCommands}
                  className="size-4 accent-violet-500"
                />
                Ignore
              </label>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Curve"
            description="XP needed for each level: base + factor × level²."
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Base" htmlFor="curveBase">
              <Input
                id="curveBase"
                name="curveBase"
                type="number"
                min={10}
                max={10000}
                defaultValue={config.curveBase}
              />
            </Field>
            <Field label="Factor" htmlFor="curveFactor">
              <Input
                id="curveFactor"
                name="curveFactor"
                type="number"
                min={0}
                max={1000}
                defaultValue={config.curveFactor}
              />
            </Field>
            <div className="sm:col-span-2">
              <Toggle
                name="announceLevelUp"
                label="Announce level-ups"
                description="Post a message when someone levels up."
                defaultChecked={config.announceLevelUp}
              />
            </div>
          </div>
          <div className="mt-4">
            <Field label="Announcement channel" htmlFor="announceChannelId">
              <Select
                id="announceChannelId"
                name="announceChannelId"
                defaultValue={config.announceChannelId ?? ''}
              >
                <option value="">Same channel as the message</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Exclusions"
            description="Channels and roles that never earn XP (useful for bot spam and staff channels)."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ignored channels">
              <Select
                name="ignoredChannels"
                multiple
                defaultValue={config.ignoredChannels}
                className="h-40"
              >
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Ignored roles">
              <Select
                name="ignoredRoles"
                multiple
                defaultValue={config.ignoredRoles}
                className="h-40"
              >
                {snapshot.roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <Toggle
            name="enabled"
            label="Enable the levels module"
            description="When off, XP is not granted and rank commands politely refuse."
            defaultChecked={config.enabled}
          />
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Save changes</Button>
        </div>
      </form>

      <Card className="mt-6">
        <CardHeader
          title="Role rewards"
          description="Grant a role when a member reaches a level. The bot's role must sit above the reward role."
        />

        {rewards.length === 0 ? (
          <EmptyState
            title="No rewards yet"
            description="Pick a level and a role to get started."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rewards.map((reward) => (
                  <tr key={reward.id}>
                    <td className="px-4 py-3 text-zinc-300">{reward.level}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {roleName(snapshot.roles, reward.roleId)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteLevelRewardAction}>
                        <input type="hidden" name="guildId" value={access.guild.id} />
                        <input type="hidden" name="level" value={reward.level} />
                        <Button variant="ghost" type="submit" className="px-2 py-1 text-red-300">
                          <Trash2 className="size-4" />
                        </Button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form action={addLevelRewardAction} className="mt-5 flex flex-wrap items-end gap-3">
          <input type="hidden" name="guildId" value={access.guild.id} />
          <div className="w-28">
            <Field label="Level" htmlFor="rewardLevel">
              <Input id="rewardLevel" name="level" type="number" min={1} max={500} required />
            </Field>
          </div>
          <div className="min-w-48 flex-1">
            <Field label="Role" htmlFor="rewardRole">
              <Select id="rewardRole" name="roleId" required>
                <option value="">Select a role…</option>
                {snapshot.roles
                  .filter((role) => role.id !== access.guild.guildId)
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <Button type="submit" variant="secondary">
            <Plus className="size-4" /> Add reward
          </Button>
        </form>
      </Card>
    </>
  );
}
