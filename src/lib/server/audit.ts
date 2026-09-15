import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/server/firebase-admin';

export async function writeAudit(actorUid: string, action: string, targetId: string | null, details: Record<string, unknown> = {}) {
  await getAdminDb().collection('guessrAuditLogs').add({
    actorUid,
    action,
    targetId,
    details,
    createdAt: FieldValue.serverTimestamp(),
  });
}
