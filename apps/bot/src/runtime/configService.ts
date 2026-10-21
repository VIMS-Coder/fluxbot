import type { Logger } from '@fluxbot/core';
import { type Database, getGuildConfig, type Sql } from '@fluxbot/db';
import { getModuleConfig } from '@fluxbot/modules';

interface CacheEntry {
  config: Record<string, unknown>;
  fetchedAt: number;
}

const TTL_MS = 60_000;

/**
 * Per-guild module configuration cache.
 *
 * Invalidated immediately by Postgres `NOTIFY fluxbot_config` (the dashboard
 * bumps it on every save), with a TTL as a safety net.
 */
export class ConfigService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly db: Database,
    private readonly sql: Sql,
    private readonly logger: Logger,
    private readonly onInvalidate?: (guildUuid: string) => void,
  ) {}

  async get(guildUuid: string, moduleId: string): Promise<Record<string, unknown>> {
    const key = `${guildUuid}:${moduleId}`;
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.config;

    const raw = await getGuildConfig(this.db, guildUuid, moduleId);
    const config = getModuleConfig(moduleId, raw as Record<string, unknown> | null);
    this.cache.set(key, { config, fetchedAt: Date.now() });
    return config;
  }

  invalidateGuild(guildUuid: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${guildUuid}:`)) this.cache.delete(key);
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  async startListening(): Promise<void> {
    await this.sql.listen('fluxbot_config', (payload) => {
      const guildUuid = payload.split(':')[0];
      if (!guildUuid) return;
      this.invalidateGuild(guildUuid);
      this.onInvalidate?.(guildUuid);
      this.logger.debug('Config cache invalidated', { guildUuid });
    });
    this.logger.info('Listening for config changes');
  }

  async stopListening(): Promise<void> {
    await this.sql.listen('fluxbot_config', () => {}).catch(() => {});
  }
}
