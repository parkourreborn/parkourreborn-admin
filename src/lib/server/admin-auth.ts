import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { allPermissions, isPermission } from '@/lib/permissions';
import { isOwnerIdentity, OWNER_DISCORD_ID, OWNER_UID } from '@/lib/server/owner';
import type { AdminProfile, Permission } from '@/lib/types';

export class AdminAuthError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export async function verifyIdToken(header: string | null): Promise<DecodedIdToken> {
  const [type, token] = header?.split(' ') ?? [];
  if (type !== 'Bearer' || !token) throw new AdminAuthError('Authentication required', 401);

  try {
    return await getAdminAuth().verifyIdToken(token, true);
  } catch {
    throw new AdminAuthError('Invalid authentication token', 401);
  }
}

export async function bootstrapOwner(uid: string, discordId: string, profile?: { displayName?: string; avatarUrl?: string | null }) {
  if (!isOwnerIdentity(uid, discordId)) return null;

  const ref = getAdminDb().collection('admins').doc(OWNER_UID);
  const existing = await ref.get();
  await ref.set({
    permissions: allPermissions,
    disabled: false,
    owner: true,
    discordId: OWNER_DISCORD_ID,
    displayName: profile?.displayName || 'ElkkuT',
    avatarUrl: profile?.avatarUrl || null,
    updatedAt: FieldValue.serverTimestamp(),
    ...(!existing.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
  }, { merge: true });
  return ref.get();
}

export async function loadAdmin(uid: string, discordId?: string): Promise<AdminProfile> {
  const owner = isOwnerIdentity(uid, discordId);
  const ref = getAdminDb().collection('admins').doc(uid);
  let doc = await ref.get();
  if (owner) doc = await bootstrapOwner(uid, discordId!, { displayName: 'ElkkuT' }) || doc;
  if (!doc.exists) throw new AdminAuthError('This Discord account is not an admin');

  const data = doc.data() || {};
  if (!owner && data.disabled === true) throw new AdminAuthError('This admin account is disabled');
  const explicit = Array.isArray(data.permissions) ? data.permissions.filter(isPermission) : [];

  return {
    uid,
    permissions: owner ? allPermissions : Array.from(new Set(explicit)),
    displayName: typeof data.displayName === 'string' ? data.displayName : owner ? 'ElkkuT' : 'Admin',
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
    disabled: false,
    isOwner: owner,
  };
}

export async function authenticateAdmin(header: string | null) {
  const token = await verifyIdToken(header);
  const discordId = typeof token.discordId === 'string' ? token.discordId : undefined;
  const admin = await loadAdmin(token.uid, discordId);
  return { token, admin };
}

export async function requireAdmin(header: string | null, permission: Permission) {
  const result = await authenticateAdmin(header);
  if (!result.admin.permissions.includes(permission)) throw new AdminAuthError('Missing permission');
  return result;
}

export async function requireOwner(header: string | null) {
  const result = await authenticateAdmin(header);
  const discordId = typeof result.token.discordId === 'string' ? result.token.discordId : undefined;
  if (!isOwnerIdentity(result.token.uid, discordId)) throw new AdminAuthError('Owner access required');
  return result;
}
