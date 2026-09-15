import type { AdminRole, Permission } from '@/lib/types';

const all: Permission[] = [
  'overview.view',
  'games.view',
  'guessr.view',
  'guessr.images.upload',
  'guessr.images.edit',
  'guessr.images.publish',
  'guessr.images.delete',
  'admins.view',
  'admins.manage',
];

export const rolePermissions: Record<AdminRole, Permission[]> = {
  superadmin: all,
  admin: all.filter((permission) => permission !== 'admins.manage'),
  editor: [
    'overview.view',
    'games.view',
    'guessr.view',
    'guessr.images.upload',
    'guessr.images.edit',
  ],
  viewer: ['overview.view', 'games.view', 'guessr.view'],
};

export const hasPermission = (permissions: Permission[], permission: Permission) => permissions.includes(permission);
