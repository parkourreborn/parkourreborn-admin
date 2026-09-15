import { permissions } from '@/lib/types';
import type { Permission } from '@/lib/types';

export const permissionGroups: { label: string; permissions: Permission[] }[] = [
  { label: 'Dashboard', permissions: ['overview.view', 'audit.view'] },
  { label: 'Announcements', permissions: ['announcements.view', 'announcements.manage'] },
  { label: 'Parkour Guessr', permissions: ['guessr.view', 'guessr.images.create', 'guessr.images.edit', 'guessr.images.publish', 'guessr.images.delete'] },
  { label: 'Media', permissions: ['media.view', 'media.upload', 'media.delete'] },
  { label: 'Hub content', permissions: ['techs.view', 'techs.manage', 'timetrials.view', 'timetrials.manage', 'links.view', 'links.manage', 'files.view', 'files.manage'] },
  { label: 'Administration', permissions: ['admins.view'] },
];

export const allPermissions = [...permissions] as Permission[];
export const isPermission = (value: unknown): value is Permission => permissions.includes(value as Permission);
export const hasPermission = (granted: Permission[], permission: Permission) => granted.includes(permission);

const dependencies: Partial<Record<Permission, Permission>> = {
  'announcements.manage': 'announcements.view',
  'guessr.images.create': 'guessr.view',
  'guessr.images.edit': 'guessr.view',
  'guessr.images.publish': 'guessr.view',
  'guessr.images.delete': 'guessr.view',
  'media.upload': 'media.view',
  'media.delete': 'media.view',
  'techs.manage': 'techs.view',
  'timetrials.manage': 'timetrials.view',
  'links.manage': 'links.view',
  'files.manage': 'files.view',
};

export const normalizePermissions = (selected: Permission[]) => Array.from(new Set(selected.flatMap((permission) => dependencies[permission] ? [dependencies[permission]!, permission] : [permission])));

export const permissionLabel = (permission: Permission) => permission
  .replace('timetrials', 'time trials')
  .replace('guessr.images.', 'Guessr images: ')
  .replace('.', ': ')
  .replace(/\b\w/g, (character) => character.toUpperCase());
