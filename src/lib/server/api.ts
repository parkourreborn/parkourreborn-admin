import 'server-only';

import { NextResponse } from 'next/server';
import { AdminAuthError } from '@/lib/server/admin-auth';

export function apiError(error: unknown, fallback = 'Request failed') {
  if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: fallback }, { status: 500 });
}
