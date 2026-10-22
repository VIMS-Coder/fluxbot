import type { ModuleDefinition } from '@fluxbot/core';
import { coreCommands, coreConfig } from './core';
import { funCommands, funConfig } from './fun';
import { giveawayCommands, giveawaysConfig } from './giveaways';
import { levelsCommands, levelsConfig } from './levels';
import { rolesCommands, rolesConfig } from './roles';
import { tempVoiceConfig } from './tempvoice';
import { ticketCommands, ticketsConfig } from './tickets';
import { welcomeCommands, welcomeConfig } from './welcome';

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
  {
    id: 'welcome',
    name: 'Welcome',
    description: 'Join and leave messages with variables and a live preview.',
    commands: welcomeCommands,
    getConfig: welcomeConfig.parse,
    requiredBotPermissions: ['SEND_MESSAGES', 'EMBED_LINKS'],
  },
  {
    id: 'giveaways',
    name: 'Giveaways',
    description: 'Reaction-entry giveaways with timed draws and winner announcements.',
    commands: giveawayCommands,
    getConfig: giveawaysConfig.parse,
    requiredBotPermissions: [
      'SEND_MESSAGES',
      'EMBED_LINKS',
      'ADD_REACTIONS',
      'READ_MESSAGE_HISTORY',
    ],
  },
  {
    id: 'tickets',
    name: 'Tickets',
    description: 'Private-thread support tickets with staff roles and close commands.',
    commands: ticketCommands,
    getConfig: ticketsConfig.parse,
    requiredBotPermissions: [
      'CREATE_PRIVATE_THREADS',
      'SEND_MESSAGES_IN_THREADS',
      'MANAGE_THREADS',
      'READ_MESSAGE_HISTORY',
    ],
  },
  {
    id: 'tempvoice',
    name: 'Temp voice',
    description: 'Join-to-create voice channels that disappear when everyone leaves.',
    commands: [],
    getConfig: tempVoiceConfig.parse,
    requiredBotPermissions: ['MANAGE_CHANNELS', 'MOVE_MEMBERS', 'CONNECT'],
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
export type { GiveawayReactionEvent } from './giveaways';
export {
  finishGiveaway,
  giveawayCommands,
  giveawayEmbed,
  onGiveawayReaction,
  pickWinners,
} from './giveaways';
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
export { renderVoiceName } from './tempvoice';
export { ticketCommands } from './tickets';
export { previewWelcome, renderWelcome, welcomeCommands } from './welcome';
