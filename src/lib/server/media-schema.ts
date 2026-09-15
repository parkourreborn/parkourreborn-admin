import { z } from 'zod';

export const mediaMimeTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/webp'] as const;
export const maxMediaBytes = 4 * 1024 * 1024;

export const mediaUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(mediaMimeTypes),
  bytes: z.number().int().positive().max(maxMediaBytes),
  displayName: z.string().trim().min(1).max(120),
  altText: z.string().trim().max(240).default(''),
  category: z.string().trim().max(80).default(''),
  description: z.string().trim().max(500).default(''),
}).strict();

export const mediaPatchSchema = z.object({
  displayName: z.string().trim().min(1).max(120).optional(),
  altText: z.string().trim().max(240).optional(),
  category: z.string().trim().max(80).optional(),
  description: z.string().trim().max(500).optional(),
  active: z.boolean().optional(),
}).strict();
