import type { Logger } from '@fluxbot/core';
import {
  type Database,
  ensureGuild,
  getGuildByFluxerId,
  listGuildEntries,
  setGuildBotPresent,
} from '@fluxbot/db';

export interface GuildEntry {
  uuid: string;
  prefix: string;
}

/**
 * Maps Fluxer guild snowflakes to local guild rows and caches the prefix.
 *
 * The bot can be in guilds the dashboard has never seen (nobody logged in yet),
 * so every guild event ensures a row exists.
 */
export class GuildRegistry {
  private readonly byFluxerId = new Map<string, GuildEntry>();

  constructor(
    private readonly db: Database,
    private readonly instanceId: string,
    private readonly logger: Logger,
  ) {}

  async bootstrap(): Promise<void> {
    const rows = await listGuildEntries(this.db, this.instanceId);

    for (const row of rows) {
      this.byFluxerId.set(row.guildId, { uuid: row.id, prefix: row.prefix });
    }
    this.logger.info('Loaded guild registry', { guilds: rows.length });
  }

  get size(): number {
    return this.byFluxerId.size;
  }

  /** Drop a cached guild so the next message re-reads the prefix from Postgres. */
  invalidate(guildUuid: string): void {
    for (const [fluxerId, entry] of this.byFluxerId) {
      if (entry.uuid === guildUuid) this.byFluxerId.delete(fluxerId);
    }
  }

  get(guildId: string): GuildEntry | undefined {
    return this.byFluxerId.get(guildId);
  }

  async ensure(guild: { id: string; name: string; icon?: string | null }): Promise<GuildEntry> {
    const cached = this.byFluxerId.get(guild.id);
    if (cached) return cached;

    const existing = await getGuildByFluxerId(this.db, this.instanceId, guild.id);
    if (existing) {
      const entry = { uuid: existing.id, prefix: existing.prefix };
      this.byFluxerId.set(guild.id, entry);
      return entry;
    }

    const row = await ensureGuild(this.db, this.instanceId, {
      guildId: guild.id,
      name: guild.name,
      icon: guild.icon ?? null,
      botPresent: true,
    });
    const entry = { uuid: row.id, prefix: row.prefix };
    this.byFluxerId.set(guild.id, entry);
    this.logger.info('Joined guild', { guildId: guild.id, name: guild.name });
    return entry;
  }

  async markLeft(guildId: string): Promise<void> {
    this.byFluxerId.delete(guildId);
    await setGuildBotPresent(this.db, this.instanceId, guildId, false);
  }

  async setPrefix(guildId: string, prefix: string): Promise<void> {
    const entry = this.byFluxerId.get(guildId);
    if (!entry) return;
    entry.prefix = prefix;
  }
}
