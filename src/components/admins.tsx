'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, ShieldCheck, UserRoundCheck, UserRoundX } from 'lucide-react';
import AccessState from '@/components/access-state';
import PageHead from '@/components/page-head';
import { useAuth } from '@/components/auth-provider';
import type { AdminRole, Permission } from '@/lib/types';

type AdminRow = { uid: string; role: AdminRole; displayName: string; disabled: boolean; permissions: Permission[] };

export default function Admins() {
  const { admin, api } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [uid, setUid] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Exclude<AdminRole, 'superadmin'>>('viewer');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!admin) return;
    const response = await api('/api/admin/admins');
    const data = await response.json() as { admins?: AdminRow[]; error?: string };
    if (!response.ok || !data.admins) return setError(data.error || 'Could not load admins');
    setAdmins(data.admins);
  }, [admin, api]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const add = async () => {
    setBusy(true);
    setError('');
    const response = await api('/api/admin/admins', { method: 'POST', body: JSON.stringify({ uid: uid.trim(), displayName: displayName.trim(), role }) });
    const data = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(data.error || 'Could not add admin');
    setUid('');
    setDisplayName('');
    setRole('viewer');
    await load();
  };

  const update = async (target: AdminRow, patch: { role?: Exclude<AdminRole, 'superadmin'>; disabled?: boolean }) => {
    setError('');
    const response = await api(`/api/admin/admins/${encodeURIComponent(target.uid)}`, { method: 'PATCH', body: JSON.stringify(patch) });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setError(data.error || 'Could not update admin');
    await load();
  };

  return (
    <AccessState permission="admins.manage">
      <PageHead eyebrow="Administration" title="Admins" detail="Manage server-enforced roles and disable access immediately." />
      {error && <div className="mb-5 border border-red-400/25 bg-red-400/[0.06] p-4 text-red-200">{error}</div>}

      <section className="panel mb-6 p-5 sm:p-6">
        <div className="mb-5"><p className="label">New admin</p><h3 className="mt-1 font-display text-xl uppercase tracking-wider">Grant access</h3></div>
        <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr_0.7fr_auto] lg:items-end">
          <label><span className="label mb-2 block">Firebase UID</span><input className="field" value={uid} onChange={(event) => setUid(event.target.value)} placeholder="discord-123456789" /></label>
          <label><span className="label mb-2 block">Display name</span><input className="field" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Admin name" /></label>
          <label><span className="label mb-2 block">Role</span><select className="field" value={role} onChange={(event) => setRole(event.target.value as Exclude<AdminRole, 'superadmin'>)}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></select></label>
          <button className="btn btn-primary" onClick={() => void add()} disabled={busy || !uid.trim() || !displayName.trim()}><Plus className="size-4" /> Add admin</button>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-line p-5 sm:px-6"><div><p className="label">Access list</p><h3 className="mt-1 font-display text-xl uppercase tracking-wider">Current admins</h3></div><ShieldCheck className="size-5 text-accent" /></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead><tr className="border-b border-line bg-black/15 font-mono text-xs uppercase tracking-wider text-muted"><th className="px-6 py-3">Admin</th><th className="px-4 py-3">UID</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Permissions</th><th className="px-6 py-3 text-right">Status</th></tr></thead>
            <tbody className="divide-y divide-line">{admins.map((row) => (
              <tr key={row.uid} className="hover:bg-white/[0.02]">
                <td className="px-6 py-4"><strong>{row.displayName}</strong>{row.uid === admin?.uid && <span className="badge ml-2">You</span>}</td>
                <td className="px-4 py-4 font-mono text-xs text-muted">{row.uid}</td>
                <td className="px-4 py-4">{row.role === 'superadmin' ? <span className="badge !border-accent/30 !text-accent">Super admin</span> : <select className="field !h-9 !w-32" value={row.role} onChange={(event) => void update(row, { role: event.target.value as Exclude<AdminRole, 'superadmin'> })} disabled={row.uid === admin?.uid}><option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option></select>}</td>
                <td className="px-4 py-4 text-sm text-muted">{row.permissions.length} granted</td>
                <td className="px-6 py-4 text-right">{row.role === 'superadmin' || row.uid === admin?.uid ? <span className="badge !border-emerald-400/20 !text-emerald-300">Active</span> : <button className={`btn !min-h-9 !px-3 ${row.disabled ? 'btn-secondary' : 'btn-danger'}`} onClick={() => void update(row, { disabled: !row.disabled })}>{row.disabled ? <UserRoundCheck className="size-4" /> : <UserRoundX className="size-4" />}{row.disabled ? 'Enable' : 'Disable'}</button>}</td>
              </tr>
            ))}</tbody>
          </table>
          {!admins.length && <div className="p-10 text-center text-muted">No admin records found.</div>}
        </div>
      </section>
    </AccessState>
  );
}
