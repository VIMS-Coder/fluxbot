import { z } from 'zod';

export const levelsConfigSchema = z.object({
  enabled: z.boolean().default(true),
  minXp: z.number().int().min(1).max(1000).default(15),
  maxXp: z.number().int().min(1).max(1000).default(25),
  cooldownSeconds: z.number().int().min(0).max(86_400).default(60),
  announceLevelUp: z.boolean().default(true),
  announceChannelId: z.string().max(32).nullable().default(null),
  curveBase: z.number().int().min(10).max(10_000).default(100),
  curveFactor: z.number().int().min(0).max(1_000).default(25),
  ignoredChannels: z.array(z.string().max(32)).max(100).default([]),
  ignoredRoles: z.array(z.string().max(32)).max(100).default([]),
  ignoreCommands: z.boolean().default(true),
});

export type LevelsConfig = z.infer<typeof levelsConfigSchema>;

export const funConfigSchema = z.object({
  enabled: z.boolean().default(true),
  cooldownSeconds: z.number().int().min(0).max(3600).default(3),
  dice: z.boolean().default(true),
  coinflip: z.boolean().default(true),
  eightball: z.boolean().default(true),
  choose: z.boolean().default(true),
  ship: z.boolean().default(true),
});

export type FunConfig = z.infer<typeof funConfigSchema>;

export const rolesConfigSchema = z.object({
  enabled: z.boolean().default(true),
  allowSelfRoles: z.boolean().default(true),
  autoRolesOnJoin: z.boolean().default(true),
  reactionRolesEnabled: z.boolean().default(true),
});

export type RolesConfig = z.infer<typeof rolesConfigSchema>;

export const coreConfigSchema = z.object({
  enabled: z.boolean().default(true),
});

export type CoreConfig = z.infer<typeof coreConfigSchema>;

export const moduleSchemas = {
  levels: levelsConfigSchema,
  fun: funConfigSchema,
  roles: rolesConfigSchema,
  core: coreConfigSchema,
} as const;

export type ModuleId = keyof typeof moduleSchemas;

export function defaultsFor(module: ModuleId): Record<string, unknown> {
  return moduleSchemas[module].parse({}) as Record<string, unknown>;
}
