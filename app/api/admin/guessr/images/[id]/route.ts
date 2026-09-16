import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { getActiveGuessrMap, imagePatchSchema } from '@/lib/server/guessr-schema';
import { deleteR2Object } from '@/lib/server/r2';
import { imageFromDoc } from '@/lib/server/serializers';

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
const patchSchema = imagePatchSchema.extend({ mapVersionId: z.string().trim().min(1) });

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'guessr.images.edit');
    const { id } = await context.params;
    const { mapVersionId, ...patch } = patchSchema.parse(await request.json());
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    const map = await getActiveGuessrMap();
    if (mapVersionId !== map.id) return NextResponse.json({ error: 'The active Guessr map changed. Reload before saving.' }, { status: 409 });

    const ref = getAdminDb().collection('guessrImages').doc(id);
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    await ref.update({
      ...patch,
      mapVersionId: map.id,
      targetType: FieldValue.delete(),
      publishedBy: FieldValue.delete(),
      publishedAt: FieldValue.delete(),
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeAudit(admin.uid, 'guessr.image.edited', id, { fields: Object.keys(patch) });
    return NextResponse.json({ image: imageFromDoc(await ref.get()) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid image changes' }, { status: 400 });
    return apiError(error, 'Could not edit image');
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'guessr.images.delete');
    const { id } = await context.params;
    const ref = getAdminDb().collection('guessrImages').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    await getActiveGuessrMap();

    if (request.nextUrl.searchParams.get('permanent') === 'true') {
      const data = doc.data() || {};
      if (data.status !== 'disabled') return NextResponse.json({ error: 'Only disabled images can be permanently deleted' }, { status: 409 });
      if (typeof data.objectKey !== 'string' || !data.objectKey) return NextResponse.json({ error: 'Image object key is missing' }, { status: 409 });

      await deleteR2Object(data.objectKey);
      await ref.delete();
      await writeAudit(admin.uid, 'guessr.image.deleted', id, { objectKey: data.objectKey });
      return NextResponse.json({ ok: true });
    }

    if (doc.data()?.status === 'disabled') return NextResponse.json({ error: 'Image is already disabled' }, { status: 409 });
    const status = doc.data()?.status === 'published' ? 'published' : 'draft';
    await ref.update({ status: 'disabled', statusBeforeDisabled: status, disabledBy: admin.uid, disabledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await writeAudit(admin.uid, 'guessr.image.disabled', id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, request.nextUrl.searchParams.get('permanent') === 'true' ? 'Could not permanently delete image' : 'Could not disable image');
  }
}
