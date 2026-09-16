import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getActiveGuessrMap } from '@/lib/server/guessr-schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'guessr.view');
    return NextResponse.json({ map: await getActiveGuessrMap() });
  } catch (error) {
    return apiError(error, 'Could not load the active Guessr map');
  }
}
