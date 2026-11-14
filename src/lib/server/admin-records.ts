import 'server-only';

import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { z } from 'zod';
import { readPermissions } from '@/lib/permissions';
import { OWNER_UID } from '@/lib/server/owner';
import type { Permission } from '@/lib/types';

export type AdminRecord = {
  uid: string;
  discordId: string;
  displayName: string;
  avatarUrl: string | null;
  disabled: boolean;
  permissions: Permission[];
  isOwner: boolean;
  signedIn: boolean;
};

export const uidForDiscordId = (discordId: string) => `discord-${discordId}`;

// Accepts a raw Discord user ID, and also the forms people tend to paste:
// "discord-123…", "<@123…>" or "<@!123…>".
export const discordIdSchema = z.string()
  .trim()
  .transform((value) => value.replace(/^discord-/i, '').replace(/^<@!?/, '').replace(/>$/, '').trim())
  .pipe(z.string().regex(/^\d{17,20}$/, 'Enter a Discord user ID (17–20 digits)'));

export const adminFromDoc = (doc: DocumentSnapshot): AdminRecord => {
  const data = doc.data() || {};
  const discordId = typeof data.discordId === 'string' && data.discordId ? data.discordId : doc.id.replace(/^discord-/, '');
  return {
    uid: doc.id,
    discordId,
    displayName: typeof data.displayName === 'string' && data.displayName ? data.displayName : discordId,
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : null,
    disabled: data.disabled === true,
    permissions: readPermissions(data.permissions),
    isOwner: doc.id === OWNER_UID,
    signedIn: Boolean(data.lastLoginAt),
  };
};
