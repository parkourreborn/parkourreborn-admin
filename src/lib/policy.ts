import { includesAll } from '@/lib/permissions';
import type { GuessrImage, Permission } from '@/lib/types';

// Who may do what to which item. Pure functions shared by the API routes (the
// real check) and the UI (to show or explain buttons), so both always agree.

export type Actor = { uid: string; permissions: readonly Permission[]; isOwner?: boolean };

// kind: "forbidden" = not allowed for this person (403); "state" = not possible
// in the item's current state (409). visible: the UI should still show the
// control, disabled, with the reason, because it is the person's own item.
export type Verdict = { ok: true } | { ok: false; reason: string; kind: 'forbidden' | 'state'; visible: boolean };

const allow: Verdict = { ok: true };
const deny = (reason: string, kind: 'forbidden' | 'state' = 'forbidden', visible = false): Verdict => ({ ok: false, reason, kind, visible });
const has = (actor: Actor, permission: Permission) => actor.permissions.includes(permission);

/* ---------- Parkour Guessr ---------- */

export type GuessrAction = 'edit' | 'publish' | 'disable' | 'restore' | 'delete';
export type GuessrTarget = Pick<GuessrImage, 'createdBy' | 'status' | 'disabledBy' | 'everPublished'>;

export const isGuessrAdmin = (actor: Actor) => has(actor, 'guessr.admin');
export const ownsImage = (actor: Actor, image: Pick<GuessrImage, 'createdBy'>) => Boolean(image.createdBy) && image.createdBy === actor.uid;
export const canPublishImage = (actor: Actor, image: Pick<GuessrImage, 'createdBy'>) => isGuessrAdmin(actor) || (ownsImage(actor, image) && has(actor, 'guessr.publish'));

const notYourImage = deny('Only a Parkour Guessr administrator can change other people’s images.');

export function guessrCan(actor: Actor, action: GuessrAction, image: GuessrTarget): Verdict {
  const admin = isGuessrAdmin(actor);
  const own = ownsImage(actor, image) && has(actor, 'guessr.contribute');

  switch (action) {
    case 'edit':
      if (image.status === 'disabled') return deny('Restore this image before editing it.', 'state');
      return admin || own ? allow : notYourImage;
    case 'publish':
      if (image.status !== 'draft') return deny('Only drafts can be published.', 'state');
      if (canPublishImage(actor, image)) return allow;
      return own ? deny('Waiting for a Parkour Guessr administrator to review it.', 'forbidden', true) : notYourImage;
    case 'disable':
      if (image.status === 'disabled') return deny('This image is already disabled.', 'state');
      return admin || own ? allow : notYourImage;
    case 'restore':
      if (image.status !== 'disabled') return deny('This image is not disabled.', 'state');
      if (admin) return allow;
      if (!own) return notYourImage;
      return image.disabledBy === actor.uid
        ? allow
        : deny('A Parkour Guessr administrator disabled this image, so only an administrator can restore it.', 'forbidden', true);
    case 'delete':
      if (image.status !== 'disabled') return deny('Disable this image before deleting it permanently.', 'state');
      if (admin) return allow;
      if (!own) return notYourImage;
      return image.everPublished
        ? deny('This image has been in the game, so only a Parkour Guessr administrator can delete it permanently.', 'forbidden', true)
        : allow;
  }
}

// Changing where (or in which pool) a live image is placed changes the answer
// for players, so it goes back to review unless the editor could publish it.
export const editKeepsPublished = (actor: Actor, image: Pick<GuessrImage, 'createdBy'>) => canPublishImage(actor, image);

/* ---------- Owned items: announcements and GIFs ---------- */

export type OwnedSection = 'announcements' | 'media';

const sectionNames: Record<OwnedSection, string> = { announcements: 'announcements', media: 'GIFs' };

export function ownedCan(actor: Actor, section: OwnedSection, createdBy: string | null | undefined): Verdict {
  if (has(actor, `${section}.admin`)) return allow;
  if (!has(actor, `${section}.contribute`)) return deny(`You can’t change ${sectionNames[section]}.`);
  if (createdBy && createdBy === actor.uid) return allow;
  return deny(`You can only change your own ${sectionNames[section]}.`);
}

/* ---------- Admins ---------- */

export type AdminTarget = { uid: string; isOwner: boolean; permissions: readonly Permission[] };

// Managing admins never lets anyone hand out more than they have themselves.
export function adminManageCan(actor: Actor, target: AdminTarget | null, requested?: readonly Permission[]): Verdict {
  if (target?.isOwner) return deny('The owner account is protected.');
  if (actor.isOwner) return allow;
  if (!has(actor, 'admins.manage')) return deny('Only the owner or admins with Admins: Manage can change admins.');
  if (target && target.uid === actor.uid) return deny('You can’t change your own access.');
  if (target && !includesAll(actor.permissions, target.permissions)) return deny('They have access you don’t, so you can’t change them.');
  if (requested && !includesAll(actor.permissions, requested)) return deny('You can only give access you have yourself.');
  if (requested?.includes('admins.manage') && !target?.permissions.includes('admins.manage')) return deny('Only the owner can let others manage admins.');
  return allow;
}
