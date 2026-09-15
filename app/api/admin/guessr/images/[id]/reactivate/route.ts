import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { imageFromDoc } from '@/lib/server/serializers';

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'guessr.images.delete');
    const { id } = await context.params;
    const ref = getAdminDb().collection('guessrImages').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: 'Image not found' }, { status: 404 });

    const data = doc.data() || {};
    if (data.status !== 'disabled') return NextResponse.json({ error: 'Image is not disabled' }, { status: 409 });
    const status = data.statusBeforeDisabled === 'published' ? 'published' : 'draft';
    await ref.update({
      status,
      statusBeforeDisabled: FieldValue.delete(),
      disabledBy: FieldValue.delete(),
      disabledAt: FieldValue.delete(),
      reactivatedBy: admin.uid,
      reactivatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeAudit(admin.uid, 'guessr.image.reactivated', id, { status });
    return NextResponse.json({ image: imageFromDoc(await ref.get()) });
  } catch (error) {
    return apiError(error, 'Could not reactivate image');
  }
}
