import { randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { AdminAuthError, bootstrapOwner, loadAdmin } from '@/lib/server/admin-auth';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';

export const runtime = "nodejs";

type DiscordUser = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
};

const loginMaxAge = 5 * 60;
const uidFor = (discordId: string) => `discord-${discordId}`;

const redirect = (request: NextRequest, status: string) => {
  const url = new URL('/overview', request.url);
  url.searchParams.set('auth', status);
  return url;
};

async function exchange(code: string) {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error('Discord environment is missing');

  const response = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
  });
  if (!response.ok) throw new Error('Discord token exchange failed');
  return response.json() as Promise<{ access_token: string }>;
}

async function profile(accessToken: string) {
  const response = await fetch('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error('Discord user fetch failed');
  return response.json() as Promise<DiscordUser>;
}

async function syncUser(uid: string, user: DiscordUser) {
  const displayName = user.global_name || user.username;
  const photoURL = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : undefined;
  const data = photoURL ? { displayName, photoURL } : { displayName };
  try {
    await getAdminAuth().updateUser(uid, data);
  } catch {
    await getAdminAuth().createUser({ uid, ...data });
  }
  return { displayName, avatarUrl: photoURL || null };
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookieState = request.cookies.get('admin_discord_oauth_state')?.value;
  if (!code || !state || state !== cookieState) return NextResponse.redirect(redirect(request, 'error'));

  try {
    const db = getAdminDb();
    const stateRef = db.collection('adminAuthStates').doc(state);
    const stateDoc = await stateRef.get();
    if (!stateDoc.exists || Number(stateDoc.data()?.expiresAtMs || 0) < Date.now()) {
      await stateRef.delete().catch(() => undefined);
      return NextResponse.redirect(redirect(request, 'expired'));
    }

    const token = await exchange(code);
    const user = await profile(token.access_token);
    const uid = uidFor(user.id);
    const account = {
      displayName: user.global_name || user.username,
      avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128` : null,
    };
    const existing = await db.collection('admins').doc(uid).get();
    if (!existing.exists) await bootstrapOwner(uid, user.id, account);
    const admin = await loadAdmin(uid, user.id);
    await syncUser(uid, user);
    await db.collection('admins').doc(uid).set({
      displayName: account.displayName,
      avatarUrl: account.avatarUrl,
      discordId: user.id,
      discordUsername: user.username,
      lastLoginAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const login = randomBytes(32).toString('hex');
    const expiresAtMs = Date.now() + loginMaxAge * 1000;
    await db.collection('adminLoginSessions').doc(login).set({
      uid,
      discordId: user.id,
      permissions: admin.permissions,
      expiresAt: new Date(expiresAtMs),
      expiresAtMs,
      createdAt: FieldValue.serverTimestamp(),
    });
    await stateRef.delete();

    const response = NextResponse.redirect(redirect(request, 'linked'));
    response.cookies.delete('admin_discord_oauth_state');
    response.cookies.set('admin_discord_login', login, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: loginMaxAge,
      path: '/',
    });
    return response;
  } catch (error) {
    const destination = error instanceof AdminAuthError
      ? new URL('https://parkourreborn.com')
      : redirect(request, 'error');
    const response = NextResponse.redirect(destination);
    response.cookies.delete('admin_discord_oauth_state');
    response.cookies.delete('admin_discord_login');
    return response;
  }
}
