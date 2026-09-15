'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell, ChevronDown, ChevronLeft, FileText, FolderKanban, Gamepad2, Gauge, ImageIcon,
  Link2, ListChecks, LockKeyhole, LogOut, Menu, ScrollText, Shield, Timer, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import SetupStrip from '@/components/setup-strip';
import { navigation, titleForPath } from '@/lib/navigation';
import type { NavigationIcon } from '@/lib/navigation';

const icons: Record<NavigationIcon, LucideIcon> = {
  overview: Gauge,
  games: Gamepad2,
  guessr: ImageIcon,
  content: FolderKanban,
  announcement: Bell,
  techs: ListChecks,
  trials: Timer,
  media: ImageIcon,
  links: Link2,
  files: FileText,
  audit: ScrollText,
  admins: Shield,
};

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, admin, loading, busy, error, can, login, logout } = useAuth();
  const loginAttempted = useRef(false);
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Games: pathname.startsWith('/games'),
    'Hub Content': pathname.startsWith('/hub'),
  });

  useEffect(() => {
    if (loading || user || admin || busy || error || loginAttempted.current) return;
    loginAttempted.current = true;
    void login();
  }, [admin, busy, error, loading, login, user]);

  const visibleNavigation = useMemo(() => navigation
    .map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) }))
    .filter((group) => group.items.length), [can]);

  if (!admin) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#05080d] p-6">
        <section className="panel w-full max-w-sm p-7 text-center" aria-live="polite">
          <img className="mx-auto mb-5 size-14 object-contain" src="/logo/logo.webp" alt="Parkour Reborn" />
          <LockKeyhole className="mx-auto mb-3 size-7 text-accent" />
          <h1 className="font-display text-lg font-semibold uppercase tracking-wider">Admin access</h1>
          <p className="mt-2 text-sm text-muted">{loading || busy ? 'Checking Discord…' : error || 'Opening Discord…'}</p>
          {!loading && !busy && error && !user && <button className="btn btn-primary mt-5" onClick={() => void login()}>Try again</button>}
        </section>
      </main>
    );
  }

  const isActive = (href: string) => pathname === href || (href !== '/overview' && pathname.startsWith(`${href}/`));
  const linkClass = (active: boolean, child = false) => `nav-link ${child ? 'nav-link-child' : ''} ${active ? 'nav-link-active' : ''}`;
  const sidebarClass = `${collapsed ? 'lg:w-[76px]' : 'lg:w-[248px]'} fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-accent/20 bg-[#070b11]/[0.98] p-3 shadow-2xl transition-[width,transform] duration-200 ${navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`;

  return (
    <div className="min-h-screen">
      <aside className={sidebarClass}>
        <div className="mb-4 flex h-12 items-center gap-3 overflow-hidden border-b border-line px-2 pb-3">
          <img className="size-8 shrink-0 object-contain" src="/logo/logo.webp" alt="Parkour Reborn" />
          {!collapsed && <span className="whitespace-nowrap font-display text-sm font-bold uppercase tracking-[0.12em]">Hub Admin</span>}
          <button className="ml-auto text-slate-400 hover:text-white lg:hidden" onClick={() => setNavOpen(false)} aria-label="Close navigation"><X className="size-5" /></button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Admin navigation">
          {visibleNavigation.map((group, index) => {
            if (!group.label) return group.items.map((item) => {
              const Icon = icons[item.icon];
              return <Link href={item.href} className={linkClass(isActive(item.href))} title={item.label} onClick={() => setNavOpen(false)} key={item.href}><Icon className="size-[18px] shrink-0" />{!collapsed && <span>{item.label}</span>}</Link>;
            });

            const GroupIcon = icons[group.icon || 'content'];
            const expanded = openGroups[group.label] ?? false;
            const groupActive = group.items.some((item) => isActive(item.href));
            return (
              <div className={index ? 'mt-1' : ''} key={group.label}>
                <button className={linkClass(groupActive)} onClick={() => setOpenGroups((value) => ({ ...value, [group.label!]: !expanded }))} aria-expanded={expanded} title={group.label}>
                  <GroupIcon className="size-[18px] shrink-0" />
                  {!collapsed && <><span className="flex-1 text-left">{group.label}</span><ChevronDown className={`size-4 transition ${expanded ? 'rotate-180' : ''}`} /></>}
                </button>
                {expanded && !collapsed && <div className="mt-1 grid gap-1">{group.items.map((item) => {
                  const Icon = icons[item.icon];
                  return <Link href={item.href} className={linkClass(isActive(item.href), true)} onClick={() => setNavOpen(false)} key={item.href}><Icon className="size-4 shrink-0" /><span>{item.label}</span></Link>;
                })}</div>}
              </div>
            );
          })}
        </nav>

        <div className="mt-3 border-t border-line pt-3">
          <div className="flex items-center gap-3 overflow-hidden px-2">
            <div className="grid size-8 shrink-0 place-items-center border border-accent/25 bg-accent/10 font-display text-xs font-bold text-accent">{admin.displayName.slice(0, 1).toUpperCase()}</div>
            {!collapsed && <><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{admin.displayName}</strong><span className="font-mono text-[11px] uppercase tracking-wider text-muted">{admin.isOwner ? 'Owner' : `${admin.permissions.length} permissions`}</span></div><button onClick={() => void logout()} disabled={busy} aria-label="Sign out" title="Sign out" className="text-slate-500 hover:text-white"><LogOut className="size-4" /></button></>}
          </div>
          {!collapsed && error && <p className="mt-3 px-2 text-sm text-red-300">{error}</p>}
        </div>
      </aside>

      <div className={`${collapsed ? 'lg:pl-[76px]' : 'lg:pl-[248px]'} transition-[padding] duration-200`}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-[#05080d]/90 px-4 backdrop-blur-xl sm:px-6">
          <button className="grid size-9 place-items-center border border-line bg-white/[0.03] text-slate-300 hover:border-accent/50 hover:text-white" onClick={() => window.innerWidth >= 1024 ? setCollapsed((value) => !value) : setNavOpen(true)} aria-label="Toggle navigation" title="Toggle navigation">{collapsed ? <ChevronLeft className="size-4 rotate-180" /> : <Menu className="size-5" />}</button>
          <h1 className="font-display text-base font-semibold uppercase tracking-[0.09em] sm:text-lg">{titleForPath(pathname)}</h1>
          <span className="ml-auto hidden font-mono text-[11px] uppercase tracking-wider text-slate-500 sm:block">admin.parkourreborn.com</span>
        </header>
        <main className="mx-auto max-w-[1500px] px-3 py-4 sm:px-5 sm:py-5 lg:px-6">
          <SetupStrip />
          {children}
        </main>
      </div>

      {navOpen && <button className="fixed inset-0 z-30 bg-black/65 lg:hidden" onClick={() => setNavOpen(false)} aria-label="Close navigation" />}
    </div>
  );
}
