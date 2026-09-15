'use client';

import { useCallback, useEffect, useState } from 'react';
import { Edit3, Plus, ShieldCheck, Trash2, UserRoundCheck, UserRoundX, X } from 'lucide-react';
import AccessState from '@/components/access-state';
import { useAuth } from '@/components/auth-provider';
import { permissionGroups, permissionLabel } from '@/lib/permissions';
import type { Permission } from '@/lib/types';

type AdminRow = { uid: string; displayName: string; disabled: boolean; permissions: Permission[]; isOwner: boolean };
type Draft = { uid: string; displayName: string; permissions: Permission[] };
const emptyDraft: Draft = { uid: '', displayName: '', permissions: ['overview.view'] };

export default function Admins() {
  const { admin, api } = useAuth();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [editing, setEditing] = useState<AdminRow | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!admin) return;
    try {
      const response = await api('/api/admin/admins');
      const data = await response.json() as { admins?: AdminRow[]; error?: string };
      if (!response.ok || !data.admins) throw new Error(data.error || 'Could not load admins');
      setAdmins(data.admins);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load admins');
    }
  }, [admin, api]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const open = (row: AdminRow | 'new') => {
    setEditing(row);
    setError('');
    setDraft(row === 'new' ? emptyDraft : { uid: row.uid, displayName: row.displayName, permissions: [...row.permissions] });
  };

  const togglePermission = (permission: Permission) => setDraft((value) => ({
    ...value,
    permissions: value.permissions.includes(permission) ? value.permissions.filter((item) => item !== permission) : [...value.permissions, permission],
  }));

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const creating = editing === 'new';
      const url = creating ? '/api/admin/admins' : `/api/admin/admins/${encodeURIComponent((editing as AdminRow).uid)}`;
      const body = creating ? draft : { displayName: draft.displayName, permissions: draft.permissions };
      const response = await api(url, { method: creating ? 'POST' : 'PATCH', body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not save admin');
      setEditing(null);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save admin');
    } finally {
      setBusy(false);
    }
  };

  const setDisabled = async (row: AdminRow) => {
    const response = await api(`/api/admin/admins/${encodeURIComponent(row.uid)}`, { method: 'PATCH', body: JSON.stringify({ disabled: !row.disabled }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setError(data.error || 'Could not update admin');
    await load();
  };

  const remove = async (row: AdminRow) => {
    if (!window.confirm(`Remove admin access for “${row.displayName}”?`)) return;
    const response = await api(`/api/admin/admins/${encodeURIComponent(row.uid)}`, { method: 'DELETE' });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setError(data.error || 'Could not remove admin');
    await load();
  };

  return <AccessState permission="admins.view">
    <div className="mb-4 flex items-center gap-3"><span className="badge">{admins.length} admins</span>{admin?.isOwner && <button className="btn btn-primary ml-auto" onClick={() => open('new')}><Plus className="size-4" /> Add admin</button>}</div>
    {error && !editing && <div className="mb-4 border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</div>}
    <section className="panel overflow-hidden"><div className="hidden overflow-x-auto md:block"><table className="data-table min-w-[720px]"><thead><tr><th>Admin</th><th>Firebase UID</th><th>Permissions</th><th>Status</th><th className="text-right">Actions</th></tr></thead><tbody>{admins.map((row) => <tr key={row.uid}><td><div className="flex items-center gap-2"><strong>{row.displayName}</strong>{row.isOwner && <span className="badge !border-accent/30 !text-accent"><ShieldCheck className="mr-1 size-3" /> Owner</span>}{row.uid === admin?.uid && <span className="badge">You</span>}</div></td><td className="font-mono text-xs text-muted">{row.uid}</td><td><span className="badge">{row.permissions.length} granted</span></td><td><span className={`badge ${row.disabled ? 'status-muted' : 'status-active'}`}>{row.disabled ? 'Disabled' : 'Active'}</span></td><td><div className="flex justify-end gap-1">{admin?.isOwner && !row.isOwner && <><button className="icon-btn" onClick={() => open(row)} title="Edit permissions" aria-label="Edit permissions"><Edit3 className="size-4" /></button><button className="icon-btn" onClick={() => void setDisabled(row)} title={row.disabled ? 'Enable' : 'Disable'} aria-label={row.disabled ? 'Enable' : 'Disable'}>{row.disabled ? <UserRoundCheck className="size-4" /> : <UserRoundX className="size-4" />}</button><button className="icon-btn text-red-300" onClick={() => void remove(row)} title="Remove" aria-label="Remove"><Trash2 className="size-4" /></button></>}</div></td></tr>)}</tbody></table></div><div className="divide-y divide-line md:hidden">{admins.map((row) => <article className="p-4" key={row.uid}><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{row.displayName}</strong>{row.isOwner && <span className="badge !text-accent">Owner</span>}</div><p className="mt-1 truncate font-mono text-[11px] text-muted">{row.uid}</p><p className="mt-2 text-xs text-muted">{row.permissions.length} permissions · {row.disabled ? 'Disabled' : 'Active'}</p></div>{admin?.isOwner && !row.isOwner && <button className="icon-btn" onClick={() => open(row)} aria-label="Edit"><Edit3 className="size-4" /></button>}</div></article>)}</div>{!admins.length && <div className="p-10 text-center text-sm text-muted">No admins.</div>}</section>
    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setEditing(null); }}><section className="modal-panel max-w-3xl" role="dialog" aria-modal="true" aria-label="Admin permissions"><div className="modal-head"><div><span className="label">{editing === 'new' ? 'New admin' : 'Edit admin'}</span><h2 className="font-display text-lg font-semibold uppercase tracking-wider">Permissions</h2></div><button className="icon-btn" onClick={() => setEditing(null)} aria-label="Close"><X className="size-4" /></button></div><div className="grid gap-4 p-4 sm:p-5"><div className="grid gap-3 sm:grid-cols-2"><label><span className="label mb-2 block">Firebase UID</span><input className="field" value={draft.uid} onChange={(event) => setDraft((value) => ({ ...value, uid: event.target.value }))} disabled={editing !== 'new'} placeholder="discord-123456789" /></label><label><span className="label mb-2 block">Display name</span><input className="field" value={draft.displayName} onChange={(event) => setDraft((value) => ({ ...value, displayName: event.target.value }))} /></label></div><div className="permission-grid">{permissionGroups.map((group) => <fieldset className="border border-line p-3" key={group.label}><legend className="label px-1">{group.label}</legend><div className="grid gap-1">{group.permissions.map((permission) => <label className="permission-option" key={permission}><input type="checkbox" checked={draft.permissions.includes(permission)} onChange={() => togglePermission(permission)} /><span>{permissionLabel(permission)}</span></label>)}</div></fieldset>)}</div>{error && <p className="border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}</div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={() => void save()} disabled={busy || !draft.uid.trim() || !draft.displayName.trim()}>{busy ? 'Saving…' : 'Save'}</button></div></section></div>}
  </AccessState>;
}
