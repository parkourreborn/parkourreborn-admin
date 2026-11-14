'use client';

import { useCallback, useEffect, useState } from 'react';
import { Edit3, Plus, ShieldCheck, Trash2, UserRoundCheck, UserRoundX } from 'lucide-react';
import AccessState from '@/components/access-state';
import Modal from '@/components/modal';
import { useAuth } from '@/components/auth-provider';
import { accessSections, accessSummary, addonState, includesAll, levelGrants, levelOf, setAddon, setLevel } from '@/lib/permissions';
import type { AccessSection } from '@/lib/permissions';
import { adminManageCan } from '@/lib/policy';
import type { Permission } from '@/lib/types';

type AdminRow = {
  uid: string;
  discordId: string;
  displayName: string;
  avatarUrl: string | null;
  disabled: boolean;
  permissions: Permission[];
  isOwner: boolean;
  signedIn: boolean;
};
type Draft = { discordId: string; permissions: Permission[] };
const emptyDraft: Draft = { discordId: '', permissions: ['overview.view'] };

// Same forms the server accepts: a bare ID, "discord-<id>" or a "<@id>" mention.
const cleanDiscordId = (value: string) => value.trim().replace(/^discord-/i, '').replace(/^<@!?/, '').replace(/>$/, '').trim();
const validDiscordId = (value: string) => /^\d{17,20}$/.test(value);

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

  const canAdd = Boolean(admin && adminManageCan(admin, null).ok);
  const canChange = (row: AdminRow) => Boolean(admin && adminManageCan(admin, row).ok);

  const open = (row: AdminRow | 'new') => {
    setEditing(row);
    setError('');
    setDraft(row === 'new' ? emptyDraft : { discordId: row.discordId, permissions: [...row.permissions] });
  };

  const discordId = cleanDiscordId(draft.discordId);
  const creating = editing === 'new';

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const url = creating ? '/api/admin/admins' : `/api/admin/admins/${encodeURIComponent((editing as AdminRow).uid)}`;
      const body = creating ? { discordId, permissions: draft.permissions } : { permissions: draft.permissions };
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

  // Non-owner managers can only hand out access they have themselves.
  const mayGrant = (permissions: readonly Permission[]) => Boolean(admin && (admin.isOwner || includesAll(admin.permissions, permissions)));
  const grantError = admin && !admin.isOwner && editing ? adminManageCan(admin, editing === 'new' ? null : editing, draft.permissions) : { ok: true as const };

  return <AccessState permission="admins.view">
    {error && !editing && <p className="note note--bad">{error}</p>}
    <section className="panel">
      <div className="section-head">
        <h2 className="section-title">Admins</h2>
        <span className="badge">{admins.length}</span>
        {canAdd && <button className="btn btn-primary btn-sm ml-auto" onClick={() => open('new')}><Plus /> Add</button>}
      </div>
      <div className="table-scroll"><table className="data-table min-w-[640px]">
        <thead><tr><th>Name</th><th>Discord ID</th><th>Access</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>{admins.map((row) => <tr key={row.uid}>
          <td>
            <span className="flex items-center gap-2">
              {row.avatarUrl && <img src={row.avatarUrl} alt="" width={24} height={24} className="size-6 shrink-0 rounded-full" />}
              <span className="grid">
                <span className="flex items-center gap-2">{row.displayName}{row.isOwner && <span className="badge badge--accent"><ShieldCheck className="size-3" /> Owner</span>}</span>
                {!row.signedIn && !row.isOwner && <span className="row__sub">Not signed in yet</span>}
              </span>
            </span>
          </td>
          <td className="muted mono">{row.discordId}</td>
          <td><AccessBadges row={row} /></td>
          <td><div className="flex justify-end">{canChange(row) && <>
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
      title={creating ? 'New admin' : (editing as AdminRow).displayName}
      onClose={() => setEditing(null)}
      actions={<>
        <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
        <button className="btn btn-primary" onClick={() => void save()} disabled={busy || (creating && !validDiscordId(discordId)) || !grantError.ok}>{busy ? 'Saving…' : 'Save'}</button>
      </>}
    >
      {creating ? <label className="field-label">
        <span className="label">Discord user ID</span>
        <input className="field mono" inputMode="numeric" autoComplete="off" value={draft.discordId} onChange={(event) => setDraft((value) => ({ ...value, discordId: event.target.value }))} placeholder="123456789012345678" />
        <span className="row__sub">
          {draft.discordId && !validDiscordId(discordId)
            ? 'That doesn’t look like a Discord user ID (17–20 digits).'
            : 'Turn on Developer Mode in Discord, then right-click them and Copy User ID. Their Discord name shows here once they sign in.'}
        </span>
      </label> : <p className="row__sub mono">Discord ID {(editing as AdminRow).discordId}</p>}

      <div className="grid">{accessSections.map((section) => (
        <SectionAccess
          key={section.id}
          section={section}
          granted={draft.permissions}
          mayGrant={mayGrant}
          onChange={(permissions) => setDraft((value) => ({ ...value, permissions }))}
        />
      ))}</div>
      {!grantError.ok && <p className="note note--warn">{grantError.reason}</p>}
      {error && <p className="note note--bad">{error}</p>}
    </Modal>}
  </AccessState>;
}

function SectionAccess({ section, granted, mayGrant, onChange }: {
  section: AccessSection;
  granted: Permission[];
  mayGrant: (permissions: readonly Permission[]) => boolean;
  onChange: (permissions: Permission[]) => void;
}) {
  const level = levelOf(section, granted);
  const options = [{ id: 'none', label: 'None', index: -1 }, ...section.levels.map((item, index) => ({ id: item.id, label: item.label, index }))];

  return (
    <div className="grid gap-2 border-b border-line py-3 last:border-b-0 sm:grid-cols-[140px_1fr]">
      <span className="label pt-2">{section.label}</span>
      <div className="grid gap-2">
        <div className="levels" role="radiogroup" aria-label={section.label}>{options.map((option) => (
          <button
            type="button"
            key={option.id}
            role="radio"
            aria-checked={level === option.index}
            className={level === option.index ? 'is-on' : ''}
            disabled={!mayGrant(levelGrants(section, option.index))}
            onClick={() => onChange(setLevel(section, granted, option.index))}
          >{option.label}</button>
        ))}</div>
        {level >= 0 && <p className="row__sub">{section.levels[level].summary}</p>}
        {section.addons?.map((addon) => {
          const state = addonState(section, addon, granted);
          if (!state.available) return null;
          return (
            <label className="toggle w-fit" key={addon.permission} title={addon.summary}>
              <input
                type="checkbox"
                checked={state.on}
                disabled={state.included || !mayGrant([addon.permission])}
                onChange={(event) => onChange(setAddon(section, granted, addon, event.target.checked))}
              />
              <span>{addon.label}{state.included ? ' (included)' : ''}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function AccessBadges({ row }: { row: AdminRow }) {
  if (row.isOwner) return <span className="badge badge--accent">Full access</span>;
  if (row.disabled) return <span className="badge status-muted">Disabled</span>;
  const summary = accessSummary(row.permissions);
  const viewOnly = summary.filter((item) => item.level === 'View');
  const more = summary.filter((item) => item.level !== 'View');
  if (!summary.length) return <span className="badge status-muted">No access</span>;
  return (
    <span className="meta">
      {more.map((item) => (
        <span className={`badge ${item.top ? 'badge--accent' : ''}`} key={item.section}>
          {item.section}: {item.level}{item.extras.length ? ` + ${item.extras.join(', ')}` : ''}
        </span>
      ))}
      {!!viewOnly.length && <span className="badge" title={viewOnly.map((item) => item.section).join(', ')}>View {viewOnly.length}</span>}
    </span>
  );
}
