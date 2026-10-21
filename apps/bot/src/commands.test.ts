import { Permission } from '@fluxbot/fluxer';
import { allCommands } from '@fluxbot/modules';
import { describe, expect, it } from 'vitest';
import { CommandIndex, permissionLevelAllows } from './commands';

describe('CommandIndex', () => {
  const index = new CommandIndex(allCommands);

  it('resolves commands by name', () => {
    expect(index.get('rank')?.name).toBe('rank');
  });

  it('resolves aliases', () => {
    expect(index.get('lb')?.name).toBe('leaderboard');
    expect(index.get('8ball')?.name).toBe('8ball');
  });

  it('returns undefined for unknown commands', () => {
    expect(index.get('definitely-not-a-command')).toBeUndefined();
  });

  it('deduplicates commands in getAll', () => {
    const names = index.getAll().map((command) => command.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(allCommands.length);
  });
});

describe('permissionLevelAllows', () => {
  it('lets everyone use default commands', () => {
    expect(permissionLevelAllows('default', 0n)).toBe(true);
  });

  it('locks admin commands to Manage Server or Administrator', () => {
    expect(permissionLevelAllows('admin', Permission.MANAGE_GUILD)).toBe(true);
    expect(permissionLevelAllows('admin', Permission.ADMINISTRATOR)).toBe(true);
    expect(permissionLevelAllows('admin', Permission.SEND_MESSAGES)).toBe(false);
  });

  it('accepts any moderation capability for moderator commands', () => {
    expect(permissionLevelAllows('moderator', Permission.MODERATE_MEMBERS)).toBe(true);
    expect(permissionLevelAllows('moderator', Permission.MANAGE_MESSAGES)).toBe(true);
    expect(permissionLevelAllows('moderator', Permission.SEND_MESSAGES)).toBe(false);
  });

  it('rejects unknown levels', () => {
    expect(permissionLevelAllows('nonsense', 0n)).toBe(true);
  });
});
