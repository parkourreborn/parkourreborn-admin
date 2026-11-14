'use client';

import { useAuth } from '@/components/auth-provider';
import type { Permission } from '@/lib/types';

export default function AccessState({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { admin, loading, busy, can, login } = useAuth();
  if (loading) return <div className="panel skeleton min-h-52" />;
  if (admin && can(permission)) return <>{children}</>;

  return (
    <div className="panel grid min-h-52 place-items-center gap-4 p-8">
      <p className="empty !p-0">{admin ? 'No access' : 'Signed out'}</p>
      {!admin && <button className="btn btn-primary" onClick={() => void login()} disabled={busy}>Sign in</button>}
    </div>
  );
}
