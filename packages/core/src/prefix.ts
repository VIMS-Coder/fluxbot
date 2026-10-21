export interface PrefixCommandMatch {
  name: string;
  rawArgs: string;
  /** The literal prefix used, or a mention for `@bot`. */
  prefix: string;
}

/**
 * Resolve a message into a command invocation.
 *
 * Supports an explicit prefix list (longest first) and mentioning the bot.
 * Returns null for messages that are not commands, which is the hot path on
 * every visible message — keep it allocation-light.
 */
export function parsePrefixCommand(
  content: string,
  prefixes: readonly string[],
  botId: string,
): PrefixCommandMatch | null {
  if (!content) return null;

  const mentionPatterns = [`<@${botId}>`, `<@!${botId}>`];
  for (const mention of mentionPatterns) {
    if (content.startsWith(mention)) {
      const rest = content.slice(mention.length).trim();
      if (!rest) return null;
      return splitName(rest, mention);
    }
  }

  const sorted = [...prefixes].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (content.startsWith(prefix)) {
      const rest = content.slice(prefix.length).trim();
      if (!rest) return null;
      const match = splitName(rest, prefix);
      if (!match) return null;
      return match;
    }
  }

  return null;
}

function splitName(rest: string, prefix: string): PrefixCommandMatch | null {
  const spaceIndex = rest.search(/\s/);
  if (spaceIndex === -1) {
    return { name: rest.toLowerCase(), rawArgs: '', prefix };
  }
  return {
    name: rest.slice(0, spaceIndex).toLowerCase(),
    rawArgs: rest.slice(spaceIndex + 1).trim(),
    prefix,
  };
}

/** Normalise a Fluxer emoji payload to the string stored for reaction roles. */
export function normalizeReactionEmoji(emoji: {
  id?: string | null;
  name: string | null;
}): string | null {
  if (emoji.id) return `${emoji.name ?? 'emoji'}:${emoji.id}`;
  return emoji.name ?? null;
}
