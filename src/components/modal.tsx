'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

// The hub's dialog: title with a blue rail above a HUD panel.
export default function Modal({ title, onClose, actions, wide = false, children }: {
  title: string;
  onClose: () => void;
  actions?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', keyboard);
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', keyboard);
      root.style.overflow = overflow;
    };
  }, []);

  return (
    <div className="modal">
      <button className="modal__scrim" type="button" aria-label="Close" tabIndex={-1} onClick={onClose} />
      <section className={`modal__dialog${wide ? ' modal__dialog--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>
        <div className="modal__body">
          {children}
          {actions && <div className="modal__actions">{actions}</div>}
        </div>
      </section>
    </div>
  );
}
