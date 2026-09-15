import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { mediaUploadSchema } from '@/lib/server/media-schema';
import { presignUpload } from '@/lib/server/r2';
import { createUploadSession } from '@/lib/server/upload-rate-limit';

export const runtime = 'nodejs';

const extensions: Record<string, string> = {
  'image/gif': 'gif',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const sanitizeBase = (fileName: string) => fileName
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\.[^.]+$/, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 72) || 'media';

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'media.upload');
    const body = mediaUploadSchema.parse(await request.json());
    if (/[\\/\u0000-\u001f]/.test(body.fileName)) return NextResponse.json({ error: 'Unsafe filename' }, { status: 400 });
    const collection = getAdminDb().collection('gifs');
    const current = body.replaceId ? await collection.doc(body.replaceId).get() : null;
    if (body.replaceId && !current?.exists) return NextResponse.json({ error: 'GIF not found' }, { status: 404 });
    if ((!body.replaceId || body.replaceId !== body.label) && (await collection.doc(body.label).get()).exists) {
      return NextResponse.json({ error: 'A GIF with that label already exists' }, { status: 409 });
    }
    const uploadId = randomUUID();
    const objectKey = `gifs/${sanitizeBase(body.fileName)}-${uploadId}.${extensions[body.contentType]}`;
    const session = await createUploadSession(admin.uid, 'media', uploadId, {
      objectKey,
      bytes: body.bytes,
      contentType: body.contentType,
      originalFilename: body.fileName,
      label: body.label,
      redirect: body.redirect,
      replaceId: body.replaceId || '',
    });
    if (!session.allowed) return NextResponse.json({ error: 'Upload limit reached. Try again after the next minute.' }, { status: 429, headers: { 'Retry-After': '60' } });
    const uploadUrl = await presignUpload(objectKey, body.bytes, body.contentType);
    return NextResponse.json({ uploadId, uploadUrl, objectKey, expiresIn: 90 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid upload details' }, { status: 400 });
    return apiError(error, 'Could not initialize upload');
  }
}
