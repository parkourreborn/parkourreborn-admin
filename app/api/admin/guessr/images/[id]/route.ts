import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { imagePatchSchema } from '@/lib/server/guessr-schema';
import { imageFromDoc } from '@/lib/server/serializers';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'guessr.images.edit');
    const { id } = await context.params;
    const patch = imagePatchSchema.parse(await request.json());
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    if (patch.mapVersionId) {
      const map = await getAdminDb().collection('guessrMaps').doc(patch.mapVersionId).get();
      if (!map.exists || map.data()?.active !== true) return NextResponse.json({ error: 'Map version is not active' }, { status: 400 });
    }

    const ref = getAdminDb().collection('guessrImages').doc(id);
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    await ref.update({ ...patch, updatedBy: admin.uid, updatedAt: FieldValue.serverTimestamp() });
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
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    await ref.update({ status: 'disabled', disabledBy: admin.uid, disabledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await writeAudit(admin.uid, 'guessr.image.disabled', id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error, 'Could not disable image');
  }
}
