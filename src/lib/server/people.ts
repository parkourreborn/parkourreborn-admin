import 'server-only';

import { getAdminDb } from '@/lib/server/firebase-admin';
import type { People } from '@/lib/types';

// Admin names and avatars keyed by UID. Names are the admin's Discord ID until
// they first sign in, when the Discord callback stores their Discord name.
export async function loadPeople(): Promise<People> {
  const docs = await getAdminDb().collection('admins').limit(200).get();
  return Object.fromEntries(docs.docs.map((doc) => {
    const data = doc.data();
    return [doc.id, {
      name: typeof data.displayName === 'string' && data.displayName ? data.displayName : doc.id.replace(/^discord-/, ''),
      avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
    }];
  }));
}
