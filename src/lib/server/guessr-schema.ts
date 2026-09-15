import { z } from 'zod';

export const guessrMapVersionId = 'main-v1';

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
