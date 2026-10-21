import { describe, expect, it } from 'vitest';
import {
  canManageGuild,
  canModerateGuild,
  ENGAGEMENT_PERMISSIONS,
  hasPermission,
  invitePermissions,
  namesToPermissions,
  Permission,
  parsePermissionMask,
  permissionsToNames,
} from './permissions';

describe('permission masks', () => {
  it('treats ADMINISTRATOR as every permission', () => {
    const mask = Permission.ADMINISTRATOR;
    expect(hasPermission(mask, Permission.MANAGE_ROLES)).toBe(true);
    expect(hasPermission(mask, Permission.BAN_MEMBERS)).toBe(true);
  });

  it('requires the exact bit otherwise', () => {
    const mask = Permission.SEND_MESSAGES;
    expect(hasPermission(mask, Permission.SEND_MESSAGES)).toBe(true);
    expect(hasPermission(mask, Permission.MANAGE_ROLES)).toBe(false);
  });

  it('round-trips names through a mask', () => {
    const mask = namesToPermissions(ENGAGEMENT_PERMISSIONS);
    expect(permissionsToNames(mask)).toEqual(ENGAGEMENT_PERMISSIONS);
  });

  it('parses decimal strings and tolerates junk', () => {
    expect(parsePermissionMask('8')).toBe(8n);
    expect(parsePermissionMask('')).toBe(0n);
    expect(parsePermissionMask('nope')).toBe(0n);
    expect(parsePermissionMask(null)).toBe(0n);
  });

  it('only lets admins and manage-guild holders configure the guild', () => {
    expect(canManageGuild(Permission.MANAGE_GUILD)).toBe(true);
    expect(canManageGuild(Permission.ADMINISTRATOR)).toBe(true);
    expect(canManageGuild(Permission.MANAGE_ROLES)).toBe(false);
  });

  it('lets moderation roles see moderation views', () => {
    expect(canModerateGuild(Permission.MODERATE_MEMBERS)).toBe(true);
    expect(canModerateGuild(Permission.VIEW_AUDIT_LOG)).toBe(true);
    expect(canModerateGuild(Permission.SEND_MESSAGES)).toBe(false);
  });
});

describe('invite permissions', () => {
  it('asks for role management when roles are enabled', () => {
    const mask = invitePermissions(['roles']);
    expect(mask & Permission.MANAGE_ROLES).toBe(Permission.MANAGE_ROLES);
    expect(mask & Permission.ADD_REACTIONS).toBe(Permission.ADD_REACTIONS);
  });

  it('stays minimal for levels only', () => {
    const mask = invitePermissions(['levels']);
    expect(mask & Permission.MANAGE_ROLES).toBe(0n);
    expect(mask & Permission.SEND_MESSAGES).toBe(Permission.SEND_MESSAGES);
  });

  it('never asks for administrator', () => {
    for (const module of ['levels', 'fun', 'roles', 'moderation'] as const) {
      expect(invitePermissions([module]) & Permission.ADMINISTRATOR).toBe(0n);
    }
  });
});
