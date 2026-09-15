import { randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { imageMetaSchema } from '@/lib/server/guessr-schema';
import { presignUpload } from '@/lib/server/r2';

const maxBytes = 4 * 1024 * 1024;
const requestSchema = imageMetaSchema.extend({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.literal('image/webp'),
  bytes: z.number().int().positive().max(maxBytes),
});

const limit = (name: string, fallback: number) => {
  const value = Number(process.env[name] || fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'guessr.images.upload');
    const body = requestSchema.parse(await request.json());
    const map = await getAdminDb().collection('guessrMaps').doc(body.mapVersionId).get();
    if (!map.exists || map.data()?.active !== true) return NextResponse.json({ error: 'Select an active map version' }, { status: 400 });

    const now = Date.now();
    const minute = Math.floor(now / 60000);
    const uploadId = randomUUID();
    const objectKey = `guessr/images/${uploadId}.webp`;
    const db = getAdminDb();
    const adminLimit = limit('UPLOAD_LIMIT_PER_ADMIN', 4);
    const globalLimit = limit('UPLOAD_LIMIT_GLOBAL', 8);
    const adminRef = db.collection('rateLimits').doc(`guessr-upload-admin-${admin.uid}-${minute}`);
    const globalRef = db.collection('rateLimits').doc(`guessr-upload-global-${minute}`);
    const sessionRef = db.collection('rateLimits').doc(`guessr-upload-session-${uploadId}`);

    const rate = await db.runTransaction(async (transaction) => {
      const [adminDoc, globalDoc] = await Promise.all([transaction.get(adminRef), transaction.get(globalRef)]);
      const adminCount = Number(adminDoc.data()?.count || 0);
      const globalCount = Number(globalDoc.data()?.count || 0);
      if (adminCount >= adminLimit || globalCount >= globalLimit) return false;

      const expiresAtMs = now + 5 * 60 * 1000;
      const expiresAt = new Date(expiresAtMs);
      transaction.set(adminRef, { count: adminCount + 1, windowStart: minute * 60000, expiresAt });
      transaction.set(globalRef, { count: globalCount + 1, windowStart: minute * 60000, expiresAt });
      transaction.create(sessionRef, {
        type: 'guessrUploadSession',
        uid: admin.uid,
        objectKey,
        bytes: body.bytes,
        fileName: body.fileName,
        mode: body.mode,
        difficulty: body.difficulty,
        targetType: body.targetType,
        coordinates: body.coordinates,
        mapVersionId: body.mapVersionId,
        expiresAt,
        expiresAtMs,
        createdAt: FieldValue.serverTimestamp(),
      });
      return true;
    });

    if (!rate) return NextResponse.json({ error: 'Upload limit reached. Try again after the next minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
    const uploadUrl = await presignUpload(objectKey, body.bytes);
    return NextResponse.json({ uploadId, uploadUrl, expiresIn: 90 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid upload details' }, { status: 400 });
    return apiError(error, 'Could not initialize upload');
  }
}
