import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { assertGuessr, confirmNearbySchema, nearbyOnServer, nearbyResponse, unconfirmed } from '@/lib/server/guessr-images';
import { getActiveGuessrMap } from '@/lib/server/guessr-schema';
import { imageFromDoc } from '@/lib/server/serializers';
import { ownsImage } from '@/lib/policy';

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
const bodySchema = z.object({ confirmNearby: confirmNearbySchema }).strict();

export async function POST(request: NextRequest, context: Context) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'guessr.view');
    const { id } = await context.params;
    const { confirmNearby } = bodySchema.parse(await request.json().catch(() => ({})));
    const db = getAdminDb();
    const ref = db.collection('guessrImages').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    const map = await getActiveGuessrMap();
    const image = imageFromDoc(doc);
    assertGuessr(admin, 'restore', image);

    // Restoring puts it back in its pool, so the same closeness check applies.
    if (image.mapVersionId === map.id) {
      const nearby = await nearbyOnServer(map, image, image.coordinates, id);
      const confirmed = ownsImage(admin, image) ? [...confirmNearby, ...image.nearbyAcknowledged] : confirmNearby;
      const open = unconfirmed(nearby, confirmed);
      if (open.length) return nearbyResponse(open);
    }

    const status = await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(ref);
      if (!fresh.exists) throw new Error('NOT_FOUND');
      assertGuessr(admin, 'restore', imageFromDoc(fresh));
      const data = fresh.data() || {};
      const next = data.statusBeforeDisabled === 'published' && data.mapVersionId === map.id ? 'published' : 'draft';
      transaction.update(ref, {
        status: next,
        statusBeforeDisabled: FieldValue.delete(),
        disabledBy: FieldValue.delete(),
        disabledAt: FieldValue.delete(),
        reactivatedBy: admin.uid,
        reactivatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return next;
    });
    await writeAudit(admin.uid, 'guessr.image.reactivated', id, { status, ...(!ownsImage(admin, image) ? { byAdministrator: true } : {}) });
    return NextResponse.json({ image: imageFromDoc(await ref.get()) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid restore request' }, { status: 400 });
    if (error instanceof Error && error.message === 'NOT_FOUND') return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    return apiError(error, 'Could not reactivate image');
  }
}
