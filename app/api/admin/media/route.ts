import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { mediaCreateSchema } from '@/lib/server/media-schema';
import { mediaFromDoc } from '@/lib/server/serializers';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'media.view');
    const snapshot = await getAdminDb().collection('gifs').limit(300).get();
    const media = snapshot.docs.map(mediaFromDoc).sort((a, b) => a.id.localeCompare(b.id));
    return NextResponse.json({ media });
  } catch (error) {
    return apiError(error, 'Could not load media');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'media.upload');
    const body = mediaCreateSchema.parse(await request.json());
    const db = getAdminDb();
    const ref = db.collection('gifs').doc(body.label);
    await db.runTransaction(async (transaction) => {
      if ((await transaction.get(ref)).exists) throw new Error('CONFLICT');
      transaction.create(ref, { link: body.link, redirect: body.redirect });
    });
    await writeAudit(admin.uid, 'media.created', body.label, { source: 'url' });
    return NextResponse.json({ media: mediaFromDoc(await ref.get()) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Enter a valid label and HTTP URL' }, { status: 400 });
    if (error instanceof Error && error.message === 'CONFLICT') return NextResponse.json({ error: 'A GIF with that label already exists' }, { status: 409 });
    return apiError(error, 'Could not create GIF');
  }
}
