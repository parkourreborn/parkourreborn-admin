'use client';

import { LockKeyhole } from 'lucide-react';
import { useAuth } from '@/components/auth-provider';
import type { Permission } from '@/lib/types';

export default function AccessState({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { admin, loading, busy, can, login } = useAuth();
  if (loading) return <div className="panel min-h-52 animate-pulse bg-white/[0.025]" />;
  if (admin && can(permission)) return <>{children}</>;

  return (
    <div className="panel grid min-h-64 place-items-center p-8 text-center">
      <div>
        <LockKeyhole className="mx-auto mb-4 size-8 text-accent" />
        <h3 className="font-display text-xl font-semibold uppercase tracking-wider">{admin ? 'Permission required' : 'Admin sign-in required'}</h3>
        <p className="mx-auto mt-2 max-w-md text-muted">{admin ? `Missing ${permission}.` : 'Use the Discord account linked to your admin record.'}</p>
        {!admin && <button className="btn btn-primary mt-5" onClick={() => void login()} disabled={busy}>Sign in with Discord</button>}
      </div>
    </div>
  );
}
