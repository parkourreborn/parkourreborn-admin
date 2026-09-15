import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { maxMediaBytes, mediaMimeTypes } from '@/lib/server/media-schema';
import { deleteR2Object, r2ObjectKeyFromPublicUrl, verifyUpload } from '@/lib/server/r2';
import { mediaFromDoc } from '@/lib/server/serializers';

export const runtime = 'nodejs';
const schema = z.object({ uploadId: z.string().uuid() }).strict();

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'media.upload');
    const { uploadId } = schema.parse(await request.json());
    const db = getAdminDb();
    const sessionRef = db.collection('rateLimits').doc(`upload-session-media-${uploadId}`);
    const session = await sessionRef.get();
    const data = session.data();
    if (!session.exists || data?.uid !== admin.uid || data.type !== 'mediaUploadSession' || Number(data.expiresAtMs || 0) < Date.now()) {
      return NextResponse.json({ error: 'Upload session is invalid or expired' }, { status: 400 });
    }

    const objectKey = String(data.objectKey || '');
    const object = await verifyUpload(objectKey);
    const expectedType = String(data.contentType || '');
    if (object.bytes <= 0 || object.bytes > maxMediaBytes || object.bytes !== Number(data.bytes) || object.contentType !== expectedType || !mediaMimeTypes.includes(expectedType as typeof mediaMimeTypes[number])) {
      await deleteR2Object(objectKey, 'gifs/').catch(() => undefined);
      return NextResponse.json({ error: 'Uploaded file did not pass verification' }, { status: 400 });
    }

    const label = String(data.label || '');
    const redirect = String(data.redirect || '');
    const replaceId = String(data.replaceId || '');
    const ref = db.collection('gifs').doc(label);
    let previousLink = '';
    try {
      previousLink = await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(sessionRef);
        if (!fresh.exists || fresh.data()?.uid !== admin.uid) throw new Error('INVALID_SESSION');

        if (replaceId) {
          const currentRef = db.collection('gifs').doc(replaceId);
          const current = await transaction.get(currentRef);
          if (!current.exists) throw new Error('NOT_FOUND');
          if (replaceId !== label && (await transaction.get(ref)).exists) throw new Error('CONFLICT');
          transaction.set(ref, { link: object.imageUrl, redirect });
          if (replaceId !== label) transaction.delete(currentRef);
          transaction.delete(sessionRef);
          return String(current.data()?.link || current.data()?.publicUrl || '');
        }

        if ((await transaction.get(ref)).exists) throw new Error('CONFLICT');
        transaction.create(ref, { link: object.imageUrl, redirect });
        transaction.delete(sessionRef);
        return '';
      });
    } catch (error) {
      await deleteR2Object(objectKey, 'gifs/').catch(() => undefined);
      throw error;
    }

    const previousKey = r2ObjectKeyFromPublicUrl(previousLink);
    if (previousKey && previousKey !== objectKey) await deleteR2Object(previousKey, 'gifs/').catch(() => undefined);
    await writeAudit(admin.uid, replaceId ? 'media.edited' : 'media.uploaded', label, {
      ...(replaceId && replaceId !== label ? { previousId: replaceId } : {}),
      objectKey,
      mimeType: object.contentType,
      fileSize: object.bytes,
    });
    return NextResponse.json({ media: mediaFromDoc(await ref.get()) }, { status: replaceId ? 200 : 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid upload session' }, { status: 400 });
    if (error instanceof Error && error.message === 'INVALID_SESSION') return NextResponse.json({ error: 'Upload session was already completed' }, { status: 400 });
    if (error instanceof Error && error.message === 'NOT_FOUND') return NextResponse.json({ error: 'GIF not found' }, { status: 404 });
    if (error instanceof Error && error.message === 'CONFLICT') return NextResponse.json({ error: 'A GIF with that label already exists' }, { status: 409 });
    return apiError(error, 'Could not complete upload');
  }
}
