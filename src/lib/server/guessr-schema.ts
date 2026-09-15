import { z } from 'zod';

export const pointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const imageMetaSchema = z.object({
  mode: z.enum(['classic', 'graffiti']),
  difficulty: z.enum(['normal', 'hard']),
  targetType: z.enum(['player', 'graffiti']),
  coordinates: pointSchema,
  mapVersionId: z.string().trim().min(1).max(100),
});

export const imagePatchSchema = imageMetaSchema.partial().strict();
