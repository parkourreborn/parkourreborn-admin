import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/server/firebase-admin';

const configuredLimit = (name: string, fallback: number) => {
  const value = Number(process.env[name] || fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export async function createUploadSession(uid: string, kind: 'guessr' | 'media', uploadId: string, data: Record<string, unknown>) {
  const now = Date.now();
  const minute = Math.floor(now / 60000);
  const db = getAdminDb();
  const adminRef = db.collection('rateLimits').doc(`upload-admin-${uid}-${minute}`);
  const globalRef = db.collection('rateLimits').doc(`upload-global-${minute}`);
  const sessionRef = db.collection('rateLimits').doc(`upload-session-${kind}-${uploadId}`);
  const adminLimit = configuredLimit('UPLOAD_LIMIT_PER_ADMIN', 4);
  const globalLimit = configuredLimit('UPLOAD_LIMIT_GLOBAL', 8);
  const expiresAtMs = now + 5 * 60 * 1000;
  const expiresAt = new Date(expiresAtMs);

  const allowed = await db.runTransaction(async (transaction) => {
    const [adminDoc, globalDoc] = await Promise.all([transaction.get(adminRef), transaction.get(globalRef)]);
    const adminCount = Number(adminDoc.data()?.count || 0);
    const globalCount = Number(globalDoc.data()?.count || 0);
    if (adminCount >= adminLimit || globalCount >= globalLimit) return false;
    transaction.set(adminRef, { count: adminCount + 1, windowStart: minute * 60000, expiresAt });
    transaction.set(globalRef, { count: globalCount + 1, windowStart: minute * 60000, expiresAt });
    transaction.create(sessionRef, { type: `${kind}UploadSession`, uid, ...data, expiresAt, expiresAtMs, createdAt: FieldValue.serverTimestamp() });
    return true;
  });

  return { allowed, sessionRef };
}
