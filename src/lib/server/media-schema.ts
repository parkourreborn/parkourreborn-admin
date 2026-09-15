import { z } from 'zod';
import { documentIdSchema } from '@/lib/server/content-sections';

export const mediaMimeTypes = ['image/gif', 'image/png', 'image/jpeg', 'image/webp'] as const;
export const maxMediaBytes = 4 * 1024 * 1024;
const httpUrl = z.string().trim().url().refine((value) => /^https?:\/\//i.test(value), 'Only HTTP URLs are allowed');
const optionalHttpUrl = z.union([z.literal(''), httpUrl]);

export const mediaUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(180),
  contentType: z.enum(mediaMimeTypes),
  bytes: z.number().int().positive().max(maxMediaBytes),
  label: documentIdSchema,
  redirect: optionalHttpUrl.default(''),
  replaceId: documentIdSchema.optional(),
}).strict();

export const mediaCreateSchema = z.object({
  label: documentIdSchema,
  link: httpUrl,
  redirect: optionalHttpUrl.default(''),
}).strict();

export const mediaPatchSchema = z.object({
  label: documentIdSchema.optional(),
  link: httpUrl.optional(),
  redirect: optionalHttpUrl.optional(),
}).strict();
