import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { imageMetaSchema } from '@/lib/server/guessr-schema';
import { presignUpload } from '@/lib/server/r2';
import { createUploadSession } from '@/lib/server/upload-rate-limit';

export const runtime = "nodejs";

const maxBytes = 4 * 1024 * 1024;
const requestSchema = imageMetaSchema.extend({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.literal('image/webp'),
  bytes: z.number().int().positive().max(maxBytes),
});

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'guessr.images.create');
    const body = requestSchema.parse(await request.json());
    const map = await getAdminDb().collection('guessrMaps').doc(body.mapVersionId).get();
    if (!map.exists || map.data()?.active !== true) return NextResponse.json({ error: 'Select an active map version' }, { status: 400 });

    const uploadId = randomUUID();
    const objectKey = `guessr/images/${uploadId}.webp`;
    const session = await createUploadSession(admin.uid, 'guessr', uploadId, {
      objectKey, bytes: body.bytes, fileName: body.fileName, mode: body.mode, difficulty: body.difficulty,
      targetType: body.targetType, coordinates: body.coordinates, mapVersionId: body.mapVersionId,
    });
    if (!session.allowed) return NextResponse.json({ error: 'Upload limit reached. Try again after the next minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
    const uploadUrl = await presignUpload(objectKey, body.bytes);
    return NextResponse.json({ uploadId, uploadUrl, expiresIn: 90 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid upload details' }, { status: 400 });
    return apiError(error, 'Could not initialize upload');
  }
}
