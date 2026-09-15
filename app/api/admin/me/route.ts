import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'overview.view');
    return NextResponse.json({ admin });
  } catch (error) {
    return apiError(error, 'Could not load admin profile');
  }
}
