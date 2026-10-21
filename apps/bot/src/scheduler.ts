import type { Logger } from '@fluxbot/core';
import type { Database, Sql } from '@fluxbot/db';
import { claimJobs, completeJob, deleteExpiredSessions, failJob, setBotStatus } from '@fluxbot/db';
import { fetchGatewayBot, type InstanceDiscovery } from '@fluxbot/fluxer';
import type { GuildRegistry } from './runtime/guildRegistry';

export interface SchedulerDeps {
  db: Database;
  sql: Sql;
  instanceId: string;
  discovery: InstanceDiscovery;
  botToken: string;
  registry: GuildRegistry;
  logger: Logger;
  version: string;
  startedAt: Date;
}

const STATUS_INTERVAL_MS = 30_000;
const MAINTENANCE_INTERVAL_MS = 60 * 60 * 1000;
const WORKER_ID = `bot-${process.pid}`;

/**
 * Periodic background work: bot heartbeat for the dashboard, expired session
 * cleanup, and the database-backed job queue.
 */
export function startScheduler(deps: SchedulerDeps): () => void {
  let stopped = false;

  const heartbeat = async () => {
    if (stopped) return;
    try {
      const info = await fetchGatewayBot({
        discovery: deps.discovery,
        botToken: deps.botToken,
      });
      await setBotStatus(deps.db, deps.instanceId, {
        guildCount: deps.registry.size,
        shardCount: info.shards,
        latencyMs: null,
        version: deps.version,
        startedAt: deps.startedAt,
      });
    } catch (error) {
      deps.logger.warn('Bot heartbeat failed', { error: (error as Error).message });
    }

    try {
      const jobs = await claimJobs(deps.db, WORKER_ID, 5);
      for (const job of jobs) {
        try {
          // No job types are registered yet; the queue exists for reminders,
          // temp bans and giveaways in the next milestones.
          deps.logger.debug('Skipping unhandled job', { type: job.type, id: job.id });
          await completeJob(deps.db, job.id);
        } catch (error) {
          await failJob(deps.db, job.id, (error as Error).message);
        }
      }
    } catch (error) {
      deps.logger.warn('Job poll failed', { error: (error as Error).message });
    }
  };

  const maintenance = async () => {
    try {
      const removed = await deleteExpiredSessions(deps.db);
      if (removed > 0) deps.logger.debug('Pruned expired sessions', { removed });
    } catch (error) {
      deps.logger.warn('Session cleanup failed', { error: (error as Error).message });
    }
  };

  const statusTimer = setInterval(() => void heartbeat(), STATUS_INTERVAL_MS);
  const maintenanceTimer = setInterval(() => void maintenance(), MAINTENANCE_INTERVAL_MS);

  void heartbeat();
  void maintenance();

  return () => {
    stopped = true;
    clearInterval(statusTimer);
    clearInterval(maintenanceTimer);
  };
}
