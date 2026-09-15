import { z } from 'zod';

const expiry = z.union([z.string().datetime(), z.null()]);

export const announcementSchema = z.object({
  title: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(320),
  active: z.boolean(),
  expiresAt: expiry,
}).strict();

export const announcementPatchSchema = announcementSchema.partial().strict();
