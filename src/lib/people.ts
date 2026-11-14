import type { People } from '@/lib/types';

// The public site's account deletion replaces user IDs with this text.
const deletedAccount = 'Deleted account';

export function personName(people: People, uid: string | null | undefined) {
  if (!uid) return 'Unknown';
  if (uid === deletedAccount) return deletedAccount;
  return people[uid]?.name ?? uid.replace(/^discord-/, '');
}
