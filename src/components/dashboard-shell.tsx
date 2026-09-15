'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, Gamepad2, Gauge, ImageIcon, LockKeyhole, LogOut, Menu, Shield, X } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import SetupStrip from '@/components/setup-strip';

const pathTitle = (pathname: string) => {
  if (pathname === '/admins') return 'Admins';
  if (pathname === '/games/parkourguessr') return 'Parkour Guessr';
  if (pathname.startsWith('/games')) return 'Games';
  return 'Overview';
};

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, loading, busy, error, can, login, logout } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [gamesOpen, setGamesOpen] = useState(pathname.startsWith('/games'));
  const [adminOpen, setAdminOpen] = useState(pathname.startsWith('/admins'));

  const linkClass = (active: boolean, child = false) => `group flex min-h-11 items-center gap-3 border-l-2 px-3 font-display text-sm font-semibold uppercase tracking-[0.11em] transition ${child ? 'ml-4' : ''} ${active ? 'border-accent bg-accent/10 text-white' : 'border-transparent text-slate-400 hover:border-accent/50 hover:bg-white/[0.035] hover:text-white'}`;
  const sidebarClass = `${collapsed ? 'lg:w-[84px]' : 'lg:w-[270px]'} fixed inset-y-0 left-0 z-40 flex w-[286px] flex-col border-r border-accent/20 bg-[#070b11]/[0.98] p-4 shadow-2xl transition-[width,transform] duration-200 ${navOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`;

  return (
    <div className="min-h-screen">
      <aside className={sidebarClass}>
        <div className="mb-7 flex h-11 items-center gap-3 overflow-hidden border-b border-line pb-4">
          <img className="size-8 shrink-0 object-contain" src="/logo/logo.webp" alt="Parkour Reborn" />
          {!collapsed && <div className="min-w-0"><strong className="block truncate font-display text-base uppercase tracking-[0.16em]">PR Hub</strong><span className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent">Admin control</span></div>}
          <button className="ml-auto text-slate-400 hover:text-white lg:hidden" onClick={() => setNavOpen(false)} aria-label="Close navigation"><X className="size-5" /></button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="Admin navigation">
          <Link href="/overview" className={linkClass(pathname === '/overview')} title="Overview" onClick={() => setNavOpen(false)}><Gauge className="size-5 shrink-0" />{!collapsed && <span>Overview</span>}</Link>

          <button className={linkClass(pathname.startsWith('/games'))} onClick={() => setGamesOpen((open) => !open)} aria-expanded={gamesOpen} title="Games">
            <Gamepad2 className="size-5 shrink-0" />{!collapsed && <><span className="flex-1 text-left">Games</span><ChevronDown className={`size-4 transition ${gamesOpen ? 'rotate-180' : ''}`} /></>}
          </button>
          {gamesOpen && !collapsed && (
            <div className="grid gap-1">
              <Link href="/games" className={linkClass(pathname === '/games', true)} onClick={() => setNavOpen(false)}><Gamepad2 className="size-4" /><span>All games</span></Link>
              <Link href="/games/parkourguessr" className={linkClass(pathname === '/games/parkourguessr', true)} onClick={() => setNavOpen(false)}><ImageIcon className="size-4" /><span>Parkour Guessr</span></Link>
            </div>
          )}

          {can('admins.manage') && <>
            <button className={linkClass(pathname.startsWith('/admins'))} onClick={() => setAdminOpen((open) => !open)} aria-expanded={adminOpen} title="Administration">
              <Shield className="size-5 shrink-0" />{!collapsed && <><span className="flex-1 text-left">Administration</span><ChevronDown className={`size-4 transition ${adminOpen ? 'rotate-180' : ''}`} /></>}
            </button>
            {adminOpen && !collapsed && <Link href="/admins" className={linkClass(pathname === '/admins', true)} onClick={() => setNavOpen(false)}><LockKeyhole className="size-4" /><span>Admins</span></Link>}
          </>}
        </nav>

        <div className="mt-4 border-t border-line pt-4">
          {admin ? (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="grid size-9 shrink-0 place-items-center border border-accent/25 bg-accent/10 font-display text-sm font-bold text-accent">{admin.displayName.slice(0, 1).toUpperCase()}</div>
              {!collapsed && <><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{admin.displayName}</strong><span className="font-mono text-[11px] uppercase tracking-wider text-muted">{admin.role}</span></div><button onClick={() => void logout()} disabled={busy} aria-label="Sign out" className="text-slate-500 hover:text-white"><LogOut className="size-4" /></button></>}
            </div>
          ) : !collapsed && (
            <button className="btn btn-primary w-full" onClick={() => void login()} disabled={busy || loading}>{loading ? 'Checking access' : 'Sign in with Discord'}</button>
          )}
          {!collapsed && error && <p className="mt-3 text-sm text-red-300">{error}</p>}
        </div>
      </aside>

      <div className={`${collapsed ? 'lg:pl-[84px]' : 'lg:pl-[270px]'} transition-[padding] duration-200`}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-[#05080d]/90 px-4 backdrop-blur-xl sm:px-6">
          <button className="grid size-10 place-items-center border border-line bg-white/[0.03] text-slate-300 hover:border-accent/50 hover:text-white" onClick={() => window.innerWidth >= 1024 ? setCollapsed((value) => !value) : setNavOpen(true)} aria-label="Toggle navigation"><Menu className="size-5" /></button>
          <div><span className="font-mono text-[11px] uppercase tracking-[0.17em] text-accent">Parkour Reborn Hub</span><h1 className="font-display text-lg font-semibold uppercase tracking-[0.08em]">{pathTitle(pathname)}</h1></div>
          <span className="ml-auto hidden font-mono text-xs uppercase tracking-wider text-slate-500 sm:block">admin.parkourreborn.com</span>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
          <SetupStrip />
          {children}
        </main>
      </div>

      {navOpen && <button className="fixed inset-0 z-30 bg-black/65 lg:hidden" onClick={() => setNavOpen(false)} aria-label="Close navigation" />}
    </div>
  );
}
