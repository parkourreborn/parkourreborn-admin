import 'server-only';

import type { DocumentSnapshot } from 'firebase-admin/firestore';
import type { Announcement, AuditEntry, ContentRecord, GuessrImage, MediaItem } from '@/lib/types';

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

export const announcementFromDoc = (doc: DocumentSnapshot): Announcement => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    title: String(data.title || ''),
    message: String(data.message || ''),
    active: data.active === true,
    author: String(data.author || data.createdBy || ''),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    expiresAt: iso(data.expiresAt),
  };
};

export const mediaFromDoc = (doc: DocumentSnapshot): MediaItem => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    displayName: String(data.displayName || doc.id),
    originalFilename: String(data.originalFilename || ''),
    objectKey: String(data.objectKey || ''),
    publicUrl: String(data.publicUrl || data.link || ''),
    mimeType: String(data.mimeType || ''),
    fileSize: Number(data.fileSize || 0),
    active: data.active !== false,
    uploadedBy: String(data.uploadedBy || ''),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    altText: String(data.altText || ''),
    category: String(data.category || ''),
    description: String(data.description || ''),
  };
};

export const contentFromDoc = (doc: DocumentSnapshot): ContentRecord => {
  const source = { ...(doc.data() || {}) };
  const createdAt = iso(source.createdAt);
  const updatedAt = iso(source.updatedAt);
  delete source.createdAt;
  delete source.updatedAt;
  delete source.createdBy;
  delete source.updatedBy;
  return { id: doc.id, data: source, createdAt, updatedAt };
};
