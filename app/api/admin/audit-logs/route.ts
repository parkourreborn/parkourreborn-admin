import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { auditFromDoc } from '@/lib/server/serializers';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'overview.view');
    const docs = await getAdminDb().collection('guessrAuditLogs').orderBy('createdAt', 'desc').limit(50).get();
    return NextResponse.json({ logs: docs.docs.map(auditFromDoc) });
  } catch (error) {
    return apiError(error, 'Could not load audit logs');
  }
}
