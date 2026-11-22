import type { Permission } from '@/lib/types';

type Draft = Record<string, unknown>;

export type ContentField = {
  key: string;
  label: string;
  type: 'text' | 'url' | 'textarea' | 'list' | 'select' | 'number' | 'checkbox' | 'urls';
  required?: boolean;
  options?: { value: string; label: string }[];
  visible?: (draft: Draft) => boolean;
  hideOption?: (value: string, draft: Draft) => boolean;
};

export type ContentManagerConfig = {
  section: 'techs' | 'timetrials' | 'links' | 'files';
  singular: string;
  viewPermission: Permission;
  managePermission: Permission;
  fields: ContentField[];
  columns: { key: string; label: string }[];
  defaults: Record<string, unknown>;
  hasStatus: boolean;
  // Runs on every form change with the draft before it.
  normalize?: (next: Draft, previous: Draft) => Draft;
};

const endingSteps = /^(coyote time)>(powerslide\*)>(jump\*)$/;

// Picking a tech's usual ending drops the old "Powerslide* > Jump*" steps after
// Coyote Time. Changing it swaps the clips: VideoUrl always shows the usual
// ending, EndingVideos the others.
function techDraft(next: Draft, previous: Draft): Draft {
  const from = String(previous.Ending ?? '');
  const to = String(next.Ending ?? '');
  if (from === to) return next;
  if (!to) return { ...next, EndingVideos: {} };
  const steps = Array.isArray(next.Steps) ? next.Steps.map(String) : [];
  const tail = steps.slice(-3).map((step) => step.trim().toLowerCase()).join('>');
  const draft = { ...next, Steps: endingSteps.test(tail) ? steps.slice(0, -2) : steps };
  const videos = { ...(next.EndingVideos as Record<string, string> | undefined) };
  if (!from || !videos[to]) return { ...draft, EndingVideos: videos };
  const usual = videos[to];
  delete videos[to];
  return { ...draft, VideoUrl: usual, EndingVideos: { ...videos, [from]: String(next.VideoUrl ?? '') } };
}

export const contentManagerConfigs: Record<ContentManagerConfig['section'], ContentManagerConfig> = {
  techs: {
    section: 'techs', singular: 'tech', viewPermission: 'techs.view', managePermission: 'techs.manage', hasStatus: true,
    fields: [
      { key: 'Kind', label: 'Kind', type: 'select', required: true, options: [{ value: 'tech', label: 'Tech' }, { value: 'concept', label: 'Concept' }, { value: 'basic', label: 'Basic' }] },
      { key: 'Aliases', label: 'Aliases', type: 'list' },
      { key: 'Steps', label: 'Steps', type: 'list' },
      { key: 'Ending', label: 'Usual ending', type: 'select', options: [{ value: '', label: '—' }, { value: 'Powerslide', label: 'Powerslide' }, { value: 'Jump', label: 'Jump' }, { value: 'Slide Jump', label: 'Slide Jump' }] },
      { key: 'VideoUrl', label: 'Video URL', type: 'url' },
      {
        key: 'EndingVideos',
        label: 'Other ending clips',
        type: 'urls',
        options: [{ value: 'Powerslide', label: 'Powerslide' }, { value: 'Jump', label: 'Jump' }, { value: 'Slide Jump', label: 'Slide Jump' }, { value: 'None', label: 'No ending' }],
        visible: (draft) => Boolean(draft.Ending),
        hideOption: (value, draft) => value === draft.Ending,
      },
      { key: 'TutorialUrl', label: 'Tutorial URL', type: 'url' },
    ],
    columns: [{ key: 'Kind', label: 'Kind' }, { key: 'Aliases', label: 'Aliases' }, { key: 'Steps', label: 'Steps' }, { key: 'Ending', label: 'Ending' }],
    defaults: { Kind: 'tech', Aliases: [], Steps: [], Ending: '', VideoUrl: '', EndingVideos: {}, TutorialUrl: '', active: true },
    normalize: techDraft,
  },
  timetrials: {
    section: 'timetrials', singular: 'time trial', viewPermission: 'timetrials.view', managePermission: 'timetrials.manage', hasStatus: true,
    fields: [
      { key: 'district', label: 'District', type: 'text', required: true },
      { key: 'difficulty', label: 'Difficulty', type: 'text', required: true },
      { key: 'bronzeTime', label: 'Bronze', type: 'text' },
      { key: 'silverTime', label: 'Silver', type: 'text' },
      { key: 'goldTime', label: 'Gold', type: 'text' },
      { key: 'platinumTime', label: 'Platinum', type: 'text' },
      { key: 'videoURL', label: 'Video URL', type: 'url' },
      { key: 'videoURL2', label: 'Video URL 2', type: 'url' },
      { key: 'sorting', label: 'Sorting', type: 'number', required: true },
    ],
    columns: [{ key: 'district', label: 'District' }, { key: 'difficulty', label: 'Difficulty' }, { key: 'platinumTime', label: 'Platinum' }, { key: 'sorting', label: 'Sort' }],
    defaults: { bronzeTime: '', silverTime: '', goldTime: '', platinumTime: '', videoURL: '', videoURL2: '', difficulty: '', district: '', sorting: 0, active: true },
  },
  links: {
    section: 'links', singular: 'link', viewPermission: 'links.view', managePermission: 'links.manage', hasStatus: true,
    fields: [{ key: 'link', label: 'URL', type: 'url', required: true }, { key: 'description', label: 'Description', type: 'textarea' }],
    columns: [{ key: 'link', label: 'URL' }, { key: 'description', label: 'Description' }],
    defaults: { link: '', description: '', active: true },
  },
  files: {
    section: 'files', singular: 'file', viewPermission: 'files.view', managePermission: 'files.manage', hasStatus: true,
    fields: [{ key: 'link', label: 'URL', type: 'url', required: true }, { key: 'description', label: 'Description', type: 'textarea' }, { key: 'downloadable', label: 'Download directly', type: 'checkbox' }],
    columns: [{ key: 'link', label: 'URL' }, { key: 'description', label: 'Description' }, { key: 'downloadable', label: 'Download' }],
    defaults: { link: '', description: '', downloadable: false, active: true },
  },
};
