import type { ModuleDefinition } from '@fluxbot/core';
import { coreCommands, coreConfig } from './core';
import { funCommands, funConfig } from './fun';
import { levelsCommands, levelsConfig } from './levels';
import { rolesCommands, rolesConfig } from './roles';

export const modules: ModuleDefinition[] = [
  {
    id: 'core',
    name: 'Core',
    description: 'Help, ping, about and the command prefix.',
    commands: coreCommands,
    getConfig: coreConfig.parse,
  },
  {
    id: 'levels',
    name: 'Levels',
    description: 'XP for chatting, rank cards, leaderboards and role rewards.',
    commands: levelsCommands,
    getConfig: levelsConfig.parse,
    requiredBotPermissions: ['SEND_MESSAGES', 'EMBED_LINKS', 'MANAGE_ROLES'],
  },
  {
    id: 'fun',
    name: 'Fun',
    description: 'Dice, coinflips, the 8-ball, random picks and compatibility.',
    commands: funCommands,
    getConfig: funConfig.parse,
    requiredBotPermissions: ['SEND_MESSAGES', 'EMBED_LINKS'],
  },
  {
    id: 'roles',
    name: 'Roles',
    description: 'Reaction roles, join auto-roles and self-assignable role menus.',
    commands: rolesCommands,
    getConfig: rolesConfig.parse,
    requiredBotPermissions: ['MANAGE_ROLES', 'ADD_REACTIONS', 'READ_MESSAGE_HISTORY'],
  },
];

export const allCommands = modules.flatMap((module) => module.commands);

export function getModuleConfig(moduleId: string, raw: Record<string, unknown> | null) {
  const module = modules.find((candidate) => candidate.id === moduleId);
  if (!module) return raw ?? {};
  return module.getConfig ? module.getConfig(raw) : (raw ?? {});
}

export * from './catalog';
export * from './config';
export { coreCommands } from './core';
export { funCommands } from './fun';
export {
  LEVELS_MODULE,
  levelFromXp,
  levelsCommands,
  onLevelsMessage,
  totalXpForLevel,
  xpForLevel,
} from './levels';
export type { ReactionEvent } from './roles';
export { onRolesMemberAdd, onRolesReaction, rolesCommands } from './roles';
