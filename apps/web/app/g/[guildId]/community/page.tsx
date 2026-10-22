import { Gift, MessageSquare, Ticket, Volume2 } from 'lucide-react';
import {
  cancelGiveawayAction,
  createGiveawayAction,
  deleteTempVoiceAction,
  endGiveawayNowAction,
  saveGiveawaysAction,
  saveTempVoiceAction,
  saveTicketsAction,
  saveWelcomeAction,
  testWelcomeAction,
} from '@/app/community-actions';
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
  Textarea,
  Toggle,
} from '@/components/ui';
import { getCommunityPageData } from '@/lib/data';
import { relativeTime } from '@/lib/format';
import { requireGuildAdmin } from '@/lib/guard';

export const metadata = { title: 'Community' };

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { guildId } = await params;
  const { saved, error } = await searchParams;
  const access = await requireGuildAdmin(guildId);

  const data = await getCommunityPageData(access.guild.id);
  const textChannels = data.snapshot.channels.filter(
    (channel) => channel.name && (channel.type === 0 || channel.type === 5),
  );
  const voiceChannels = data.snapshot.channels.filter(
    (channel) => channel.name && channel.type === 2,
  );
  const categories = data.snapshot.channels.filter((channel) => channel.name && channel.type === 4);
  const activeGiveaways = data.giveawayRows.filter((row) => row.giveaway.status === 'active');

  return (
    <>
      <PageHeader
        title="Community"
        description="Welcome messages, giveaways, support tickets and temporary voice channels."
      />

      {saved ? <Banner tone="green">Saved. The bot picks this up on the next event.</Banner> : null}
      {error ? <Banner tone="red">{error}</Banner> : null}

      {textChannels.length === 0 || voiceChannels.length === 0 ? (
        <Banner tone="amber">
          The guild snapshot has no text or voice channels yet. Make sure the bot is installed and
          wait for a channel change, then reload this page.
        </Banner>
      ) : null}

      {/* Welcome ------------------------------------------------------------ */}
      <Card>
        <CardHeader
          title="Welcome messages"
          description="Send a message when someone joins — and optionally when they leave."
          actions={
            <Badge tone={data.welcome.enabled ? 'green' : 'zinc'}>
              {data.welcome.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          }
        />
        <form action={saveWelcomeAction} className="space-y-4">
          <input type="hidden" name="guildId" value={access.guild.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Toggle
              name="enabled"
              label="Enable welcome messages"
              defaultChecked={data.welcome.enabled}
            />
            <Toggle
              name="sendLeave"
              label="Also send leave messages"
              defaultChecked={data.welcome.sendLeave}
            />
          </div>
          <Field label="Channel" htmlFor="welcomeChannel">
            <Select
              id="welcomeChannel"
              name="channelId"
              defaultValue={data.welcome.channelId ?? ''}
            >
              <option value="">Select a channel…</option>
              {textChannels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  #{channel.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field
              label="Join message"
              hint="Variables: {user} mention · {name} · {server} · {count}"
              htmlFor="joinMessage"
            >
              <Textarea
                id="joinMessage"
                name="joinMessage"
                rows={3}
                defaultValue={data.welcome.joinMessage}
              />
            </Field>
            <Field
              label="Leave message"
              hint="Used only when leave messages are enabled."
              htmlFor="leaveMessage"
            >
              <Textarea
                id="leaveMessage"
                name="leaveMessage"
                rows={3}
                defaultValue={data.welcome.leaveMessage}
              />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit">Save welcome</Button>
          </div>
        </form>
        <form action={testWelcomeAction} className="mt-2">
          <input type="hidden" name="guildId" value={access.guild.id} />
          <Button type="submit" variant="secondary">
            <MessageSquare className="size-4" /> Send test message
          </Button>
        </form>
      </Card>

      {/* Giveaways --------------------------------------------------------- */}
      <Card className="mt-6">
        <CardHeader
          title="Giveaways"
          description="Members enter by reacting. Winners are drawn automatically when the timer ends."
          actions={
            <Badge tone={data.giveaways.enabled ? 'green' : 'zinc'}>
              {data.giveaways.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          }
        />

        <form action={saveGiveawaysAction} className="space-y-3">
          <input type="hidden" name="guildId" value={access.guild.id} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Emoji" htmlFor="giveawayEmoji">
              <Input
                id="giveawayEmoji"
                name="emoji"
                defaultValue={data.giveaways.emoji}
                maxLength={8}
              />
            </Field>
            <Field label="Default duration (min)" htmlFor="giveawayDuration">
              <Input
                id="giveawayDuration"
                name="defaultDurationMinutes"
                type="number"
                min={1}
                max={43200}
                defaultValue={data.giveaways.defaultDurationMinutes}
              />
            </Field>
            <Field label="Default winners" htmlFor="giveawayWinners">
              <Input
                id="giveawayWinners"
                name="defaultWinners"
                type="number"
                min={1}
                max={20}
                defaultValue={data.giveaways.defaultWinners}
              />
            </Field>
            <div className="flex items-end">
              <Toggle name="enabled" label="Enabled" defaultChecked={data.giveaways.enabled} />
            </div>
          </div>
          <Button type="submit" variant="secondary">
            Save giveaway settings
          </Button>
        </form>

        <div className="my-5 h-px bg-white/10" />

        <form action={createGiveawayAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input type="hidden" name="guildId" value={access.guild.id} />
          <div className="lg:col-span-2">
            <Field label="Channel" htmlFor="giveawayChannel">
              <Select id="giveawayChannel" name="channelId" required>
                <option value="">Select a channel…</option>
                {textChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div>
            <Field label="Prize" htmlFor="giveawayPrize">
              <Input id="giveawayPrize" name="prize" placeholder="Nitro, a role…" required />
            </Field>
          </div>
          <div>
            <Field label="Duration (min)" htmlFor="giveawayDurationNew">
              <Input
                id="giveawayDurationNew"
                name="durationMinutes"
                type="number"
                min={1}
                max={43200}
                defaultValue={data.giveaways.defaultDurationMinutes}
                required
              />
            </Field>
          </div>
          <div>
            <Field label="Winners" htmlFor="giveawayWinnersNew">
              <Input
                id="giveawayWinnersNew"
                name="winners"
                type="number"
                min={1}
                max={20}
                defaultValue={data.giveaways.defaultWinners}
                required
              />
            </Field>
          </div>
          <div className="sm:col-span-2 lg:col-span-5">
            <Button type="submit">
              <Gift className="size-4" /> Start giveaway
            </Button>
          </div>
        </form>

        {data.giveawayRows.length === 0 ? (
          <div className="mt-5">
            <EmptyState title="No giveaways yet" description="Start one above." />
          </div>
        ) : (
          <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Prize</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Entries</th>
                  <th className="px-4 py-3">Ends</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.giveawayRows.map(({ giveaway, entries }) => (
                  <tr key={giveaway.id}>
                    <td className="px-4 py-3 text-zinc-200">{giveaway.prize}</td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          giveaway.status === 'active'
                            ? 'green'
                            : giveaway.status === 'ended'
                              ? 'zinc'
                              : 'red'
                        }
                      >
                        {giveaway.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{entries}</td>
                    <td className="px-4 py-3 text-zinc-400">
                      {giveaway.status === 'active' ? relativeTime(giveaway.endsAt) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {giveaway.status === 'active' ? (
                          <>
                            <form action={endGiveawayNowAction}>
                              <input type="hidden" name="guildId" value={access.guild.id} />
                              <input type="hidden" name="id" value={giveaway.id} />
                              <Button
                                type="submit"
                                variant="secondary"
                                className="px-3 py-1.5 text-xs"
                              >
                                End now
                              </Button>
                            </form>
                            <form action={cancelGiveawayAction}>
                              <input type="hidden" name="guildId" value={access.guild.id} />
                              <input type="hidden" name="id" value={giveaway.id} />
                              <Button
                                type="submit"
                                variant="danger"
                                className="px-3 py-1.5 text-xs"
                              >
                                Cancel
                              </Button>
                            </form>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-zinc-600">
          {activeGiveaways.length} active · The bot checks for due giveaways every 30 seconds.
        </p>
      </Card>

      {/* Tickets ----------------------------------------------------------- */}
      <Card className="mt-6">
        <CardHeader
          title="Support tickets"
          description="Each ticket is a private thread between the opener and your staff."
          actions={
            <Badge tone={data.tickets.enabled ? 'green' : 'zinc'}>
              {data.tickets.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          }
        />
        <form action={saveTicketsAction} className="space-y-4">
          <input type="hidden" name="guildId" value={access.guild.id} />
          <Toggle name="enabled" label="Enable tickets" defaultChecked={data.tickets.enabled} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Parent channel"
              hint="New private threads are created here."
              htmlFor="ticketParent"
            >
              <Select
                id="ticketParent"
                name="parentChannelId"
                defaultValue={data.tickets.parentChannelId ?? ''}
              >
                <option value="">Select a channel…</option>
                {textChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    #{channel.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Staff role" hint="Mentioned when a ticket opens." htmlFor="ticketStaff">
              <Select
                id="ticketStaff"
                name="staffRoleId"
                defaultValue={data.tickets.staffRoleId ?? ''}
              >
                <option value="">No staff role</option>
                {data.snapshot.roles
                  .filter((role) => role.id !== access.guild.guildId)
                  .map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <Field
            label="Ticket welcome message"
            hint="Variables: {user} · {staff}"
            htmlFor="ticketWelcome"
          >
            <Textarea
              id="ticketWelcome"
              name="welcomeMessage"
              rows={3}
              defaultValue={data.tickets.welcomeMessage}
            />
          </Field>
          <Button type="submit">Save tickets</Button>
        </form>

        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/80">
          The bot needs <strong>Create Private Threads</strong>,{' '}
          <strong>Send Messages in Threads</strong> and <strong>Manage Threads</strong>. If you
          installed Fluxbot before this release, re-open the invite link from Settings to grant
          them.
        </div>

        {data.ticketRows.length > 0 ? (
          <div className="mt-5">
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Recent tickets</div>
            <ul className="divide-y divide-white/5 text-sm">
              {data.ticketRows.slice(0, 5).map((ticket) => (
                <li key={ticket.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-zinc-300">
                    <Ticket className="mr-2 inline size-3.5 text-zinc-500" />
                    {ticket.channelId}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-zinc-500">
                    <span>opened by {ticket.userId}</span>
                    <Badge tone={ticket.status === 'open' ? 'green' : 'zinc'}>
                      {ticket.status}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {/* Temp voice -------------------------------------------------------- */}
      <Card className="mt-6">
        <CardHeader
          title="Temporary voice channels"
          description="Join the hub to get your own channel; it disappears when the last person leaves."
          actions={
            <Badge tone={data.tempVoice.enabled ? 'green' : 'zinc'}>
              {data.tempVoice.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          }
        />
        <form action={saveTempVoiceAction} className="space-y-4">
          <input type="hidden" name="guildId" value={access.guild.id} />
          <Toggle
            name="enabled"
            label="Enable join-to-create"
            defaultChecked={data.tempVoice.enabled}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Hub voice channel" htmlFor="tempHub">
              <Select
                id="tempHub"
                name="hubChannelId"
                defaultValue={data.tempVoice.hubChannelId ?? ''}
              >
                <option value="">Select a voice channel…</option>
                {voiceChannels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Category" hint="Where new channels are created." htmlFor="tempCategory">
              <Select
                id="tempCategory"
                name="categoryId"
                defaultValue={data.tempVoice.categoryId ?? ''}
              >
                <option value="">No category</option>
                {categories.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Name template"
              hint="{name} is replaced with the member's name."
              htmlFor="tempName"
            >
              <Input
                id="tempName"
                name="nameTemplate"
                defaultValue={data.tempVoice.nameTemplate}
                maxLength={100}
              />
            </Field>
            <Field label="User limit" hint="0 means unlimited." htmlFor="tempLimit">
              <Input
                id="tempLimit"
                name="userLimit"
                type="number"
                min={0}
                max={99}
                defaultValue={data.tempVoice.userLimit}
              />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit">Save temporary voice</Button>
            <span className="text-xs text-zinc-500">
              Requires Manage Channels and Move Members.
            </span>
          </div>
        </form>

        {data.tempVoiceRows.length > 0 ? (
          <div className="mt-5">
            <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
              Active channels
            </div>
            <ul className="divide-y divide-white/5 text-sm">
              {data.tempVoiceRows.map((channel) => (
                <li key={channel.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-zinc-300">
                    <Volume2 className="mr-2 inline size-3.5 text-zinc-500" />
                    {data.snapshot.channels.find((candidate) => candidate.id === channel.channelId)
                      ?.name ?? channel.channelId}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-zinc-500">
                    <span>owner {channel.ownerId}</span>
                    <form action={deleteTempVoiceAction}>
                      <input type="hidden" name="guildId" value={access.guild.id} />
                      <input type="hidden" name="channelId" value={channel.channelId} />
                      <Button type="submit" variant="danger" className="px-3 py-1.5 text-xs">
                        Delete
                      </Button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </>
  );
}
