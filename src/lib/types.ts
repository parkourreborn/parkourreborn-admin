export const permissions = [
  'overview.view',
  'games.view',
  'guessr.view',
  'guessr.images.upload',
  'guessr.images.edit',
  'guessr.images.publish',
  'guessr.images.delete',
  'admins.view',
  'admins.manage',
] as const;

export type Permission = typeof permissions[number];
export type AdminRole = 'superadmin' | 'admin' | 'editor' | 'viewer';
export type GuessrMode = 'classic' | 'graffiti';
export type GuessrDifficulty = 'normal' | 'hard';
export type GuessrTarget = 'player' | 'graffiti';
export type GuessrStatus = 'draft' | 'published' | 'disabled';

export type AdminProfile = {
  uid: string;
  role: AdminRole;
  permissions: Permission[];
  displayName: string;
  avatarUrl: string | null;
  disabled: boolean;
};

export type MapPoint = { x: number; y: number };

export type GuessrImage = {
  id: string;
  objectKey: string;
  imageUrl: string;
  mode: GuessrMode;
  difficulty: GuessrDifficulty;
  targetType: GuessrTarget;
  status: GuessrStatus;
  coordinates: MapPoint;
  mapVersionId: string;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AuditEntry = {
  id: string;
  action: string;
  actorUid: string;
  targetId: string | null;
  createdAt: string | null;
  details: Record<string, unknown>;
};
