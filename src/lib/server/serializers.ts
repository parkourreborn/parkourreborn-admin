import 'server-only';

import type { DocumentSnapshot } from 'firebase-admin/firestore';
import type { AuditEntry, GuessrImage } from '@/lib/types';

const iso = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('toDate' in value) || typeof value.toDate !== 'function') return null;
  return value.toDate().toISOString();
};

export const imageFromDoc = (doc: DocumentSnapshot): GuessrImage => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    objectKey: String(data.objectKey || ''),
    imageUrl: String(data.imageUrl || ''),
    mode: data.mode === 'graffiti' ? 'graffiti' : 'classic',
    difficulty: data.difficulty === 'hard' ? 'hard' : 'normal',
    targetType: data.targetType === 'graffiti' ? 'graffiti' : 'player',
    status: data.status === 'published' || data.status === 'disabled' ? data.status : 'draft',
    coordinates: { x: Number(data.coordinates?.x || 0), y: Number(data.coordinates?.y || 0) },
    mapVersionId: String(data.mapVersionId || ''),
    createdBy: String(data.createdBy || ''),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
  };
};

export const auditFromDoc = (doc: DocumentSnapshot): AuditEntry => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    action: String(data.action || ''),
    actorUid: String(data.actorUid || ''),
    targetId: typeof data.targetId === 'string' ? data.targetId : null,
    details: data.details && typeof data.details === 'object' ? data.details : {},
    createdAt: iso(data.createdAt),
  };
};
