import type { Permission } from '@/lib/types';

export type ContentField = {
  key: string;
  label: string;
  type: 'text' | 'url' | 'textarea' | 'list' | 'select' | 'number' | 'checkbox';
  required?: boolean;
  options?: { value: string; label: string }[];
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
};

export const contentManagerConfigs: Record<ContentManagerConfig['section'], ContentManagerConfig> = {
  techs: {
    section: 'techs', singular: 'tech', viewPermission: 'techs.view', managePermission: 'techs.manage', hasStatus: true,
    fields: [
      { key: 'Kind', label: 'Kind', type: 'select', required: true, options: [{ value: 'tech', label: 'Tech' }, { value: 'concept', label: 'Concept' }, { value: 'basic', label: 'Basic' }] },
      { key: 'Aliases', label: 'Aliases', type: 'list' },
      { key: 'Steps', label: 'Steps', type: 'list' },
      { key: 'VideoUrl', label: 'Video URL', type: 'url' },
      { key: 'TutorialUrl', label: 'Tutorial URL', type: 'url' },
    ],
    columns: [{ key: 'Kind', label: 'Kind' }, { key: 'Aliases', label: 'Aliases' }, { key: 'Steps', label: 'Steps' }],
    defaults: { Kind: 'tech', Aliases: [], Steps: [], VideoUrl: '', TutorialUrl: '', active: true },
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
