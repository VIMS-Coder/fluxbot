import type { Logger } from '@fluxbot/core';
import type { Database, Sql } from '@fluxbot/db';
import {
  claimJobs,
  completeJob,
  deleteExpiredSessions,
  failJob,
  listDueGiveaways,
  setBotPresence,
  setBotStatus,
} from '@fluxbot/db';
import { fetchGatewayBot, type InstanceDiscovery } from '@fluxbot/fluxer';
import { finishGiveaway } from '@fluxbot/modules';
import type { Client } from '@fluxerjs/core';
import type { FluxerActions } from './runtime/actions';
import type { GuildRegistry } from './runtime/guildRegistry';

export interface SchedulerDeps {
  db: Database;
  sql: Sql;
  client: Client;
  actions: FluxerActions;
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
      const guildCount = await setBotPresence(deps.db, deps.instanceId, [
        ...deps.client.guilds.cache.keys(),
      ]);
      await setBotStatus(deps.db, deps.instanceId, {
        guildCount,
        shardCount: info.shards,
        latencyMs: null,
        version: deps.version,
        startedAt: deps.startedAt,
      });
    } catch (error) {
      deps.logger.warn('Bot heartbeat failed', { error: (error as Error).message });
    }

    try {
      const due = await listDueGiveaways(deps.db);
      for (const giveaway of due) {
        const winners = await finishGiveaway(
          { db: deps.db, actions: deps.actions, logger: deps.logger },
          giveaway,
        );
        deps.logger.info('Giveaway ended', {
          giveawayId: giveaway.id,
          winners: winners.length,
        });
      }
    } catch (error) {
      deps.logger.warn('Giveaway processing failed', {
        error: (error as Error).message,
      });
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
