import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { rebornAiDetailFromDoc } from '@/lib/server/reborn-ai';

export const runtime = 'nodejs';

// One Reborn AI request in full: the facts the model was given, Jev's
// signals, every model attempt and the stage timings.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'rebornai.view');
    const { id } = await params;
    if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    const doc = await getAdminDb().collection('aiLogs').doc(id).get();
    if (!doc.exists) return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    return NextResponse.json({ log: rebornAiDetailFromDoc(doc) }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiError(error, 'Could not load this request');
  }
}
