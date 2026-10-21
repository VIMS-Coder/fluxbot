import { describe, expect, it } from 'vitest';
import { commandCatalog } from './catalog';
import { allCommands } from './index';
import { levelFromXp, totalXpForLevel, xpForLevel } from './levels';

describe('XP curve', () => {
  const curve = { curveBase: 100, curveFactor: 25 };

  it('starts at the configured base', () => {
    expect(xpForLevel(0, curve)).toBe(100);
    expect(xpForLevel(1, curve)).toBe(125);
    expect(xpForLevel(2, curve)).toBe(200);
  });

  it('is monotonically increasing', () => {
    let previous = 0;
    for (let level = 0; level < 100; level += 1) {
      const total = totalXpForLevel(level, curve);
      expect(total).toBeGreaterThanOrEqual(previous);
      previous = total;
    }
  });

  it('inverts total XP into a level', () => {
    const total = totalXpForLevel(10, curve);
    const progress = levelFromXp(total, curve);
    expect(progress.level).toBe(10);
    expect(progress.current).toBe(0);

    const oneLess = levelFromXp(total - 1, curve);
    expect(oneLess.level).toBe(9);
  });

  it('reports progress inside the current level', () => {
    const total = totalXpForLevel(5, curve) + 42;
    const progress = levelFromXp(total, curve);
    expect(progress.level).toBe(5);
    expect(progress.current).toBe(42);
    expect(progress.needed).toBe(xpForLevel(5, curve));
  });

  it('caps at the maximum level', () => {
    expect(levelFromXp(1_000_000_000_000, curve).level).toBe(500);
  });

  it('handles zero and negative input', () => {
    expect(levelFromXp(0, curve)).toEqual({ level: 0, current: 0, needed: 100 });
    expect(levelFromXp(-50, curve).level).toBe(0);
  });
});

describe('command catalog', () => {
  it('documents every real command', () => {
    const realNames = allCommands.map((command) => command.name).sort();
    const catalogNames = commandCatalog.map((command) => command.name).sort();
    expect(catalogNames).toEqual(realNames);
  });

  it('matches command metadata', () => {
    for (const entry of commandCatalog) {
      const command = allCommands.find((candidate) => candidate.name === entry.name);
      expect(command, `missing command ${entry.name}`).toBeDefined();
      if (!command) continue;

      expect(entry.description).toBe(command.description);
      expect(entry.usage).toBe(command.usage ?? command.name);
      expect(entry.category).toBe(command.category);
      expect(entry.module).toBe(command.module);
      expect(entry.guildOnly).toBe(command.guildOnly ?? false);
      expect([...entry.aliases].sort()).toEqual([...(command.aliases ?? [])].sort());
      expect([...entry.userPermissions].sort()).toEqual(
        [...(command.permissions?.user ?? [])].sort(),
      );
    }
  });

  it('has unique command names and aliases', () => {
    const seen = new Set<string>();
    for (const command of allCommands) {
      for (const name of [command.name, ...(command.aliases ?? [])]) {
        expect(seen.has(name), `duplicate command or alias: ${name}`).toBe(false);
        seen.add(name);
      }
    }
  });

  it('gives every command a usage string that starts with its name', () => {
    for (const command of commandCatalog) {
      expect(command.usage.startsWith(command.name)).toBe(true);
    }
  });
});
