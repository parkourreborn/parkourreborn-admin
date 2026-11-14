import 'server-only';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assertAllowed } from '@/lib/server/admin-auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { imageFromDoc } from '@/lib/server/serializers';
import { findNearby } from '@/lib/guessr-distance';
import type { GuessrPool } from '@/lib/guessr-distance';
import { guessrCan } from '@/lib/policy';
import type { Actor, GuessrAction, GuessrTarget } from '@/lib/policy';
import type { GuessrImage, GuessrMap, MapPoint, NearbyImage } from '@/lib/types';

export const confirmNearbySchema = z.array(z.string().trim().min(1).max(120)).max(50).default([]);

export function assertGuessr(actor: Actor, action: GuessrAction, image: GuessrTarget) {
  assertAllowed(guessrCan(actor, action, image));
}

// The serializer can only tell from the document whether an image was ever
// live. Images published before firstPublishedAt existed are found in the
// audit log instead.
export async function publishedImageIds() {
  const logs = await getAdminDb().collection('guessrAuditLogs').where('action', '==', 'guessr.image.published').select('targetId').get();
  return new Set(logs.docs.flatMap((doc) => typeof doc.data().targetId === 'string' ? [doc.data().targetId as string] : []));
}

export async function withPublishHistory(image: GuessrImage): Promise<GuessrImage> {
  if (image.everPublished) return image;
  const logs = await getAdminDb().collection('guessrAuditLogs')
    .where('targetId', '==', image.id)
    .where('action', '==', 'guessr.image.published')
    .limit(1)
    .get();
  return logs.empty ? image : { ...image, everPublished: true };
}

// Every image in the same pool that is closer than the warning distance. Only
// equality filters, so Firestore serves it without a composite index.
export async function nearbyOnServer(map: GuessrMap, pool: Omit<GuessrPool, 'mapVersionId'>, point: MapPoint, excludeId?: string): Promise<NearbyImage[]> {
  const snapshot = await getAdminDb().collection('guessrImages')
    .where('mapVersionId', '==', map.id)
    .where('mode', '==', pool.mode)
    .where('difficulty', '==', pool.difficulty)
    .get();
  return findNearby(point, { ...pool, mapVersionId: map.id }, snapshot.docs.map(imageFromDoc), map, excludeId);
}

export const unconfirmed = (nearby: NearbyImage[], confirmed: readonly string[]) => nearby.filter((item) => !confirmed.includes(item.id));

// 409 with the images the person has not confirmed yet; the dashboard shows
// them in the "really close" prompt and retries with them confirmed.
export const nearbyResponse = (nearby: NearbyImage[]) => NextResponse.json({
  error: 'This spot is really close to another image.',
  code: 'nearby',
  nearby,
}, { status: 409 });

// What gets stored on the image: IDs and distances, no user IDs.
export const acknowledgement = (nearby: NearbyImage[]) => nearby.map((item) => ({ imageId: item.id, meters: Math.round(item.meters * 10) / 10 }));
