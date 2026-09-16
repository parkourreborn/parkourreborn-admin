'use client';

import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

export default function SetupStrip() {
  const { setup } = useAuth();
  if (!setup) return null;
  const items = Object.entries(setup).filter(([name]) => name !== 'mapError');
  const ready = items.every(([, value]) => value);
  if (ready) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 border border-amber-300/20 bg-amber-300/[0.06] px-3 py-2 text-sm text-amber-100" role="status">
      <AlertTriangle className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
      <strong className="mr-auto text-xs uppercase tracking-wider">Setup incomplete</strong>
      {setup.mapError && <span>{setup.mapError}</span>}
      {items.filter(([, value]) => !value).map(([name]) => <span className="badge !border-amber-300/25 !text-amber-200" key={name}>{name.replace(/([A-Z])/g, ' $1')}</span>)}
    </div>
  );
}
