/**
 * In-memory cooldown table.
 *
 * The bot is a single process by default. At scale this is replaced by a Redis
 * implementation with the same interface; commands never see the difference.
 */
export class CooldownStore {
  private readonly entries = new Map<string, number>();
  private lastPrune = Date.now();

  /** Remaining milliseconds for a key, or 0 when ready. */
  remaining(key: string, now = Date.now()): number {
    this.maybePrune(now);
    const expiresAt = this.entries.get(key);
    if (!expiresAt) return 0;
    return Math.max(0, expiresAt - now);
  }

  set(key: string, durationMs: number, now = Date.now()): void {
    this.entries.set(key, now + durationMs);
  }

  clear(key: string): void {
    this.entries.delete(key);
  }

  get size(): number {
    return this.entries.size;
  }

  private maybePrune(now: number): void {
    if (now - this.lastPrune < 60_000) return;
    this.lastPrune = now;
    for (const [key, expiresAt] of this.entries) {
      if (expiresAt <= now) this.entries.delete(key);
    }
  }
}

export function cooldownKey(guildId: string | null, userId: string, command: string): string {
  return `${guildId ?? 'dm'}:${userId}:${command}`;
}
