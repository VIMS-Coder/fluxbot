import { commandCatalog } from '@fluxbot/modules/catalog';
import { saveCommandAction } from '@/app/actions';
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  Input,
  PageHeader,
  Select,
} from '@/components/ui';
import { getCommandsPageData } from '@/lib/data';
import { requireGuildAdmin } from '@/lib/guard';

export const metadata = { title: 'Commands' };

const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core',
  levels: 'Levels',
  fun: 'Fun',
  roles: 'Roles',
  moderation: 'Moderation',
};

export default async function CommandsPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { guildId } = await params;
  const { saved, error } = await searchParams;
  const access = await requireGuildAdmin(guildId);
  const settings = await getCommandsPageData(access.guild.id);

  const categories = ['core', 'levels', 'fun', 'roles', 'moderation'];

  return (
    <>
      <PageHeader
        title="Commands"
        description="Toggle commands, raise their permission level, or override the cooldown for this server."
      />

      {saved ? <Banner tone="green">Saved.</Banner> : null}
      {error ? <Banner tone="red">{decodeURIComponent(error)}</Banner> : null}

      <div className="space-y-6">
        {categories.map((category) => {
          const commands = commandCatalog.filter((command) => command.category === category);
          if (commands.length === 0) return null;

          return (
            <Card key={category}>
              <CardHeader title={CATEGORY_LABELS[category] ?? category} />
              <div className="divide-y divide-white/5">
                {commands.map((command) => {
                  const setting = settings.get(command.name);
                  const cooldownValue =
                    setting?.cooldownMs !== null && setting?.cooldownMs !== undefined
                      ? setting.cooldownMs / 1000
                      : '';

                  return (
                    <form
                      key={command.name}
                      action={saveCommandAction}
                      className="flex flex-wrap items-end gap-3 py-4 first:pt-0 last:pb-0"
                    >
                      <input type="hidden" name="guildId" value={access.guild.id} />
                      <input type="hidden" name="command" value={command.name} />

                      <div className="min-w-52 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200">
                            {access.guild.prefix}
                            {command.name}
                          </span>
                          {setting?.enabled === false ? <Badge tone="red">Disabled</Badge> : null}
                          {command.userPermissions.length > 0 ? (
                            <Badge tone="amber">{command.userPermissions.join(', ')}</Badge>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">{command.description}</div>
                      </div>

                      <label className="flex items-center gap-2 pb-2 text-xs text-zinc-400">
                        <input
                          type="checkbox"
                          name="enabled"
                          defaultChecked={setting?.enabled ?? true}
                          className="size-4 accent-violet-500"
                        />
                        Enabled
                      </label>

                      <div className="w-36 pb-1">
                        <Select
                          name="permissionLevel"
                          defaultValue={setting?.permissionLevel ?? 'default'}
                          aria-label="Permission level"
                        >
                          <option value="default">Everyone</option>
                          <option value="moderator">Moderators</option>
                          <option value="admin">Admins</option>
                        </Select>
                      </div>

                      <div className="w-28 pb-1">
                        <Input
                          name="cooldownSeconds"
                          type="number"
                          min={0}
                          max={86400}
                          placeholder="default"
                          defaultValue={cooldownValue}
                          aria-label="Cooldown in seconds"
                        />
                      </div>

                      <Button type="submit" variant="secondary" className="mb-1">
                        Save
                      </Button>
                    </form>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-xs text-zinc-600">
        Cooldown overrides are in seconds. Leave the field empty to use the command default.
      </p>
    </>
  );
}
