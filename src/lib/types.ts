export const permissions = [
  'overview.view',
  'audit.view',
  'announcements.view',
  'announcements.manage',
  'guessr.view',
  'guessr.images.create',
  'guessr.images.edit',
  'guessr.images.publish',
  'guessr.images.delete',
  'media.view',
  'media.upload',
  'media.delete',
  'techs.view',
  'techs.manage',
  'timetrials.view',
  'timetrials.manage',
  'links.view',
  'links.manage',
  'files.view',
  'files.manage',
  'admins.view',
] as const;

export type Permission = typeof permissions[number];
export type GuessrMode = 'classic' | 'graffiti';
export type GuessrDifficulty = 'normal' | 'hard';
export type GuessrStatus = 'draft' | 'published' | 'disabled';

export type AdminProfile = {
  uid: string;
  permissions: Permission[];
  displayName: string;
  avatarUrl: string | null;
  disabled: boolean;
  isOwner: boolean;
};

export type MapPoint = { x: number; y: number };

export type GuessrImage = {
  id: string;
  objectKey: string;
  imageUrl: string;
  mode: GuessrMode;
  difficulty: GuessrDifficulty;
  status: GuessrStatus;
  coordinates: MapPoint;
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

export type Announcement = {
  id: string;
  title: string;
  message: string;
  active: boolean;
  author: string;
  createdAt: string | null;
  updatedAt: string | null;
  expiresAt: string | null;
};

export type MediaItem = {
  id: string;
  link: string;
  redirect: string;
};

export type ContentRecord = {
  id: string;
  data: Record<string, unknown>;
  createdAt: string | null;
  updatedAt: string | null;
};
