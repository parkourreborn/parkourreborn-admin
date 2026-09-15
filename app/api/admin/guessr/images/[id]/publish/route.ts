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
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'guessr.images.publish');
    const { id } = await context.params;
    const ref = getAdminDb().collection('guessrImages').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    if (doc.data()?.status === 'disabled') return NextResponse.json({ error: 'Disabled images cannot be published' }, { status: 400 });
    await ref.update({ status: 'published', publishedBy: admin.uid, publishedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await writeAudit(admin.uid, 'guessr.image.published', id);
    return NextResponse.json({ image: imageFromDoc(await ref.get()) });
  } catch (error) {
    return apiError(error, 'Could not publish image');
  }
}
