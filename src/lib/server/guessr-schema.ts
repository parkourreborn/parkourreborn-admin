import { z } from 'zod';
import { getAdminDb } from '@/lib/server/firebase-admin';
import type { GuessrMap } from '@/lib/types';

export class GuessrMapError extends Error {}

const mapSchema = z.object({
  url: z.string().url(),
  width: z.coerce.number().int().positive(),
  height: z.coerce.number().int().positive(),
  active: z.literal(true),
});

export async function getActiveGuessrMap(): Promise<GuessrMap> {
  const maps = await getAdminDb().collection('guessrMaps').where('active', '==', true).limit(2).get();
  if (maps.empty) throw new GuessrMapError('No active Guessr map was found. Set exactly one guessrMaps document to active.');
  if (maps.size > 1) throw new GuessrMapError('Multiple active Guessr maps were found. Keep exactly one guessrMaps document active.');
  const map = mapSchema.safeParse(maps.docs[0].data());
  if (!map.success) throw new GuessrMapError('The active Guessr map must have a valid url, width, height, and active flag.');
  return { id: maps.docs[0].id, url: map.data.url, width: map.data.width, height: map.data.height };
}

export const pointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const imageMetaSchema = z.object({
  mode: z.enum(['classic', 'graffiti']),
  difficulty: z.enum(['normal', 'hard']),
  coordinates: pointSchema,
});

export const imagePatchSchema = imageMetaSchema.partial().strict();
