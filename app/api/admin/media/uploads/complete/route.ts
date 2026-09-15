import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { maxMediaBytes, mediaMimeTypes } from '@/lib/server/media-schema';
import { deleteR2Object, verifyUpload } from '@/lib/server/r2';
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

    const ref = db.collection('gifs').doc(uploadId);
    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(sessionRef);
      if (!fresh.exists || fresh.data()?.uid !== admin.uid) throw new Error('Upload session was already completed');
      transaction.create(ref, {
        displayName: data.displayName,
        originalFilename: data.originalFilename,
        objectKey,
        publicUrl: object.imageUrl,
        link: object.imageUrl,
        mimeType: object.contentType,
        fileSize: object.bytes,
        active: true,
        uploadedBy: admin.uid,
        altText: data.altText || '',
        category: data.category || '',
        description: data.description || '',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.delete(sessionRef);
    });
    await writeAudit(admin.uid, 'media.uploaded', uploadId, { objectKey, mimeType: object.contentType, fileSize: object.bytes });
    return NextResponse.json({ media: mediaFromDoc(await ref.get()) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid upload session' }, { status: 400 });
    return apiError(error, 'Could not complete upload');
  }
}
