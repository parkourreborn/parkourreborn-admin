import { NextResponse } from 'next/server';
import { hasFirebaseAdminEnv } from '@/lib/server/firebase-admin';
import { getActiveGuessrMap, GuessrMapError } from '@/lib/server/guessr-schema';
import { hasR2Env } from '@/lib/server/r2';

export const runtime = "nodejs";
export const dynamic = 'force-dynamic';

export async function GET() {
  const firebaseAdmin = hasFirebaseAdminEnv();
  let map = false;
  let mapError = '';
  if (firebaseAdmin) {
    try {
      await getActiveGuessrMap();
      map = true;
    } catch (error) {
      mapError = error instanceof GuessrMapError ? error.message : 'Could not load the active Guessr map.';
    }
  }

  return NextResponse.json({
    firebaseClient: Boolean(
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY
      && process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
      && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      && process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    ),
    firebaseAdmin,
    discord: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_REDIRECT_URI),
    r2: hasR2Env(),
    map,
    mapError,
  });
}
