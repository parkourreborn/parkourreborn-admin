import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { imageFromDoc } from '@/lib/server/serializers';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'guessr.view');
    const docs = await getAdminDb().collection('guessrImages').orderBy('createdAt', 'desc').limit(250).get();
    return NextResponse.json({ images: docs.docs.map(imageFromDoc) });
  } catch (error) {
    return apiError(error, 'Could not load images');
  }
}
