import { saveFunAction } from '@/app/actions';
import {
  Badge,
  Banner,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Toggle,
} from '@/components/ui';
import { getFunConfig } from '@/lib/data';
import { requireGuildAdmin } from '@/lib/guard';

export const metadata = { title: 'Fun' };

const COMMANDS = [
  { key: 'dice', label: 'Dice', example: '!dice 2d20' },
  { key: 'coinflip', label: 'Coinflip', example: '!coinflip' },
  { key: 'eightball', label: '8-ball', example: '!8ball will it rain?' },
  { key: 'choose', label: 'Choose', example: '!choose tea | coffee' },
  { key: 'ship', label: 'Ship', example: '!ship @a @b' },
] as const;

export default async function FunPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { guildId } = await params;
  const { saved, error } = await searchParams;
  const access = await requireGuildAdmin(guildId);
  const config = await getFunConfig(access.guild.id);

  return (
    <>
      <PageHeader
        title="Fun"
        description="Low-stakes commands that make a server feel alive. Toggle each one independently."
        actions={
          <Badge tone={config.enabled ? 'green' : 'zinc'}>
            {config.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        }
      />

      {saved ? <Banner tone="green">Saved.</Banner> : null}
      {error ? <Banner tone="red">{decodeURIComponent(error)}</Banner> : null}

      <form action={saveFunAction} className="space-y-6">
        <input type="hidden" name="guildId" value={access.guild.id} />

        <Card>
          <CardHeader title="Commands" description="Enabled commands respond in any channel." />
          <div className="grid gap-3 sm:grid-cols-2">
            {COMMANDS.map((command) => (
              <Toggle
                key={command.key}
                name={command.key}
                label={command.label}
                description={`e.g. ${command.example}`}
                defaultChecked={config[command.key] === true}
              />
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Rate limit"
            description="Per-user cooldown shared by all fun commands."
          />
          <div className="max-w-xs">
            <Field label="Cooldown (seconds)" htmlFor="cooldownSeconds">
              <Input
                id="cooldownSeconds"
                name="cooldownSeconds"
                type="number"
                min={0}
                max={3600}
                defaultValue={config.cooldownSeconds}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <Toggle
            name="enabled"
            label="Enable the fun module"
            description="Turning this off disables every command above at once."
            defaultChecked={config.enabled}
          />
        </Card>

        <div className="flex justify-end">
          <Button type="submit">Save changes</Button>
        </div>
      </form>
    </>
  );
}
