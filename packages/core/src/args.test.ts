import { describe, expect, it } from 'vitest';
import { arg, formatDuration, parseArgs, parseDuration, tokenize } from './args';

const resolvers = {
  resolveMember: async (token: string) => (token === '1' ? { id: '1', displayName: 'Ada' } : null),
  resolveRole: async (token: string) => (token === '2' ? { id: '2', name: 'Mod' } : null),
};

describe('tokenize', () => {
  it('splits on whitespace', () => {
    expect(tokenize('a b   c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps quoted segments together', () => {
    expect(tokenize('say "hello world" now')).toEqual(['say', 'hello world', 'now']);
  });

  it('returns an empty list for blank input', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('parseDuration', () => {
  it('parses bare seconds', () => {
    expect(parseDuration('30')).toBe(30);
  });

  it('parses compound units', () => {
    expect(parseDuration('1h30m')).toBe(5400);
    expect(parseDuration('2d')).toBe(172800);
    expect(parseDuration('1w')).toBe(604800);
  });

  it('rejects nonsense', () => {
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('0')).toBeNull();
    expect(parseDuration('1h30')).toBeNull();
  });

  it('formats back to a compact string', () => {
    expect(formatDuration(5400)).toBe('1h 30m');
    expect(formatDuration(0)).toBe('0s');
  });
});

describe('parseArgs', () => {
  it('resolves members and rest arguments', async () => {
    const result = await parseArgs(
      { user: arg.member(), reason: arg.rest({ optional: true }) },
      '<@1> being too cool',
      resolvers,
    );
    expect(result).toEqual({
      ok: true,
      values: { user: { id: '1', displayName: 'Ada' }, reason: 'being too cool' },
    });
  });

  it('resolves roles', async () => {
    const result = await parseArgs({ role: arg.role() }, '<@&2>', resolvers);
    expect(result.ok).toBe(true);
    if (result.ok) expect((result.values.role as { name: string }).name).toBe('Mod');
  });

  it('enforces integer bounds', async () => {
    const schema = { count: arg.integer({ min: 1, max: 100 }) };
    const tooBig = await parseArgs(schema, '500', resolvers);
    expect(tooBig.ok).toBe(false);
    const ok = await parseArgs(schema, '42', resolvers);
    expect(ok).toEqual({ ok: true, values: { count: 42 } });
  });

  it('validates choices case-insensitively', async () => {
    const schema = { page: arg.choices(['one', 'two'] as const) };
    const result = await parseArgs(schema, 'TWO', resolvers);
    expect(result).toEqual({ ok: true, values: { page: 'two' } });
  });

  it('reports a missing required argument', async () => {
    const result = await parseArgs({ user: arg.member() }, '', resolvers);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Missing argument/);
  });

  it('rejects trailing junk', async () => {
    const result = await parseArgs({ user: arg.member() }, '<@1> extra', resolvers);
    expect(result.ok).toBe(false);
  });

  it('uses defaults when an argument is absent', async () => {
    const result = await parseArgs(
      { page: arg.integer({ optional: true, defaultValue: 1 }) },
      '',
      resolvers,
    );
    expect(result).toEqual({ ok: true, values: { page: 1 } });
  });
});
