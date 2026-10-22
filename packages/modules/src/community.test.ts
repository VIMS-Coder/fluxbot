import { describe, expect, it } from 'vitest';
import { pickWinners, previewWelcome, renderVoiceName, renderWelcome } from './index';

describe('welcome templates', () => {
  it('replaces every variable', () => {
    expect(
      renderWelcome('Hi {mention} ({name}) — welcome to {server}, member #{count}!', {
        mention: '<@1>',
        name: 'Ada',
        server: 'Design Guild',
        count: 42,
      }),
    ).toBe('Hi <@1> (Ada) — welcome to Design Guild, member #42!');
  });

  it('leaves unknown placeholders visible', () => {
    expect(
      renderWelcome('Hello {name}, {unknown}', {
        mention: '<@1>',
        name: 'Ada',
        server: 'S',
        count: 1,
      }),
    ).toBe('Hello Ada, {unknown}');
  });

  it('caps the output at 2000 characters', () => {
    const rendered = renderWelcome('x'.repeat(3000), {
      mention: '<@1>',
      name: 'Ada',
      server: 'S',
      count: 1,
    });
    expect(rendered).toHaveLength(2000);
  });

  it('renders a sample for the dashboard preview', () => {
    expect(previewWelcome('Welcome {name} to {server}')).toBe('Welcome new-member to Your Server');
  });
});

describe('giveaway winners', () => {
  it('picks the requested number without duplicates', () => {
    const winners = pickWinners(['a', 'b', 'c', 'd', 'e'], 3);
    expect(winners).toHaveLength(3);
    expect(new Set(winners).size).toBe(3);
    for (const winner of winners) expect(['a', 'b', 'c', 'd', 'e']).toContain(winner);
  });

  it('never returns more winners than entries', () => {
    expect(pickWinners(['a', 'b'], 10)).toHaveLength(2);
  });

  it('returns an empty list when nobody entered', () => {
    expect(pickWinners([], 1)).toEqual([]);
  });

  it('clamps the count to at least one', () => {
    expect(pickWinners(['a', 'b'], 0)).toHaveLength(1);
  });
});

describe('temporary voice names', () => {
  it('substitutes the member name', () => {
    expect(renderVoiceName('🔊 {name}', 'Ada Lovelace')).toBe('🔊 Ada Lovelace');
  });

  it('strips newlines and control whitespace', () => {
    expect(renderVoiceName('Voice: {name}', 'Ada\n\tLovelace')).toBe('Voice: Ada Lovelace');
  });

  it('caps the name at 100 characters', () => {
    expect(renderVoiceName('{name}', 'x'.repeat(200))).toHaveLength(100);
  });

  it('falls back when the name is empty', () => {
    expect(renderVoiceName('{name}', '   ')).toBe('Voice');
  });
});
