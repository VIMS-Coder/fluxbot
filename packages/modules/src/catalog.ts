/**
 * Pure command metadata for the dashboard.
 *
 * This module must not import the database or the bot SDK: the web app renders
 * it on the commands page. `catalog.test.ts` asserts it stays in sync with the
 * real command definitions.
 */
export interface CatalogCommand {
  name: string;
  aliases: string[];
  description: string;
  usage: string;
  category: 'core' | 'levels' | 'fun' | 'roles' | 'community' | 'moderation';
  module: string;
  guildOnly: boolean;
  userPermissions: string[];
}

export const commandCatalog: CatalogCommand[] = [
  {
    name: 'help',
    aliases: ['commands', 'h'],
    description: 'List every command, or explain one',
    usage: 'help [command]',
    category: 'core',
    module: 'core',
    guildOnly: false,
    userPermissions: [],
  },
  {
    name: 'ping',
    aliases: [],
    description: 'Check that the bot is alive',
    usage: 'ping',
    category: 'core',
    module: 'core',
    guildOnly: false,
    userPermissions: [],
  },
  {
    name: 'about',
    aliases: ['info'],
    description: 'About Fluxbot',
    usage: 'about',
    category: 'core',
    module: 'core',
    guildOnly: false,
    userPermissions: [],
  },
  {
    name: 'prefix',
    aliases: [],
    description: 'Show or change the command prefix',
    usage: 'prefix [new prefix]',
    category: 'core',
    module: 'core',
    guildOnly: true,
    userPermissions: ['MANAGE_GUILD'],
  },
  {
    name: 'rank',
    aliases: ['level'],
    description: 'Show your level and XP progress',
    usage: 'rank [user]',
    category: 'levels',
    module: 'levels',
    guildOnly: true,
    userPermissions: [],
  },
  {
    name: 'leaderboard',
    aliases: ['lb', 'top'],
    description: 'Show the server XP leaderboard',
    usage: 'leaderboard [page]',
    category: 'levels',
    module: 'levels',
    guildOnly: true,
    userPermissions: [],
  },
  {
    name: 'rewards',
    aliases: [],
    description: 'List roles awarded at specific levels',
    usage: 'rewards',
    category: 'levels',
    module: 'levels',
    guildOnly: true,
    userPermissions: [],
  },
  {
    name: 'xp',
    aliases: [],
    description: 'Configure the levels module',
    usage: 'xp <status|enable|disable|rate|cooldown|announce|reward|unreward> [...]',
    category: 'levels',
    module: 'levels',
    guildOnly: true,
    userPermissions: ['MANAGE_GUILD'],
  },
  {
    name: 'dice',
    aliases: ['roll'],
    description: 'Roll dice using NdM notation',
    usage: 'dice [NdM]',
    category: 'fun',
    module: 'fun',
    guildOnly: false,
    userPermissions: [],
  },
  {
    name: 'coinflip',
    aliases: ['flip', 'coin'],
    description: 'Flip a coin',
    usage: 'coinflip',
    category: 'fun',
    module: 'fun',
    guildOnly: false,
    userPermissions: [],
  },
  {
    name: '8ball',
    aliases: ['eightball'],
    description: 'Ask the magic 8-ball a question',
    usage: '8ball <question>',
    category: 'fun',
    module: 'fun',
    guildOnly: false,
    userPermissions: [],
  },
  {
    name: 'choose',
    aliases: ['pick'],
    description: 'Pick one option at random',
    usage: 'choose option A | option B | option C',
    category: 'fun',
    module: 'fun',
    guildOnly: false,
    userPermissions: [],
  },
  {
    name: 'ship',
    aliases: ['love'],
    description: 'Compute the compatibility between two people',
    usage: 'ship [user] [user]',
    category: 'fun',
    module: 'fun',
    guildOnly: false,
    userPermissions: [],
  },
  {
    name: 'roles',
    aliases: [],
    description: 'List the roles you can assign yourself',
    usage: 'roles',
    category: 'roles',
    module: 'roles',
    guildOnly: true,
    userPermissions: [],
  },
  {
    name: 'iam',
    aliases: ['giverole'],
    description: 'Give yourself a self-assignable role',
    usage: 'iam <role>',
    category: 'roles',
    module: 'roles',
    guildOnly: true,
    userPermissions: [],
  },
  {
    name: 'iamnot',
    aliases: ['removerole'],
    description: 'Remove a self-assignable role from yourself',
    usage: 'iamnot <role>',
    category: 'roles',
    module: 'roles',
    guildOnly: true,
    userPermissions: [],
  },
  {
    name: 'welcome',
    aliases: [],
    description: 'Preview the welcome message',
    usage: 'welcome test',
    category: 'community',
    module: 'welcome',
    guildOnly: true,
    userPermissions: ['MANAGE_GUILD'],
  },
  {
    name: 'giveaway',
    aliases: ['gw'],
    description: 'Start, end or list giveaways',
    usage: 'giveaway <start|end|list> [...]',
    category: 'community',
    module: 'giveaways',
    guildOnly: true,
    userPermissions: ['MANAGE_GUILD'],
  },
  {
    name: 'ticket',
    aliases: [],
    description: 'Open, close or add someone to a support ticket',
    usage: 'ticket [open|close|add <user>]',
    category: 'community',
    module: 'tickets',
    guildOnly: true,
    userPermissions: [],
  },
];

export interface CatalogModule {
  id: 'core' | 'levels' | 'fun' | 'roles' | 'welcome' | 'giveaways' | 'tickets' | 'tempvoice';
  name: string;
  description: string;
  /** Whether the module appears in the dashboard module grid. */
  configurable: boolean;
}

export const moduleCatalog: CatalogModule[] = [
  {
    id: 'levels',
    name: 'Levels',
    description: 'XP for chatting, rank cards, leaderboards and role rewards.',
    configurable: true,
  },
  {
    id: 'fun',
    name: 'Fun',
    description: 'Dice, coinflips, the 8-ball, random picks and compatibility.',
    configurable: true,
  },
  {
    id: 'roles',
    name: 'Roles',
    description: 'Reaction roles, join auto-roles and self-assignable role menus.',
    configurable: true,
  },
  {
    id: 'welcome',
    name: 'Welcome',
    description: 'Join and leave messages with variables and a live preview.',
    configurable: true,
  },
  {
    id: 'giveaways',
    name: 'Giveaways',
    description: 'Reaction-entry giveaways with timed draws and winner announcements.',
    configurable: true,
  },
  {
    id: 'tickets',
    name: 'Tickets',
    description: 'Private-thread support tickets with staff roles.',
    configurable: true,
  },
  {
    id: 'tempvoice',
    name: 'Temp voice',
    description: 'Join-to-create voice channels that disappear when empty.',
    configurable: true,
  },
  {
    id: 'core',
    name: 'Core',
    description: 'Help, ping, about and the command prefix.',
    configurable: false,
  },
];
