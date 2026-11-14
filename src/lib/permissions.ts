import { permissions } from '@/lib/types';
import type { Permission } from '@/lib/types';

// Each section of the dashboard has a ladder of access levels. A level includes
// everything below it. "Contribute" levels act on your own items only;
// "Administrator" levels act on everyone's. Add-ons are extra switches that
// only make sense from a certain level up.
export type AccessLevel = { id: string; label: string; summary: string; grants: Permission[] };
export type AccessAddon = { permission: Permission; label: string; summary: string; from: string; includedFrom?: string };
export type AccessSection = { id: string; label: string; levels: AccessLevel[]; addons?: AccessAddon[] };

const view = (permission: Permission, summary: string): AccessLevel => ({ id: 'view', label: 'View', summary, grants: [permission] });

export const accessSections: AccessSection[] = [
  { id: 'overview', label: 'Overview', levels: [view('overview.view', 'See hub stats and what needs attention.')] },
  { id: 'audit', label: 'Audit trail', levels: [view('audit.view', 'See who changed what.')] },
  {
    id: 'announcements',
    label: 'Announcements',
    levels: [
      view('announcements.view', 'See every announcement.'),
      { id: 'contribute', label: 'Contribute', summary: 'Post announcements and edit, hide or delete their own.', grants: ['announcements.contribute'] },
      { id: 'admin', label: 'Admin', summary: 'Edit, hide or delete anyone’s announcements.', grants: ['announcements.admin'] },
    ],
  },
  {
    id: 'guessr',
    label: 'Parkour Guessr',
    levels: [
      view('guessr.view', 'See every image and the map.'),
      { id: 'contribute', label: 'Contribute', summary: 'Upload images and edit, disable or delete their own. New images wait for review.', grants: ['guessr.contribute'] },
      { id: 'admin', label: 'Admin', summary: 'Parkour Guessr administrator: review, publish, edit and remove anyone’s images.', grants: ['guessr.admin'] },
    ],
    addons: [{ permission: 'guessr.publish', label: 'Publish own images', summary: 'Their own images skip review.', from: 'contribute', includedFrom: 'admin' }],
  },
  {
    id: 'media',
    label: 'GIFs',
    levels: [
      view('media.view', 'See the GIF library.'),
      { id: 'contribute', label: 'Contribute', summary: 'Add GIFs and edit or delete their own.', grants: ['media.contribute'] },
      { id: 'admin', label: 'Admin', summary: 'Edit or delete any GIF.', grants: ['media.admin'] },
    ],
  },
  { id: 'techs', label: 'Tech list', levels: [view('techs.view', 'See the tech list.'), { id: 'manage', label: 'Manage', summary: 'Add, edit, hide and delete techs.', grants: ['techs.manage'] }] },
  { id: 'timetrials', label: 'Time trials', levels: [view('timetrials.view', 'See time trials.'), { id: 'manage', label: 'Manage', summary: 'Add, edit, hide and delete time trials.', grants: ['timetrials.manage'] }] },
  { id: 'links', label: 'Links', levels: [view('links.view', 'See links.'), { id: 'manage', label: 'Manage', summary: 'Add, edit, hide and delete links.', grants: ['links.manage'] }] },
  { id: 'files', label: 'Files', levels: [view('files.view', 'See files.'), { id: 'manage', label: 'Manage', summary: 'Add, edit, hide and delete files.', grants: ['files.manage'] }] },
  { id: 'rebornai', label: 'Reborn AI', levels: [view('rebornai.view', 'See questions, answers and knowledge gaps.')] },
  {
    id: 'admins',
    label: 'Admins',
    levels: [
      view('admins.view', 'See who has access.'),
      { id: 'manage', label: 'Manage', summary: 'Add and change admins, but never beyond their own access.', grants: ['admins.manage'] },
    ],
  },
];

// What each permission brings with it.
const implies: Partial<Record<Permission, Permission[]>> = {
  'announcements.contribute': ['announcements.view'],
  'announcements.admin': ['announcements.contribute'],
  'guessr.contribute': ['guessr.view'],
  'guessr.publish': ['guessr.contribute'],
  'guessr.admin': ['guessr.publish'],
  'media.contribute': ['media.view'],
  'media.admin': ['media.contribute'],
  'techs.manage': ['techs.view'],
  'timetrials.manage': ['timetrials.view'],
  'links.manage': ['links.view'],
  'files.manage': ['files.view'],
  'admins.manage': ['admins.view'],
};

// Permission names from before access levels, translated on read so existing
// admins keep working until their record is saved again.
const legacy: Record<string, Permission[]> = {
  'guessr.images.create': ['guessr.contribute'],
  'guessr.images.edit': ['guessr.contribute'],
  'guessr.images.delete': ['guessr.contribute'],
  'guessr.images.publish': ['guessr.publish'],
  'announcements.manage': ['announcements.admin'],
  'media.upload': ['media.contribute'],
  'media.delete': ['media.admin'],
};

export const allPermissions = [...permissions] as Permission[];
export const isPermission = (value: unknown): value is Permission => permissions.includes(value as Permission);
export const hasPermission = (granted: readonly Permission[], permission: Permission) => granted.includes(permission);
export const includesAll = (granted: readonly Permission[], wanted: readonly Permission[]) => wanted.every((permission) => granted.includes(permission));

export function normalizePermissions(selected: readonly Permission[]): Permission[] {
  const result = new Set<Permission>();
  const visit = (permission: Permission) => {
    if (result.has(permission)) return;
    result.add(permission);
    implies[permission]?.forEach(visit);
  };
  selected.forEach(visit);
  return allPermissions.filter((permission) => result.has(permission));
}

export const readPermissions = (value: unknown): Permission[] => normalizePermissions(
  (Array.isArray(value) ? value : []).flatMap((item) => isPermission(item) ? [item] : legacy[String(item)] ?? []),
);

const sectionPermissions = (section: AccessSection) => normalizePermissions([
  ...section.levels.flatMap((level) => level.grants),
  ...(section.addons ?? []).map((addon) => addon.permission),
]);

const levelIndex = (section: AccessSection, id: string) => section.levels.findIndex((level) => level.id === id);

// Highest level fully granted in a section, or -1 for no access.
export function levelOf(section: AccessSection, granted: readonly Permission[]) {
  for (let index = section.levels.length - 1; index >= 0; index -= 1) {
    if (includesAll(granted, normalizePermissions(section.levels[index].grants))) return index;
  }
  return -1;
}

export const levelGrants = (section: AccessSection, index: number) => index < 0 ? [] : normalizePermissions(section.levels[index].grants);

export const addonState = (section: AccessSection, addon: AccessAddon, granted: readonly Permission[]) => {
  const level = levelOf(section, granted);
  const included = addon.includedFrom !== undefined && level >= levelIndex(section, addon.includedFrom);
  const available = level >= levelIndex(section, addon.from);
  return { on: included || (available && granted.includes(addon.permission)), included, available };
};

export function setLevel(section: AccessSection, granted: readonly Permission[], index: number) {
  const owned = sectionPermissions(section);
  const previous = levelGrants(section, levelOf(section, granted));
  // Keep add-ons that were switched on by hand and still fit the new level;
  // drop ones that only came with the old level.
  const addons = (section.addons ?? []).filter((addon) => granted.includes(addon.permission)
    && !previous.includes(addon.permission)
    && index >= levelIndex(section, addon.from)).map((addon) => addon.permission);
  return normalizePermissions([
    ...granted.filter((permission) => !owned.includes(permission)),
    ...levelGrants(section, index),
    ...addons,
  ]);
}

export function setAddon(section: AccessSection, granted: readonly Permission[], addon: AccessAddon, on: boolean) {
  const base = granted.filter((permission) => permission !== addon.permission);
  return normalizePermissions([...base, ...(on ? [addon.permission] : [])]);
}

// Short badges for the admins table, e.g. "Parkour Guessr: Admin".
export function accessSummary(granted: readonly Permission[]) {
  return accessSections.flatMap((section) => {
    const level = levelOf(section, granted);
    if (level < 0) return [];
    const extras = (section.addons ?? []).filter((addon) => {
      const state = addonState(section, addon, granted);
      return state.on && !state.included;
    }).map((addon) => addon.label);
    return [{ section: section.label, level: section.levels[level].label, top: level === section.levels.length - 1 && level > 0, extras }];
  });
}
