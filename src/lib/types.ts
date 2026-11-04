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
  'rebornai.view',
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

export type GuessrMap = {
  id: string;
  url: string;
  width: number;
  height: number;
};

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

// Reborn AI request logs (aiLogs) and unanswered questions (aiGaps), written
// by the hub. See ../parkourreborn/src/lib/reborn-ai/ai-log.ts.
export type RebornAiAttempt = { model: string; result: string; ms: number; status?: number; detail?: string };
export type RebornAiFeedback = { vote: 'up' | 'down'; note: string; triage: string | null };

export type RebornAiLog = {
  id: string;
  at: string | null;
  question: string;
  answer: string;
  outcome: string;
  check: string;
  routes: string[];
  answerModel: string;
  totalMs: number | null;
  escalated: boolean;
  cut: boolean;
  jevRouted: boolean;
  viewer: boolean;
  error: string | null;
  models: RebornAiAttempt[];
  feedback: RebornAiFeedback | null;
};

export type RebornAiDetail = RebornAiLog & {
  handling: string;
  style: number | null;
  guard: string | null;
  entities: Record<string, unknown>;
  tools: { name: string; status: string }[];
  chunks: string[];
  jev: Record<string, unknown>;
  timings: Record<string, number>;
  facts: string;
};

export type RebornAiGap = { id: string; at: string | null; question: string; routes: string[]; answerable: number | null; escalated: boolean };

export type RebornAiReport = {
  sample: number;
  since: string | null;
  outcomes: Record<string, number>;
  checks: Record<string, number>;
  averageMs: number;
  medianMs: number;
  escalated: number;
  jevRouted: number;
  feedback: { up: number; down: number };
  quota: { used?: number; limit?: number; remaining?: number } | null;
  configuredModels: string[];
  models: { model: string; tries: number; ok: number; failures: Record<string, number>; averageMs: number }[];
  logs: RebornAiLog[];
  gaps: RebornAiGap[];
};
