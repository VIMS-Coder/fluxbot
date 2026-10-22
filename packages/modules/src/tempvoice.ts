import { tempVoiceConfigSchema } from './config';

/**
 * Build a channel name from the configured template.
 * Newlines and control characters are stripped so a nickname cannot break the layout,
 * and the result is capped at Fluxer's 100-character channel limit.
 */
export function renderVoiceName(template: string, displayName: string): string {
  const safe = displayName
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const name = template.replaceAll('{name}', safe || 'Voice');
  return name.slice(0, 100) || 'Voice';
}

export const tempVoiceConfig = {
  schema: tempVoiceConfigSchema,
  parse(raw: Record<string, unknown> | null): Record<string, unknown> {
    return tempVoiceConfigSchema.parse(raw ?? {}) as unknown as Record<string, unknown>;
  },
};
