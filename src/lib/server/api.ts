import 'server-only';

import { NextResponse } from 'next/server';
import { AdminAuthError } from '@/lib/server/admin-auth';
import { GuessrMapError } from '@/lib/server/guessr-schema';

export function apiError(error: unknown, fallback = 'Request failed') {
  if (error instanceof AdminAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof GuessrMapError) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ error: fallback }, { status: 500 });
}
