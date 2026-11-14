'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowBigLeft, LogOut } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import { navigation } from '@/lib/navigation';

const focusable = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const nothingFocused = () => {
  const active = document.activeElement;
  return !active || active === document.body || active === document.documentElement;
};

// The hub's Tab menu: a full-screen overlay of page tiles.
export default function Menu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);
  const { admin, busy, can, logout } = useAuth();

  const sections = useMemo(() => navigation
    .map((section) => ({ ...section, items: section.items.filter((item) => can(item.permission)) }))
    .filter((section) => section.items.length), [can]);

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) document.getElementById('menu-toggle')?.focus();
  }, []);

  // Tab opens the menu while nothing on the page has focus, like in game.
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
      if (!nothingFocused() || document.querySelector('[aria-modal="true"]:not(#site-menu)')) return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    document.addEventListener('keydown', keyboard, true);
    return () => document.removeEventListener('keydown', keyboard, true);
  }, []);

  // While open: lock page scroll, trap focus, Escape closes.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.inert = !open;
    if (!open) return;

    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';

    const items = () => [...panel.querySelectorAll<HTMLElement>(focusable)].filter((item) => item.offsetParent !== null);
    if (!panel.contains(document.activeElement)) {
      (panel.querySelector<HTMLElement>('[aria-current="page"]') ?? items()[0])?.focus();
    }

    const keyboard = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close(true);
        return;
      }
      if (event.key !== 'Tab') return;
      const list = items();
      if (!list.length) return;
      const current = document.activeElement;
      const first = list[0];
      const last = list[list.length - 1];
      if (!panel.contains(current)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', keyboard);
    return () => {
      root.style.overflow = overflow;
      document.removeEventListener('keydown', keyboard);
    };
  }, [open, close]);

  if (!admin) return null;

  return (
    <>
      <button
        id="menu-toggle"
        className="menu-toggle"
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="menu-icon" aria-hidden="true"><span /><span /><span /></span>
      </button>

      <div
        id="site-menu"
        ref={panelRef}
        className={`pause-menu${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal={open}
        aria-label="Menu"
        aria-hidden={!open}
        onClick={(event) => { if (event.target === event.currentTarget) close(true); }}
      >
        {open && (
          <div className="pause-menu__inner">
            <div className="pause-menu__head">
              <Link href="/overview" className="pause-menu__brand" onClick={() => setOpen(false)}>
                <img src="/logo/logo.webp" alt="" width={34} height={34} />
                <span>Hub Admin</span>
              </Link>
            </div>

            {sections.map((section) => (
              <section className="pause-menu__section" aria-labelledby={`menu-${section.title.toLowerCase()}`} key={section.title}>
                <h2 id={`menu-${section.title.toLowerCase()}`}>{section.title}</h2>
                <div className="pause-menu__grid">
                  {section.items.map((item) => (
                    <Link
                      className="pause-menu__tile"
                      href={item.href}
                      key={item.href}
                      aria-current={pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                    >
                      <img className="pause-menu__img" src={item.image} alt="" />
                      <span className="pause-menu__name">{item.label}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}

            <div className="pause-menu__foot">
              <div className="menu-account">
                {admin.avatarUrl
                  ? <img className="menu-account__avatar" src={admin.avatarUrl} alt="" width={34} height={34} />
                  : <span className="menu-account__avatar" aria-hidden="true">{admin.displayName.slice(0, 1)}</span>}
                <span className="menu-account__name">{admin.displayName}</span>
                <button type="button" className="icon-btn ml-auto" onClick={() => void logout()} disabled={busy} aria-label="Sign out" title="Sign out">
                  <LogOut className="size-4" />
                </button>
              </div>
              <button type="button" className="pause-menu__resume" onClick={() => close(true)}>
                <ArrowBigLeft aria-hidden="true" />
                <span>Resume</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
