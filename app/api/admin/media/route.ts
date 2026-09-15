import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { mediaFromDoc } from '@/lib/server/serializers';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'media.view');
    const snapshot = await getAdminDb().collection('gifs').limit(300).get();
    const media = snapshot.docs.map(mediaFromDoc).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return NextResponse.json({ media });
  } catch (error) {
    return apiError(error, 'Could not load media');
  }
}
