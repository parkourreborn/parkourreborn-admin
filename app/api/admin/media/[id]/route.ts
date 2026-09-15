import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { documentIdSchema } from '@/lib/server/content-sections';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { mediaPatchSchema } from '@/lib/server/media-schema';
import { deleteR2Object } from '@/lib/server/r2';
import { mediaFromDoc } from '@/lib/server/serializers';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'media.upload');
    const id = documentIdSchema.parse((await context.params).id);
    const body = mediaPatchSchema.parse(await request.json());
    if (!Object.keys(body).length) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    const ref = getAdminDb().collection('gifs').doc(id);
    const current = await ref.get();
    if (!current.exists) return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    const publicUrl = String(current.data()?.publicUrl || current.data()?.link || '');
    await ref.update({ ...body, ...(typeof body.active === 'boolean' ? { link: body.active ? publicUrl : '' } : {}), updatedBy: admin.uid, updatedAt: FieldValue.serverTimestamp() });
    const action = Object.keys(body).length === 1 && typeof body.active === 'boolean'
      ? `media.${body.active ? 'reactivated' : 'disabled'}`
      : 'media.edited';
    await writeAudit(admin.uid, action, id, { fields: Object.keys(body) });
    return NextResponse.json({ media: mediaFromDoc(await ref.get()) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid media changes' }, { status: 400 });
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
    if (data.active !== false) return NextResponse.json({ error: 'Disable media before permanently deleting it' }, { status: 409 });
    if (typeof data.objectKey !== 'string' || !data.objectKey.startsWith('gifs/')) return NextResponse.json({ error: 'R2 object key is missing or invalid' }, { status: 409 });
    await deleteR2Object(data.objectKey, 'gifs/');
    await ref.delete();
    await writeAudit(admin.uid, 'media.deleted', id, { objectKey: data.objectKey });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid media item' }, { status: 400 });
    return apiError(error, 'Could not delete media');
  }
}
