import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { auditFromDoc } from '@/lib/server/serializers';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'overview.view');
    const db = getAdminDb();
    const [published, maps, logs] = await Promise.all([
      db.collection('guessrImages').where('status', '==', 'published').count().get(),
      db.collection('guessrMaps').where('active', '==', true).limit(1).get(),
      db.collection('guessrAuditLogs').orderBy('createdAt', 'desc').limit(6).get(),
    ]);
    const map = maps.docs[0];
    return NextResponse.json({
      sections: 3,
      games: 1,
      activeImages: published.data().count,
      mapVersion: map?.id || null,
      activity: logs.docs.map(auditFromDoc),
    });
  } catch (error) {
    return apiError(error, 'Could not load overview');
  }
}
