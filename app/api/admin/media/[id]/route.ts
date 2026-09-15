import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { documentIdSchema } from '@/lib/server/content-sections';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { mediaPatchSchema } from '@/lib/server/media-schema';
import { deleteR2Object, r2ObjectKeyFromPublicUrl } from '@/lib/server/r2';
import { mediaFromDoc } from '@/lib/server/serializers';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'media.upload');
    const id = documentIdSchema.parse((await context.params).id);
    const body = mediaPatchSchema.parse(await request.json());
    if (!Object.keys(body).length) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    const db = getAdminDb();
    const currentRef = db.collection('gifs').doc(id);
    const nextId = body.label || id;
    const nextRef = db.collection('gifs').doc(nextId);
    let previousLink = '';
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(currentRef);
      if (!current.exists) throw new Error('NOT_FOUND');
      if (nextId !== id && (await transaction.get(nextRef)).exists) throw new Error('CONFLICT');
      previousLink = String(current.data()?.link || current.data()?.publicUrl || '');
      const link = body.link || previousLink;
      const redirect = body.redirect ?? String(current.data()?.redirect || '');
      transaction.set(nextRef, { link, redirect });
      if (nextId !== id) transaction.delete(currentRef);
    });
    if (body.link && body.link !== previousLink) {
      const previousKey = r2ObjectKeyFromPublicUrl(previousLink);
      if (previousKey) await deleteR2Object(previousKey, 'gifs/').catch(() => undefined);
    }
    await writeAudit(admin.uid, 'media.edited', nextId, {
      ...(nextId !== id ? { previousId: id } : {}),
      fields: Object.keys(body),
    });
    return NextResponse.json({ media: mediaFromDoc(await nextRef.get()) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid media changes' }, { status: 400 });
    if (error instanceof Error && error.message === 'NOT_FOUND') return NextResponse.json({ error: 'GIF not found' }, { status: 404 });
    if (error instanceof Error && error.message === 'CONFLICT') return NextResponse.json({ error: 'A GIF with that label already exists' }, { status: 409 });
    return apiError(error, 'Could not update media');
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'media.delete');
    const id = documentIdSchema.parse((await context.params).id);
    const ref = getAdminDb().collection('gifs').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    const data = doc.data() || {};
    const objectKey = r2ObjectKeyFromPublicUrl(String(data.link || data.publicUrl || ''))
      || (typeof data.objectKey === 'string' && data.objectKey.startsWith('gifs/') ? data.objectKey : null);
    if (objectKey) await deleteR2Object(objectKey, 'gifs/');
    await ref.delete();
    await writeAudit(admin.uid, 'media.deleted', id, objectKey ? { objectKey } : { source: 'url' });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid media item' }, { status: 400 });
    return apiError(error, 'Could not delete media');
  }
}
