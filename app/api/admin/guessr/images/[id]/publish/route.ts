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
    assertGuessr(admin, 'publish', image);
    if (image.mapVersionId !== map.id) return NextResponse.json({ error: 'Edit the target on the active map before publishing.' }, { status: 409 });

    // Publishing is when the image enters the game, so check its neighbours
    // again. The uploader's own confirmations count when they publish it
    // themselves; a reviewer sees them listed in the prompt instead.
    const nearby = await nearbyOnServer(map, image, image.coordinates, id);
    const confirmed = ownsImage(admin, image) ? [...confirmNearby, ...image.nearbyAcknowledged] : confirmNearby;
    const open = unconfirmed(nearby, confirmed);
    if (open.length) return nearbyResponse(open);

    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(ref);
      if (!fresh.exists) throw new Error('NOT_FOUND');
      const current = imageFromDoc(fresh);
      assertGuessr(admin, 'publish', current);
      if (current.mapVersionId !== map.id) throw new Error('MAP_CHANGED');
      transaction.update(ref, {
        status: 'published',
        mapVersionId: map.id,
        ...(fresh.data()?.firstPublishedAt ? {} : { firstPublishedAt: FieldValue.serverTimestamp() }),
        targetType: FieldValue.delete(),
        publishedBy: FieldValue.delete(),
        publishedAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await writeAudit(admin.uid, 'guessr.image.published', id, {
      ...(nearby.length ? { nearby: nearby.map((item) => ({ imageId: item.id, meters: Math.round(item.meters * 10) / 10 })) } : {}),
      ...(!ownsImage(admin, image) ? { byAdministrator: true } : {}),
    });
    return NextResponse.json({ image: imageFromDoc(await ref.get()) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid publish request' }, { status: 400 });
    if (error instanceof Error && error.message === 'NOT_FOUND') return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    if (error instanceof Error && error.message === 'MAP_CHANGED') return NextResponse.json({ error: 'Edit the target on the active map before publishing.' }, { status: 409 });
    return apiError(error, 'Could not publish image');
  }
}
