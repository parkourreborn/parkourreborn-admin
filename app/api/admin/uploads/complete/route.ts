import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { imageFromDoc } from '@/lib/server/serializers';
import { verifyUpload } from '@/lib/server/r2';

const schema = z.object({ uploadId: z.string().uuid() });
const maxBytes = 4 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'guessr.images.upload');
    const { uploadId } = schema.parse(await request.json());
    const db = getAdminDb();
    const sessionRef = db.collection('rateLimits').doc(`guessr-upload-session-${uploadId}`);
    const session = await sessionRef.get();
    const data = session.data();
    if (!session.exists || data?.uid !== admin.uid || Number(data.expiresAtMs || 0) < Date.now()) {
      return NextResponse.json({ error: 'Upload session is invalid or expired' }, { status: 400 });
    }

    const object = await verifyUpload(String(data.objectKey));
    if (object.bytes <= 0 || object.bytes > maxBytes || object.contentType !== 'image/webp' || object.bytes !== Number(data.bytes)) {
      return NextResponse.json({ error: 'Uploaded object did not pass verification' }, { status: 400 });
    }

    const imageRef = db.collection('guessrImages').doc(uploadId);
    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(sessionRef);
      if (!fresh.exists || fresh.data()?.uid !== admin.uid) throw new Error('Upload session was already completed');
      transaction.create(imageRef, {
        objectKey: data.objectKey,
        imageUrl: object.imageUrl,
        originalFileName: data.fileName,
        bytes: object.bytes,
        contentType: object.contentType,
        mode: data.mode,
        difficulty: data.difficulty,
        targetType: data.targetType,
        coordinates: data.coordinates,
        mapVersionId: data.mapVersionId,
        status: 'draft',
        createdBy: admin.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.delete(sessionRef);
    });
    await writeAudit(admin.uid, 'guessr.image.uploaded', uploadId, { mapVersionId: data.mapVersionId });
    return NextResponse.json({ image: imageFromDoc(await imageRef.get()) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid upload session' }, { status: 400 });
    return apiError(error, 'Could not complete upload');
  }
}
