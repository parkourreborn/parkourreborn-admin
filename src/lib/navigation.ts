import type { Permission } from '@/lib/types';

export type NavigationIcon = 'overview' | 'games' | 'guessr' | 'content' | 'announcement' | 'techs' | 'trials' | 'media' | 'links' | 'files' | 'audit' | 'admins';

export type NavigationItem = {
  label: string;
  href: string;
  permission: Permission;
  icon: NavigationIcon;
};

export type NavigationGroup = {
  label?: string;
  icon?: NavigationIcon;
  items: NavigationItem[];
};

export const navigation: NavigationGroup[] = [
  { items: [{ label: 'Overview', href: '/overview', permission: 'overview.view', icon: 'overview' }] },
  {
    label: 'Games',
    icon: 'games',
    items: [{ label: 'Parkour Guessr', href: '/games/parkourguessr', permission: 'guessr.view', icon: 'guessr' }],
  },
  {
    label: 'Hub Content',
    icon: 'content',
    items: [
      { label: 'Announcements', href: '/hub/announcements', permission: 'announcements.view', icon: 'announcement' },
      { label: 'Tech List', href: '/hub/techs', permission: 'techs.view', icon: 'techs' },
      { label: 'Time Trials', href: '/hub/timetrials', permission: 'timetrials.view', icon: 'trials' },
      { label: 'Media / GIFs', href: '/hub/media', permission: 'media.view', icon: 'media' },
      { label: 'Links', href: '/hub/links', permission: 'links.view', icon: 'links' },
      { label: 'Files', href: '/hub/files', permission: 'files.view', icon: 'files' },
    ],
  },
  { items: [{ label: 'Audit Trail', href: '/audit', permission: 'audit.view', icon: 'audit' }] },
  { items: [{ label: 'Admins & Permissions', href: '/admins', permission: 'admins.view', icon: 'admins' }] },
];

export function titleForPath(pathname: string) {
  const items = navigation.flatMap((group) => group.items);
  return items.find((item) => pathname === item.href || (item.href !== '/overview' && pathname.startsWith(`${item.href}/`)))?.label || 'Overview';
}
