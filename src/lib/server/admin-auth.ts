import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { rolePermissions } from '@/lib/roles';
import { permissions } from '@/lib/types';
import type { AdminProfile, AdminRole, Permission } from '@/lib/types';

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

const validRole = (value: unknown): value is AdminRole => ['superadmin', 'admin', 'editor', 'viewer'].includes(String(value));
const validPermission = (value: unknown): value is Permission => permissions.includes(value as Permission);
const superadminDiscordIds = () => new Set(
  (process.env.SUPERADMIN_DISCORD_IDS || '').split(',').map((id) => id.trim()).filter(Boolean),
);

export async function verifyIdToken(header: string | null): Promise<DecodedIdToken> {
  const [type, token] = header?.split(' ') ?? [];
  if (type !== 'Bearer' || !token) throw new AdminAuthError('Authentication required', 401);

  try {
    return await getAdminAuth().verifyIdToken(token, true);
  } catch {
    throw new AdminAuthError('Invalid authentication token', 401);
  }
}

export async function bootstrapSuperadmin(uid: string, discordId: string, profile?: { displayName?: string; avatarUrl?: string | null }) {
  if (!superadminDiscordIds().has(discordId)) return null;

  const ref = getAdminDb().collection('admins').doc(uid);
  await ref.set({
    role: 'superadmin',
    permissions: rolePermissions.superadmin,
    disabled: false,
    discordId,
    displayName: profile?.displayName || 'Super admin',
    avatarUrl: profile?.avatarUrl || null,
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return ref.get();
}

export async function loadAdmin(uid: string, discordId?: string): Promise<AdminProfile> {
  const ref = getAdminDb().collection('admins').doc(uid);
  let doc = await ref.get();
  if (!doc.exists && discordId) doc = await bootstrapSuperadmin(uid, discordId) || doc;
  if (!doc.exists) throw new AdminAuthError('This Discord account is not an admin');

  const data = doc.data() || {};
  if (data.disabled === true) throw new AdminAuthError('This admin account is disabled');
  const role = validRole(data.role) ? data.role : 'viewer';
  const explicit = Array.isArray(data.permissions) ? data.permissions.filter(validPermission) : [];
  const resolved = role === 'superadmin' ? rolePermissions.superadmin : Array.from(new Set([...rolePermissions[role], ...explicit]));

  return {
    uid,
    role,
    permissions: resolved,
    displayName: typeof data.displayName === 'string' ? data.displayName : 'Admin',
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
    disabled: false,
  };
}

export async function requireAdmin(header: string | null, permission: Permission) {
  const token = await verifyIdToken(header);
  const discordId = typeof token.discordId === 'string' ? token.discordId : undefined;
  const admin = await loadAdmin(token.uid, discordId);
  if (!admin.permissions.includes(permission)) throw new AdminAuthError('Missing permission');
  return { token, admin };
}
