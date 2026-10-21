import { describe, expect, it } from 'vitest';
import { CooldownStore, cooldownKey } from './cooldown';

describe('CooldownStore', () => {
  it('reports the remaining time and expires', () => {
    const store = new CooldownStore();
    store.set('k', 1000, 0);
    expect(store.remaining('k', 0)).toBe(1000);
    expect(store.remaining('k', 500)).toBe(500);
    expect(store.remaining('k', 1000)).toBe(0);
  });

  it('scopes keys per guild and user', () => {
    expect(cooldownKey('g1', 'u1', 'rank')).not.toBe(cooldownKey('g2', 'u1', 'rank'));
    expect(cooldownKey(null, 'u1', 'rank')).toContain('dm');
  });

  it('clears a key', () => {
    const store = new CooldownStore();
    store.set('k', 1000);
    store.clear('k');
    expect(store.remaining('k')).toBe(0);
  });
});
