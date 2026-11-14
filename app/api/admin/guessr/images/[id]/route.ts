import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { acknowledgement, assertGuessr, confirmNearbySchema, nearbyOnServer, nearbyResponse, unconfirmed, withPublishHistory } from '@/lib/server/guessr-images';
import { getActiveGuessrMap, imagePatchSchema } from '@/lib/server/guessr-schema';
import { deleteR2Object } from '@/lib/server/r2';
import { imageFromDoc } from '@/lib/server/serializers';
import { editKeepsPublished, ownsImage } from '@/lib/policy';
import type { GuessrImage } from '@/lib/types';

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };
const patchSchema = imagePatchSchema.extend({ mapVersionId: z.string().trim().min(1), confirmNearby: confirmNearbySchema });

const samePlacement = (image: GuessrImage, next: Pick<GuessrImage, 'mode' | 'difficulty' | 'coordinates' | 'mapVersionId'>) => image.mode === next.mode
  && image.difficulty === next.difficulty
  && image.mapVersionId === next.mapVersionId
  && image.coordinates.x === next.coordinates.x
  && image.coordinates.y === next.coordinates.y;

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'guessr.view');
    const { id } = await context.params;
    const { mapVersionId, confirmNearby, ...patch } = patchSchema.parse(await request.json());
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    const map = await getActiveGuessrMap();
    if (mapVersionId !== map.id) return NextResponse.json({ error: 'The active Guessr map changed. Reload before saving.' }, { status: 409 });

    const db = getAdminDb();
    const ref = db.collection('guessrImages').doc(id);
    const before = await ref.get();
    if (!before.exists) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    const current = imageFromDoc(before);
    assertGuessr(admin, 'edit', current);

    const next = {
      mode: patch.mode ?? current.mode,
      difficulty: patch.difficulty ?? current.difficulty,
      coordinates: patch.coordinates ?? current.coordinates,
      mapVersionId: map.id,
    };
    const moved = !samePlacement(current, next);
    let nearby: Awaited<ReturnType<typeof nearbyOnServer>> = [];
    if (moved) {
      nearby = await nearbyOnServer(map, next, next.coordinates, id);
      const open = unconfirmed(nearby, confirmNearby);
      if (open.length) return nearbyResponse(open);
    }

    let sentToReview = false;
    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(ref);
      if (!fresh.exists) throw new Error('NOT_FOUND');
      const image = imageFromDoc(fresh);
      assertGuessr(admin, 'edit', image);
      sentToReview = moved && image.status === 'published' && !editKeepsPublished(admin, image);
      transaction.update(ref, {
        ...patch,
        mapVersionId: map.id,
        ...(moved ? { nearbyAcknowledged: nearby.length ? acknowledgement(nearby) : FieldValue.delete() } : {}),
        ...(sentToReview ? { status: 'draft' } : {}),
        targetType: FieldValue.delete(),
        publishedBy: FieldValue.delete(),
        publishedAt: FieldValue.delete(),
        updatedBy: admin.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await writeAudit(admin.uid, 'guessr.image.edited', id, {
      fields: Object.keys(patch),
      ...(sentToReview ? { sentToReview: true } : {}),
      ...(nearby.length ? { nearby: acknowledgement(nearby) } : {}),
      ...(!ownsImage(admin, current) ? { byAdministrator: true } : {}),
    });
    return NextResponse.json({ image: imageFromDoc(await ref.get()), sentToReview });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid image changes' }, { status: 400 });
    if (error instanceof Error && error.message === 'NOT_FOUND') return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    return apiError(error, 'Could not edit image');
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const permanent = request.nextUrl.searchParams.get('permanent') === 'true';
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'guessr.view');
    const { id } = await context.params;
    const db = getAdminDb();
    const ref = db.collection('guessrImages').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    await getActiveGuessrMap();
    const byAdministrator = !ownsImage(admin, imageFromDoc(doc));

    if (permanent) {
      const image = await withPublishHistory(imageFromDoc(doc));
      assertGuessr(admin, 'delete', image);
      const objectKey = await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(ref);
        if (!fresh.exists) throw new Error('NOT_FOUND');
        assertGuessr(admin, 'delete', { ...imageFromDoc(fresh), everPublished: image.everPublished || imageFromDoc(fresh).everPublished });
        const key = fresh.data()?.objectKey;
        if (typeof key !== 'string' || !key) throw new Error('NO_OBJECT_KEY');
        transaction.delete(ref);
        return key;
      });
      await deleteR2Object(objectKey);
      await writeAudit(admin.uid, 'guessr.image.deleted', id, { objectKey, ...(byAdministrator ? { byAdministrator: true } : {}) });
      return NextResponse.json({ ok: true });
    }

    await db.runTransaction(async (transaction) => {
      const fresh = await transaction.get(ref);
      if (!fresh.exists) throw new Error('NOT_FOUND');
      const image = imageFromDoc(fresh);
      assertGuessr(admin, 'disable', image);
      transaction.update(ref, {
        status: 'disabled',
        statusBeforeDisabled: image.status === 'published' ? 'published' : 'draft',
        disabledBy: admin.uid,
        disabledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await writeAudit(admin.uid, 'guessr.image.disabled', id, byAdministrator ? { byAdministrator: true } : {});
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    if (error instanceof Error && error.message === 'NO_OBJECT_KEY') return NextResponse.json({ error: 'Image object key is missing' }, { status: 409 });
    return apiError(error, permanent ? 'Could not permanently delete image' : 'Could not disable image');
  }
}
