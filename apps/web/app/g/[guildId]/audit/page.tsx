import { listAudit } from '@fluxbot/db';
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui';
import { getDb } from '@/lib/db';
import { formatDateTime, relativeTime } from '@/lib/format';
import { requireGuildAdmin } from '@/lib/guard';

export const metadata = { title: 'Audit log' };

export default async function AuditPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const access = await requireGuildAdmin(guildId);
  const entries = await listAudit(getDb(), access.guild.id, 100);

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every dashboard change, who made it, and what it replaced."
      />

      <Card>
        <CardHeader title={`${entries.length} recent changes`} />
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">No changes yet.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {entries.map((entry) => (
              <li key={entry.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone="violet">{entry.action}</Badge>
                    <span className="text-sm text-zinc-300">{entry.actorName ?? 'Fluxbot'}</span>
                    {entry.target ? (
                      <span className="text-xs text-zinc-600">→ {entry.target}</span>
                    ) : null}
                  </div>
                  <span className="text-xs text-zinc-500" title={formatDateTime(entry.createdAt)}>
                    {relativeTime(entry.createdAt)}
                  </span>
                </div>

                {entry.before || entry.after ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-300">
                      Show changes
                    </summary>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <div>
                        <div className="mb-1 text-xs uppercase tracking-wide text-zinc-600">
                          Before
                        </div>
                        <pre className="max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-zinc-400">
                          {JSON.stringify(entry.before, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <div className="mb-1 text-xs uppercase tracking-wide text-zinc-600">
                          After
                        </div>
                        <pre className="max-h-48 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 text-xs text-zinc-400">
                          {JSON.stringify(entry.after, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </details>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
