import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/server/firebase-admin';

export const runtime = "nodejs";

const maxAge = 10 * 60;

export async function POST() {
  try {
    const clientId = process.env.DISCORD_CLIENT_ID;
    const redirectUri = process.env.DISCORD_REDIRECT_URI;
    if (!clientId || !redirectUri) throw new Error('Discord environment is missing');

    const state = randomBytes(32).toString('hex');
    const expiresAtMs = Date.now() + maxAge * 1000;
    await getAdminDb().collection('adminAuthStates').doc(state).set({
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(expiresAtMs),
      expiresAtMs,
    });

    const url = new URL('https://discord.com/oauth2/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'identify');
    url.searchParams.set('state', state);

    const response = NextResponse.json({ url: url.toString() });
    response.cookies.set('admin_discord_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge,
      path: '/',
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Could not start Discord login' }, { status: 503 });
  }
}
