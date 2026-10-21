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
  category: 'core' | 'levels' | 'fun' | 'roles' | 'moderation';
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
];

export interface CatalogModule {
  id: 'core' | 'levels' | 'fun' | 'roles';
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
    id: 'core',
    name: 'Core',
    description: 'Help, ping, about and the command prefix.',
    configurable: false,
  },
];
