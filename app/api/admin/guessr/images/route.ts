import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { publishedImageIds } from '@/lib/server/guessr-images';
import { loadPeople } from '@/lib/server/people';
import { imageFromDoc } from '@/lib/server/serializers';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'guessr.view');
    const [docs, people] = await Promise.all([
      getAdminDb().collection('guessrImages').orderBy('createdAt', 'desc').limit(250).get(),
      loadPeople(),
    ]);
    let images = docs.docs.map(imageFromDoc);
    if (images.some((image) => !image.everPublished)) {
      const published = await publishedImageIds();
      images = images.map((image) => image.everPublished || !published.has(image.id) ? image : { ...image, everPublished: true });
    }
    return NextResponse.json({ images, people });
  } catch (error) {
    return apiError(error, 'Could not load images');
  }
}
