import { NextRequest, NextResponse } from 'next/server';
import { loadAdmin } from '@/lib/server/admin-auth';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const login = request.cookies.get('admin_discord_login')?.value;
    if (!login) return NextResponse.json({ token: null });

    const ref = getAdminDb().collection('adminLoginSessions').doc(login);
    const doc = await ref.get();
    const data = doc.data();
    if (!doc.exists || typeof data?.uid !== 'string' || typeof data.discordId !== 'string' || Number(data.expiresAtMs || 0) < Date.now()) {
      await ref.delete().catch(() => undefined);
      const response = NextResponse.json({ token: null });
      response.cookies.delete('admin_discord_login');
      return response;
    }

    await loadAdmin(data.uid, data.discordId);
    const token = await getAdminAuth().createCustomToken(data.uid, { provider: 'discord', discordId: data.discordId });
    await ref.delete();
    const response = NextResponse.json({ token });
    response.cookies.delete('admin_discord_login');
    return response;
  } catch {
    return NextResponse.json({ token: null });
  }
}
