import type { Permission } from '@/lib/types';

export type NavigationItem = {
  label: string;
  href: string;
  permission: Permission;
  image: string;
};

export type NavigationSection = {
  title: string;
  items: NavigationItem[];
};

const bg = '/backgrounds';

// The admin's pages, grouped like the hub's Tab menu.
export const navigation: NavigationSection[] = [
  {
    title: 'Hub',
    items: [
      { label: 'Announcements', href: '/hub/announcements', permission: 'announcements.view', image: `${bg}/community/bg.webp` },
      { label: 'Tech List', href: '/hub/techs', permission: 'techs.view', image: `${bg}/tools/techlist.webp` },
      { label: 'Time Trials', href: '/hub/timetrials', permission: 'timetrials.view', image: `${bg}/tools/timetrialhub.webp` },
      { label: 'GIFs', href: '/hub/media', permission: 'media.view', image: `${bg}/community/search.webp` },
      { label: 'Links', href: '/hub/links', permission: 'links.view', image: `${bg}/links/discord.webp` },
      { label: 'Files', href: '/hub/files', permission: 'files.view', image: `${bg}/links/wiki.webp` },
    ],
  },
  {
    title: 'Games',
    items: [
      { label: 'Parkour Guessr', href: '/games/parkourguessr', permission: 'guessr.view', image: `${bg}/games/parkourguessr.webp` },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Overview', href: '/overview', permission: 'overview.view', image: `${bg}/header.webp` },
      { label: 'Reborn AI', href: '/rebornai', permission: 'rebornai.view', image: `${bg}/tools/rebornai.webp` },
      { label: 'Audit Trail', href: '/audit', permission: 'audit.view', image: `${bg}/community/contributions.webp` },
      { label: 'Admins', href: '/admins', permission: 'admins.view', image: `${bg}/links/roblox.webp` },
    ],
  },
];

export function itemForPath(pathname: string) {
  return navigation
    .flatMap((section) => section.items)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
