import type { z } from 'zod';

/**
 * Validate a stored module config, falling back to defaults when the row is
 * missing or was written by an older version of the schema.
 */
export function parseModuleConfig<T>(
  schema: z.ZodType<T>,
  raw: Record<string, unknown> | null | undefined,
): T {
  const result = schema.safeParse(raw ?? {});
  if (result.success) return result.data;

  const fallback = schema.safeParse({});
  if (fallback.success) return fallback.data;

  throw new Error(
    `Invalid module config and no usable defaults: ${result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')}`,
  );
}

/** Merge a partial update into an existing config and validate the result. */
export function updateModuleConfig<T>(
  schema: z.ZodType<T>,
  current: T,
  patch: Partial<Record<string, unknown>>,
): T {
  return schema.parse({ ...(current as Record<string, unknown>), ...patch });
}

export function isEnabled(config: unknown): boolean {
  if (typeof config !== 'object' || config === null) return false;
  return (config as { enabled?: unknown }).enabled === true;
}
