import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { loadPeople } from '@/lib/server/people';
import { auditFromDoc } from '@/lib/server/serializers';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'audit.view');
    const [docs, people] = await Promise.all([
      getAdminDb().collection('guessrAuditLogs').orderBy('createdAt', 'desc').limit(50).get(),
      loadPeople(),
    ]);
    return NextResponse.json({ logs: docs.docs.map(auditFromDoc), people });
  } catch (error) {
    return apiError(error, 'Could not load audit logs');
  }
}
