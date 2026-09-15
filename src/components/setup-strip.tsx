'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

export default function SetupStrip() {
  const { setup } = useAuth();
  if (!setup) return null;
  const items = Object.entries(setup);
  const ready = items.every(([, value]) => value);
  if (ready) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 border border-amber-300/20 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100" role="status">
      <AlertTriangle className="size-4 shrink-0 text-amber-300" aria-hidden="true" />
      <span className="mr-auto">Setup mode — live actions stay disabled until their services are configured.</span>
      {items.map(([name, value]) => (
        <span className={`badge ${value ? '!border-emerald-400/25 !text-emerald-300' : '!border-amber-300/25 !text-amber-200'}`} key={name}>
          {value && <CheckCircle2 className="mr-1 size-3" />} {name.replace(/([A-Z])/g, ' $1')}
        </span>
      ))}
    </div>
  );
}
