import 'server-only';

export const OWNER_DISCORD_ID = '1020704620722528256';
export const OWNER_UID = 'discord-1020704620722528256';

export const isOwnerIdentity = (uid: string, discordId?: string) => uid === OWNER_UID && discordId === OWNER_DISCORD_ID;
