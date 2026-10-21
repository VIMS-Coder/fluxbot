import { Plus, Trash2 } from 'lucide-react';
import {
  addAutoRoleAction,
  addReactionRoleAction,
  addSelfRoleAction,
  deleteAutoRoleAction,
  deleteReactionRoleAction,
  deleteSelfRoleAction,
  saveRolesAction,
} from '@/app/actions';
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
  Toggle,
} from '@/components/ui';
import { getRolesPageData } from '@/lib/data';
import { channelName, roleName } from '@/lib/format';
import { requireGuildAdmin } from '@/lib/guard';

export const metadata = { title: 'Roles' };

function RolePicker({
  roles,
  name,
  id,
}: {
  roles: Array<{ id: string; name: string }>;
  name: string;
  id: string;
}) {
  return (
    <Select id={id} name={name} required>
      <option value="">Select a role…</option>
      {roles.map((role) => (
        <option key={role.id} value={role.id}>
          {role.name}
        </option>
      ))}
    </Select>
  );
}

export default async function RolesPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { guildId } = await params;
  const { saved, error } = await searchParams;
  const access = await requireGuildAdmin(guildId);
  const { config, reactionRoles, autoRoles, selfRoles, snapshot } = await getRolesPageData(
    access.guild.id,
  );

  const textChannels = snapshot.channels.filter(
    (channel) => channel.name && (channel.type === 0 || channel.type === 5),
  );
  const channels = textChannels.length > 0 ? textChannels : snapshot.channels.filter((c) => c.name);
  const assignableRoles = snapshot.roles.filter((role) => role.id !== access.guild.guildId);

  return (
    <>
      <PageHeader
        title="Roles"
        description="Reaction menus, roles on join, and roles members can pick themselves."
        actions={
          <Badge tone={config.enabled ? 'green' : 'zinc'}>
            {config.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        }
      />

      {saved ? <Banner tone="green">Saved.</Banner> : null}
      {error ? <Banner tone="red">{error}</Banner> : null}

      <form action={saveRolesAction} className="space-y-6">
        <input type="hidden" name="guildId" value={access.guild.id} />
        <Card>
          <CardHeader title="Module" description="All role features are opt-in per guild." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle
              name="enabled"
              label="Enable the roles module"
              defaultChecked={config.enabled}
            />
            <Toggle
              name="reactionRolesEnabled"
              label="Reaction roles"
              description="Toggle roles by reacting to a message."
              defaultChecked={config.reactionRolesEnabled}
            />
            <Toggle
              name="autoRolesOnJoin"
              label="Auto-roles on join"
              description="Grant roles automatically when a member joins."
              defaultChecked={config.autoRolesOnJoin}
            />
            <Toggle
              name="allowSelfRoles"
              label="Self-assignable roles"
              description="Let members use !iam and !iamnot."
              defaultChecked={config.allowSelfRoles}
            />
          </div>
        </Card>
        <div className="flex justify-end">
          <Button type="submit">Save changes</Button>
        </div>
      </form>

      <Card className="mt-6">
        <CardHeader
          title="Reaction roles"
          description="Map an emoji on an existing message to a role. The bot adds the reaction for you when possible."
        />

        {reactionRoles.length === 0 ? (
          <EmptyState
            title="No reaction menus yet"
            description="Send a message in a channel, copy its ID, then map emojis to roles below."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Emoji</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Mode</th>
                  <th className="px-4 py-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {reactionRoles.map((menu) => (
                  <tr key={menu.id}>
                    <td className="px-4 py-3 text-zinc-300">
                      <div>{channelName(snapshot.channels, menu.channelId)}</div>
                      <div className="text-xs text-zinc-600">{menu.messageId}</div>
                    </td>
                    <td className="px-4 py-3 text-lg">{menu.emoji}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      {roleName(snapshot.roles, menu.roleId)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={menu.mode === 'unique' ? 'violet' : 'zinc'}>
                        {menu.mode === 'unique' ? 'Pick one' : 'Toggle'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <form action={deleteReactionRoleAction}>
                        <input type="hidden" name="guildId" value={access.guild.id} />
                        <input type="hidden" name="id" value={menu.id} />
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

        <form
          action={addReactionRoleAction}
          className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        >
          <input type="hidden" name="guildId" value={access.guild.id} />
          <div className="lg:col-span-2">
            <Field label="Channel" htmlFor="rrChannel">
              <Select id="rrChannel" name="channelId" required>
                <option value="">Select a channel…</option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="lg:col-span-2">
            <Field label="Message ID" htmlFor="rrMessage">
              <Input id="rrMessage" name="messageId" placeholder="1501320000000000000" required />
            </Field>
          </div>
          <div>
            <Field label="Emoji" htmlFor="rrEmoji">
              <Input id="rrEmoji" name="emoji" placeholder="🎨" required />
            </Field>
          </div>
          <div>
            <Field label="Mode" htmlFor="rrMode">
              <Select id="rrMode" name="mode" defaultValue="toggle">
                <option value="toggle">Toggle</option>
                <option value="unique">Pick one</option>
              </Select>
            </Field>
          </div>
          <div className="lg:col-span-3">
            <Field label="Role" htmlFor="rrRole">
              <RolePicker roles={assignableRoles} name="roleId" id="rrRole" />
            </Field>
          </div>
          <div className="flex items-end lg:col-span-3">
            <Button type="submit" variant="secondary">
              <Plus className="size-4" /> Add reaction role
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Auto-roles"
            description="Roles granted automatically when someone joins. The bot must outrank them."
          />
          {autoRoles.length === 0 ? (
            <p className="text-sm text-zinc-500">No auto-roles configured.</p>
          ) : (
            <ul className="space-y-2">
              {autoRoles.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="text-zinc-300">{roleName(snapshot.roles, row.roleId)}</span>
                  <form action={deleteAutoRoleAction}>
                    <input type="hidden" name="guildId" value={access.guild.id} />
                    <input type="hidden" name="roleId" value={row.roleId} />
                    <Button variant="ghost" type="submit" className="px-2 py-1 text-red-300">
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addAutoRoleAction} className="mt-4 space-y-3">
            <input type="hidden" name="guildId" value={access.guild.id} />
            <Field label="Role" htmlFor="autoRole">
              <RolePicker roles={assignableRoles} name="roleId" id="autoRole" />
            </Field>
            <Button type="submit" variant="secondary">
              <Plus className="size-4" /> Add auto-role
            </Button>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Self-assignable roles"
            description="Members use !roles to list these and !iam / !iamnot to change them."
          />
          {selfRoles.length === 0 ? (
            <p className="text-sm text-zinc-500">No self-assignable roles configured.</p>
          ) : (
            <ul className="space-y-2">
              {selfRoles.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <span className="text-zinc-300">{roleName(snapshot.roles, row.roleId)}</span>
                  <form action={deleteSelfRoleAction}>
                    <input type="hidden" name="guildId" value={access.guild.id} />
                    <input type="hidden" name="roleId" value={row.roleId} />
                    <Button variant="ghost" type="submit" className="px-2 py-1 text-red-300">
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form action={addSelfRoleAction} className="mt-4 space-y-3">
            <input type="hidden" name="guildId" value={access.guild.id} />
            <Field label="Role" htmlFor="selfRole">
              <RolePicker roles={assignableRoles} name="roleId" id="selfRole" />
            </Field>
            <Button type="submit" variant="secondary">
              <Plus className="size-4" /> Add self-role
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
