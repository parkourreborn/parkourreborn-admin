'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/components/auth-provider';
import Menu from '@/components/menu';
import SetupStrip from '@/components/setup-strip';
import { itemForPath } from '@/lib/navigation';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="hub-shell overflow-x-hidden">
      <section className="hub-page hub-page--wide">
        <div className="hub-container">{children}</div>
      </section>
    </main>
  );
}

function Logo() {
  return (
    <header className="hero-panel">
      <h1 className="hero-panel__logo">
        <img src="/logo/hero-logo.webp" alt="Parkour Reborn Hub Admin" width={520} height={240} />
      </h1>
    </header>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, admin, loading, busy, error, login } = useAuth();
  const loginAttempted = useRef(false);

  useEffect(() => {
    if (loading || user || admin || busy || error || loginAttempted.current) return;
    loginAttempted.current = true;
    void login();
  }, [admin, busy, error, loading, login, user]);

  if (!admin) {
    const waiting = loading || busy || !error;
    return (
      <Frame>
        <Logo />
        <div className="grid justify-items-center gap-3" aria-live="polite">
          {error && !user && <p className="note note--bad w-full">{error}</p>}
          <button className="btn btn-primary btn-wide" onClick={() => void login()} disabled={waiting}>
            {waiting ? 'Signing in…' : 'Sign in'}
          </button>
        </div>
      </Frame>
    );
  }

  const item = itemForPath(pathname);
  const home = !item || item.href === '/overview';

  return (
    <>
      <Menu />
      <Frame>
        {!home && <Link href="/overview" className="back-btn">&#8592; Back</Link>}
        {home ? <Logo /> : (
          <header className="page-hero">
            <span className="page-hero__image" style={{ backgroundImage: `url(${item.image})` }} />
            <span className="page-hero__shade" />
            <div className="page-hero__content"><h1>{item.label}</h1></div>
          </header>
        )}
        <SetupStrip />
        {children}
      </Frame>
    </>
  );
}
