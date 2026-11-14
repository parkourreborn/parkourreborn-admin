'use client';

import { useCallback, useEffect, useState } from 'react';
import { Edit3, Plus, ShieldCheck, Trash2, UserRoundCheck, UserRoundX } from 'lucide-react';
import AccessState from '@/components/access-state';
import Modal from '@/components/modal';
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

  const owner = admin?.isOwner;

  return <AccessState permission="admins.view">
    {error && !editing && <p className="note note--bad">{error}</p>}
    <section className="panel">
      <div className="section-head">
        <h2 className="section-title">Admins</h2>
        <span className="badge">{admins.length}</span>
        {owner && <button className="btn btn-primary btn-sm ml-auto" onClick={() => open('new')}><Plus /> Add</button>}
      </div>
      <div className="table-scroll"><table className="data-table min-w-[560px]">
        <thead><tr><th>Name</th><th>UID</th><th>Permissions</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{admins.map((row) => <tr key={row.uid}>
          <td><span className="flex items-center gap-2">{row.displayName}{row.isOwner && <span className="badge badge--accent"><ShieldCheck className="size-3" /> Owner</span>}</span></td>
          <td className="muted mono">{row.uid}</td>
          <td><span className={`badge ${row.disabled ? 'status-muted' : 'status-active'}`}>{row.disabled ? 'Disabled' : row.permissions.length}</span></td>
          <td><div className="flex justify-end">{owner && !row.isOwner && <>
            <button className="icon-btn" onClick={() => open(row)} title="Edit" aria-label="Edit"><Edit3 /></button>
            <button className="icon-btn" onClick={() => void setDisabled(row)} title={row.disabled ? 'Enable' : 'Disable'} aria-label={row.disabled ? 'Enable' : 'Disable'}>{row.disabled ? <UserRoundCheck /> : <UserRoundX />}</button>
            <button className="icon-btn icon-btn--danger" onClick={() => void remove(row)} title="Remove" aria-label="Remove"><Trash2 /></button>
          </>}</div></td>
        </tr>)}</tbody>
      </table></div>
      {!admins.length && <p className="empty">No admins</p>}
    </section>

    {editing && <Modal
      wide
      title={editing === 'new' ? 'New admin' : draft.displayName || 'Edit admin'}
      onClose={() => setEditing(null)}
      actions={<><button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={() => void save()} disabled={busy || !draft.uid.trim() || !draft.displayName.trim()}>{busy ? 'Saving…' : 'Save'}</button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field-label"><span className="label">Firebase UID</span><input className="field" value={draft.uid} onChange={(event) => setDraft((value) => ({ ...value, uid: event.target.value }))} disabled={editing !== 'new'} placeholder="discord-123456789" /></label>
        <label className="field-label"><span className="label">Name</span><input className="field" value={draft.displayName} onChange={(event) => setDraft((value) => ({ ...value, displayName: event.target.value }))} /></label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">{permissionGroups.map((group) => (
        <fieldset className="grid gap-1 border border-line p-3" key={group.label}>
          <legend className="label px-1">{group.label}</legend>
          {group.permissions.map((permission) => <label className="flex min-h-8 cursor-pointer items-center gap-3 text-sm text-[var(--hud-row)] hover:text-white" key={permission}><input type="checkbox" checked={draft.permissions.includes(permission)} onChange={() => togglePermission(permission)} /><span>{permissionLabel(permission)}</span></label>)}
        </fieldset>
      ))}</div>
      {error && <p className="note note--bad">{error}</p>}
    </Modal>}
  </AccessState>;
}
