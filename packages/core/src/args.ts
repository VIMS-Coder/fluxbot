import type { ArgSchema, ArgSpec } from './types';

function spec(kind: ArgSpec['kind'], options: Partial<ArgSpec> = {}): ArgSpec {
  return { kind, ...options };
}

export const arg = {
  string: (options: { optional?: boolean; defaultValue?: unknown } = {}) => spec('string', options),
  integer: (
    options: { optional?: boolean; min?: number; max?: number; defaultValue?: number } = {},
  ) => spec('integer', options),
  member: (options: { optional?: boolean } = {}) => spec('member', options),
  role: (options: { optional?: boolean } = {}) => spec('role', options),
  duration: (options: { optional?: boolean } = {}) => spec('duration', options),
  choices: <T extends readonly string[]>(values: T, options: { optional?: boolean } = {}) =>
    spec('choices', { ...options, choices: values }),
  rest: (options: { optional?: boolean } = {}) => spec('rest', options),
};

/** Tokenize on whitespace, keeping quoted segments together. */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let hasContent = false;

  for (const char of input.trim()) {
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      hasContent = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (hasContent) {
        tokens.push(current);
        current = '';
        hasContent = false;
      }
      continue;
    }
    current += char;
    hasContent = true;
  }

  if (hasContent) tokens.push(current);
  return tokens;
}

const DURATION_UNITS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 3600,
  d: 86400,
  w: 604800,
};

/** Parse `30`, `30s`, `10m`, `1h30m`, `2d` into seconds. */
export function parseDuration(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    return seconds > 0 ? seconds : null;
  }

  const pattern = /(\d+)\s*(s|m|h|d|w)/g;
  let total = 0;
  let consumed = 0;
  let match = pattern.exec(trimmed);

  while (match !== null) {
    const amount = Number.parseInt(match[1] ?? '0', 10);
    const unit = DURATION_UNITS[match[2] ?? ''];
    if (!unit) return null;
    total += amount * unit;
    consumed += match[0].length;
    match = pattern.exec(trimmed);
  }

  if (consumed !== trimmed.replace(/\s+/g, '').length) return null;
  return total > 0 ? total : null;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0s';
  const parts: string[] = [];
  let remaining = Math.floor(seconds);
  const units: Array<[string, number]> = [
    ['w', 604800],
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
    ['s', 1],
  ];
  for (const [label, size] of units) {
    const value = Math.floor(remaining / size);
    if (value > 0) {
      parts.push(`${value}${label}`);
      remaining -= value * size;
    }
  }
  return parts.join(' ');
}

const MENTION_USER = /^<@!?(\d+)>$/;
const MENTION_ROLE = /^<@&(\d+)>$/;

export interface ParseResult {
  ok: true;
  values: Record<string, unknown>;
}

export interface ParseFailure {
  ok: false;
  error: string;
}

/**
 * Parse positional arguments. `rest` consumes everything that remains, so it
 * must be the last entry in the schema (enforced below).
 */
export async function parseArgs(
  schema: ArgSchema,
  raw: string,
  resolvers: {
    resolveMember(token: string): Promise<{ id: string; displayName?: string } | null>;
    resolveRole(token: string): Promise<{ id: string; name: string } | null>;
  },
): Promise<ParseResult | ParseFailure> {
  const entries = Object.entries(schema);
  const tokens = tokenize(raw);
  const values: Record<string, unknown> = {};
  let index = 0;

  for (let position = 0; position < entries.length; position += 1) {
    const [name, definition] = entries[position]!;

    if (definition.kind === 'rest') {
      if (position !== entries.length - 1) {
        return { ok: false, error: 'Internal error: rest argument must be last' };
      }
      values[name] = tokens.slice(index).join(' ').trim();
      index = tokens.length;
      continue;
    }

    const token = tokens[index];

    if (token === undefined) {
      if (definition.defaultValue !== undefined) {
        values[name] = definition.defaultValue;
        continue;
      }
      if (definition.optional) {
        values[name] = undefined;
        continue;
      }
      return { ok: false, error: `Missing argument \`${name}\`` };
    }

    switch (definition.kind) {
      case 'member': {
        const id = MENTION_USER.exec(token)?.[1] ?? token;
        const member = await resolvers.resolveMember(id);
        if (!member) return { ok: false, error: `Could not find member \`${token}\`` };
        values[name] = member;
        index += 1;
        break;
      }
      case 'role': {
        const id = MENTION_ROLE.exec(token)?.[1] ?? token;
        const role = await resolvers.resolveRole(id);
        if (!role) return { ok: false, error: `Could not find role \`${token}\`` };
        values[name] = role;
        index += 1;
        break;
      }
      case 'duration': {
        const seconds = parseDuration(token);
        if (seconds === null) return { ok: false, error: `Invalid duration \`${token}\`` };
        values[name] = seconds;
        index += 1;
        break;
      }
      case 'integer': {
        if (!/^-?\d+$/.test(token)) {
          return { ok: false, error: `\`${name}\` must be a number` };
        }
        const value = Number.parseInt(token, 10);
        if (definition.min !== undefined && value < definition.min) {
          return { ok: false, error: `\`${name}\` must be at least ${definition.min}` };
        }
        if (definition.max !== undefined && value > definition.max) {
          return { ok: false, error: `\`${name}\` must be at most ${definition.max}` };
        }
        values[name] = value;
        index += 1;
        break;
      }
      case 'choices': {
        const choices = definition.choices ?? [];
        const match = choices.find((choice) => choice.toLowerCase() === token.toLowerCase());
        if (!match) {
          return {
            ok: false,
            error: `\`${name}\` must be one of: ${choices.join(', ')}`,
          };
        }
        values[name] = match;
        index += 1;
        break;
      }
      case 'string': {
        values[name] = token;
        index += 1;
        break;
      }
    }
  }

  if (index < tokens.length) {
    return { ok: false, error: 'Too many arguments' };
  }

  return { ok: true, values };
}
