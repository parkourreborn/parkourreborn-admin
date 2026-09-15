import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { authenticateAdmin } from '@/lib/server/admin-auth';

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { admin } = await authenticateAdmin(request.headers.get('authorization'));
    return NextResponse.json({ admin });
  } catch (error) {
    return apiError(error, 'Could not load admin profile');
  }
}
