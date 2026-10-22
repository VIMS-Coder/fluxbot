/**
 * Fluxer permission bits, mirrored from the official documentation so the
 * dashboard can reason about access without importing the bot SDK.
 */
export const Permission = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_AUDIT_LOG: 1n << 7n,
  PRIORITY_SPEAKER: 1n << 8n,
  STREAM: 1n << 9n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  SEND_TTS_MESSAGES: 1n << 12n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  MENTION_EVERYONE: 1n << 17n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MUTE_MEMBERS: 1n << 22n,
  DEAFEN_MEMBERS: 1n << 23n,
  MOVE_MEMBERS: 1n << 24n,
  USE_VAD: 1n << 25n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  MANAGE_ROLES: 1n << 28n,
  MANAGE_WEBHOOKS: 1n << 29n,
  MANAGE_EXPRESSIONS: 1n << 30n,
  MANAGE_THREADS: 1n << 34n,
  CREATE_PUBLIC_THREADS: 1n << 35n,
  CREATE_PRIVATE_THREADS: 1n << 36n,
  USE_EXTERNAL_STICKERS: 1n << 37n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
  MODERATE_MEMBERS: 1n << 40n,
  CREATE_EXPRESSIONS: 1n << 43n,
  PIN_MESSAGES: 1n << 51n,
  BYPASS_SLOWMODE: 1n << 52n,
  UPDATE_RTC_REGION: 1n << 53n,
  VIEW_CHANNEL_MEMBERS: 1n << 54n,
} as const;

export type PermissionName = keyof typeof Permission;

export const PERMISSION_LIST: ReadonlyArray<{
  name: PermissionName;
  bit: bigint;
  label: string;
}> = [
  { name: 'VIEW_CHANNEL', bit: Permission.VIEW_CHANNEL, label: 'View channels' },
  { name: 'SEND_MESSAGES', bit: Permission.SEND_MESSAGES, label: 'Send messages' },
  { name: 'EMBED_LINKS', bit: Permission.EMBED_LINKS, label: 'Embed links' },
  { name: 'ATTACH_FILES', bit: Permission.ATTACH_FILES, label: 'Attach files' },
  {
    name: 'READ_MESSAGE_HISTORY',
    bit: Permission.READ_MESSAGE_HISTORY,
    label: 'Read message history',
  },
  { name: 'ADD_REACTIONS', bit: Permission.ADD_REACTIONS, label: 'Add reactions' },
  {
    name: 'USE_EXTERNAL_EMOJIS',
    bit: Permission.USE_EXTERNAL_EMOJIS,
    label: 'Use external emojis',
  },
  { name: 'MANAGE_MESSAGES', bit: Permission.MANAGE_MESSAGES, label: 'Manage messages' },
  { name: 'MANAGE_ROLES', bit: Permission.MANAGE_ROLES, label: 'Manage roles' },
  { name: 'MANAGE_CHANNELS', bit: Permission.MANAGE_CHANNELS, label: 'Manage channels' },
  { name: 'MANAGE_GUILD', bit: Permission.MANAGE_GUILD, label: 'Manage server' },
  { name: 'VIEW_AUDIT_LOG', bit: Permission.VIEW_AUDIT_LOG, label: 'View audit log' },
  { name: 'KICK_MEMBERS', bit: Permission.KICK_MEMBERS, label: 'Kick members' },
  { name: 'BAN_MEMBERS', bit: Permission.BAN_MEMBERS, label: 'Ban members' },
  { name: 'MODERATE_MEMBERS', bit: Permission.MODERATE_MEMBERS, label: 'Timeout members' },
  { name: 'MANAGE_THREADS', bit: Permission.MANAGE_THREADS, label: 'Manage threads' },
  {
    name: 'CREATE_PUBLIC_THREADS',
    bit: Permission.CREATE_PUBLIC_THREADS,
    label: 'Create public threads',
  },
  {
    name: 'SEND_MESSAGES_IN_THREADS',
    bit: Permission.SEND_MESSAGES_IN_THREADS,
    label: 'Send messages in threads',
  },
  { name: 'PIN_MESSAGES', bit: Permission.PIN_MESSAGES, label: 'Pin messages' },
  { name: 'MENTION_EVERYONE', bit: Permission.MENTION_EVERYONE, label: 'Mention everyone' },
  { name: 'MANAGE_WEBHOOKS', bit: Permission.MANAGE_WEBHOOKS, label: 'Manage webhooks' },
  { name: 'MUTE_MEMBERS', bit: Permission.MUTE_MEMBERS, label: 'Mute members' },
  { name: 'DEAFEN_MEMBERS', bit: Permission.DEAFEN_MEMBERS, label: 'Deafen members' },
  { name: 'MOVE_MEMBERS', bit: Permission.MOVE_MEMBERS, label: 'Move members' },
];

/** Convert a permission mask to a stable decimal string. */
export function formatPermissionMask(bitfield: bigint): string {
  return bitfield.toString();
}

export function parsePermissionMask(value: string | bigint | null | undefined): bigint {
  if (value === null || value === undefined || value === '') return 0n;
  if (typeof value === 'bigint') return value;
  try {
    return BigInt(value);
  } catch {
    return 0n;
  }
}

export function hasPermission(mask: bigint, permission: bigint): boolean {
  if ((mask & Permission.ADMINISTRATOR) !== 0n) return true;
  return (mask & permission) === permission;
}

export function hasAnyPermission(mask: bigint, permissions: readonly bigint[]): boolean {
  if ((mask & Permission.ADMINISTRATOR) !== 0n) return true;
  return permissions.some((permission) => (mask & permission) === permission);
}

/** Dashboard access: server admins only. */
export function canManageGuild(mask: bigint): boolean {
  return hasAnyPermission(mask, [Permission.ADMINISTRATOR, Permission.MANAGE_GUILD]);
}

/** Moderator-level visibility in the dashboard. */
export function canModerateGuild(mask: bigint): boolean {
  return hasAnyPermission(mask, [
    Permission.ADMINISTRATOR,
    Permission.MANAGE_GUILD,
    Permission.MODERATE_MEMBERS,
    Permission.MANAGE_MESSAGES,
    Permission.KICK_MEMBERS,
    Permission.BAN_MEMBERS,
    Permission.VIEW_AUDIT_LOG,
  ]);
}

export function permissionsToNames(mask: bigint): PermissionName[] {
  return PERMISSION_LIST.filter(({ bit }) => (mask & bit) === bit).map(({ name }) => name);
}

export function namesToPermissions(names: readonly PermissionName[]): bigint {
  return names.reduce((mask, name) => mask | Permission[name], 0n);
}

/**
 * Permissions Fluxbot asks for by default.
 *
 * Engagement modules only need to send messages and manage roles; moderation
 * permissions are listed separately so a server can start with the minimum and
 * upgrade when it enables moderation.
 */
export const ENGAGEMENT_PERMISSIONS: PermissionName[] = [
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'EMBED_LINKS',
  'ATTACH_FILES',
  'READ_MESSAGE_HISTORY',
  'ADD_REACTIONS',
  'USE_EXTERNAL_EMOJIS',
  'MANAGE_ROLES',
];

export const MODERATION_PERMISSIONS: PermissionName[] = [
  'MANAGE_MESSAGES',
  'KICK_MEMBERS',
  'BAN_MEMBERS',
  'MODERATE_MEMBERS',
  'VIEW_AUDIT_LOG',
];

export const FULL_PERMISSIONS: PermissionName[] = [
  ...ENGAGEMENT_PERMISSIONS,
  ...MODERATION_PERMISSIONS,
  'MANAGE_CHANNELS',
  'MANAGE_THREADS',
  'CREATE_PUBLIC_THREADS',
  'SEND_MESSAGES_IN_THREADS',
  'PIN_MESSAGES',
];

export type InviteModule =
  | 'levels'
  | 'fun'
  | 'roles'
  | 'welcome'
  | 'giveaways'
  | 'tickets'
  | 'tempvoice'
  | 'moderation';

export function invitePermissions(modules: ReadonlyArray<InviteModule>): bigint {
  const names = new Set<PermissionName>(['VIEW_CHANNEL', 'SEND_MESSAGES', 'EMBED_LINKS']);

  if (modules.includes('levels')) {
    for (const name of ['READ_MESSAGE_HISTORY'] as const) names.add(name);
  }
  if (modules.includes('welcome')) {
    for (const name of ['SEND_MESSAGES', 'EMBED_LINKS'] as const) names.add(name);
  }
  if (modules.includes('fun')) {
    for (const name of ['SEND_MESSAGES', 'EMBED_LINKS'] as const) names.add(name);
  }
  if (modules.includes('giveaways')) {
    for (const name of [
      'ADD_REACTIONS',
      'READ_MESSAGE_HISTORY',
      'EMBED_LINKS',
      'SEND_MESSAGES',
    ] as const) {
      names.add(name);
    }
  }
  if (modules.includes('roles')) {
    for (const name of [
      'MANAGE_ROLES',
      'ADD_REACTIONS',
      'READ_MESSAGE_HISTORY',
      'VIEW_CHANNEL',
    ] as const) {
      names.add(name);
    }
  }
  if (modules.includes('tickets')) {
    for (const name of [
      'CREATE_PRIVATE_THREADS',
      'SEND_MESSAGES_IN_THREADS',
      'MANAGE_THREADS',
      'READ_MESSAGE_HISTORY',
    ] as const) {
      names.add(name);
    }
  }
  if (modules.includes('tempvoice')) {
    for (const name of ['MANAGE_CHANNELS', 'MOVE_MEMBERS', 'CONNECT'] as const) {
      names.add(name);
    }
  }
  if (modules.includes('moderation')) {
    for (const name of MODERATION_PERMISSIONS) names.add(name);
  }

  return namesToPermissions([...names]);
}
