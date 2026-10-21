import { describe, expect, it } from 'vitest';
import { normalizeReactionEmoji, parsePrefixCommand } from './prefix';

describe('parsePrefixCommand', () => {
  it('parses a prefixed command with arguments', () => {
    expect(parsePrefixCommand('!rank @someone', ['!'], '42')).toEqual({
      name: 'rank',
      rawArgs: '@someone',
      prefix: '!',
    });
  });

  it('supports mentioning the bot', () => {
    expect(parsePrefixCommand('<@42> ping', ['!'], '42')).toEqual({
      name: 'ping',
      rawArgs: '',
      prefix: '<@42>',
    });
  });

  it('supports the nickname mention form', () => {
    expect(parsePrefixCommand('<@!42> help', ['!'], '42')?.name).toBe('help');
  });

  it('prefers the longest matching prefix', () => {
    expect(parsePrefixCommand('??rank', ['?', '??'], '42')?.prefix).toBe('??');
  });

  it('lowercases command names', () => {
    expect(parsePrefixCommand('!RANK', ['!'], '42')?.name).toBe('rank');
  });

  it('ignores plain chat', () => {
    expect(parsePrefixCommand('hello there', ['!'], '42')).toBeNull();
    expect(parsePrefixCommand('', ['!'], '42')).toBeNull();
    expect(parsePrefixCommand('!', ['!'], '42')).toBeNull();
  });

  it('does not treat other mentions as the prefix', () => {
    expect(parsePrefixCommand('<@99> ping', ['!'], '42')).toBeNull();
  });
});

describe('normalizeReactionEmoji', () => {
  it('keeps unicode emoji as-is', () => {
    expect(normalizeReactionEmoji({ name: '🔥' })).toBe('🔥');
  });

  it('stores custom emoji as name:id', () => {
    expect(normalizeReactionEmoji({ id: '123', name: 'party' })).toBe('party:123');
  });

  it('returns null for an empty payload', () => {
    expect(normalizeReactionEmoji({ name: null })).toBeNull();
  });
});
