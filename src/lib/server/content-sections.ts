import 'server-only';

import { z } from 'zod';
import type { Permission } from '@/lib/types';

const shortText = z.string().trim().max(160);
const url = z.union([z.literal(''), z.string().trim().url().refine((value) => /^https?:\/\//i.test(value), 'Only HTTP URLs are allowed')]);
const active = z.boolean();

const tech = z.object({
  Kind: z.enum(['tech', 'concept', 'basic']),
  Aliases: z.array(shortText.min(1)).max(40),
  Steps: z.array(z.string().trim().min(1).max(500)).max(80),
  VideoUrl: url,
  TutorialUrl: url,
  active,
}).strict();

const trial = z.object({
  bronzeTime: shortText,
  silverTime: shortText,
  goldTime: shortText,
  platinumTime: shortText,
  videoURL: url,
  videoURL2: url,
  difficulty: shortText.min(1),
  district: shortText.min(1),
  sorting: z.number().finite().min(-100000).max(100000),
  active,
}).strict();

const link = z.object({
  link: url.refine(Boolean, 'URL is required'),
  description: z.string().trim().max(500),
  active,
}).strict();

const file = link.extend({ downloadable: z.boolean() }).strict();

export const contentSections = {
  techs: { collection: 'movement', view: 'techs.view', manage: 'techs.manage', schema: tech },
  timetrials: { collection: 'timetrials', view: 'timetrials.view', manage: 'timetrials.manage', schema: trial },
  links: { collection: 'links', view: 'links.view', manage: 'links.manage', schema: link },
  files: { collection: 'files', view: 'files.view', manage: 'files.manage', schema: file },
} satisfies Record<string, { collection: string; view: Permission; manage: Permission; schema: z.ZodObject<any> }>;

export type ContentSection = keyof typeof contentSections;
export const isContentSection = (value: string): value is ContentSection => value in contentSections;

export const documentIdSchema = z.string().trim().min(1).max(120)
  .refine((value) => !/[\/\u0000-\u001f]/.test(value) && value !== '.' && value !== '..', 'Invalid document name');
