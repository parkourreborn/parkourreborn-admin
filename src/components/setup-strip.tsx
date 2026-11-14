'use client';

import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';

export default function SetupStrip() {
  const { setup } = useAuth();
  if (!setup) return null;
  const missing = Object.entries(setup).filter(([name, value]) => name !== 'mapError' && !value).map(([name]) => name);
  if (!missing.length) return null;

  return (
    <div className="note note--warn flex-wrap items-center" role="status">
      <AlertTriangle aria-hidden="true" />
      <span className="mr-auto">Setup incomplete</span>
      {missing.map((name) => <span className="badge status-warn" key={name}>{name.replace(/([A-Z])/g, ' $1')}</span>)}
    </div>
  );
}
