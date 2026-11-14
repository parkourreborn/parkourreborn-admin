'use client';

import { useCallback, useEffect, useState } from 'react';
import { Edit3, Eye, EyeOff, Plus, Trash2 } from 'lucide-react';
import AccessState from '@/components/access-state';
import Modal from '@/components/modal';
import { useAuth } from '@/components/auth-provider';
import type { Announcement } from '@/lib/types';

const emptyDraft = { title: '', message: '', active: true, expiresAt: '' };
const formatDate = (value: string | null) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

export default function Announcements({ compact = false, onChanged }: { compact?: boolean; onChanged?: () => void }) {
  const { admin, api, can } = useAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [editing, setEditing] = useState<Announcement | 'new' | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!admin || !can('announcements.view')) return;
    try {
      const response = await api('/api/admin/announcements');
      const data = await response.json() as { announcements?: Announcement[]; error?: string };
      if (!response.ok || !data.announcements) throw new Error(data.error || 'Could not load announcements');
      setItems(data.announcements);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load announcements');
    }
  }, [admin, api, can]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const open = (item: Announcement | 'new') => {
    setEditing(item);
    setError('');
    setDraft(item === 'new' ? emptyDraft : {
      title: item.title,
      message: item.message,
      active: item.active,
      expiresAt: item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : '',
    });
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const creating = editing === 'new';
      const url = creating ? '/api/admin/announcements' : `/api/admin/announcements/${encodeURIComponent((editing as Announcement).id)}`;
      const body = { ...draft, expiresAt: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null };
      const response = await api(url, { method: creating ? 'POST' : 'PATCH', body: JSON.stringify(body) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not save announcement');
      setEditing(null);
      await load();
      onChanged?.();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save announcement');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (item: Announcement) => {
    const response = await api(`/api/admin/announcements/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ active: !item.active }) });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setError(data.error || 'Could not update announcement');
    await load();
    onChanged?.();
  };

  const remove = async (item: Announcement) => {
    if (!window.confirm(`Delete “${item.title}”?`)) return;
    const response = await api(`/api/admin/announcements/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setError(data.error || 'Could not delete announcement');
    await load();
    onChanged?.();
  };

  const shown = compact ? items.slice(0, 5) : items;
  const manage = can('announcements.manage');

  return <AccessState permission="announcements.view">
    <section className="panel">
      <div className="section-head">
        <h2 className="section-title">Announcements</h2>
        <span className="badge">{items.length}</span>
        {manage && <button className="btn btn-primary btn-sm ml-auto" onClick={() => open('new')}><Plus /> New</button>}
      </div>
      {error && !editing && <p className="note note--bad m-4">{error}</p>}
      <div className="rows">{shown.map((item) => {
        const expired = Boolean(item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now());
        const state = expired ? 'Expired' : item.active ? 'Published' : 'Hidden';
        return <article className="row" key={item.id}>
          <span className={`dot ${expired ? 'dot--warn' : item.active ? 'dot--on' : ''}`} title={state} />
          <div className="row__main">
            <span className="row__title">{item.title}</span>
            <span className="row__sub">{item.message}</span>
          </div>
          <time className="time hidden sm:block" title={item.expiresAt ? `Expires ${formatDate(item.expiresAt)}` : undefined}>{formatDate(item.updatedAt || item.createdAt)}</time>
          {manage && <div className="flex shrink-0">
            <button className="icon-btn" onClick={() => open(item)} title="Edit" aria-label="Edit"><Edit3 /></button>
            <button className="icon-btn" onClick={() => void toggle(item)} title={item.active ? 'Hide' : 'Publish'} aria-label={item.active ? 'Hide' : 'Publish'}>{item.active ? <EyeOff /> : <Eye />}</button>
            {!compact && <button className="icon-btn icon-btn--danger" onClick={() => void remove(item)} title="Delete" aria-label="Delete"><Trash2 /></button>}
          </div>}
        </article>;
      })}</div>
      {!shown.length && <p className="empty">No announcements</p>}
    </section>

    {editing && <Modal
      title={editing === 'new' ? 'New announcement' : 'Edit announcement'}
      onClose={() => setEditing(null)}
      actions={<><button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={() => void save()} disabled={busy || !draft.title.trim() || !draft.message.trim()}>{busy ? 'Saving…' : 'Save'}</button></>}
    >
      <label className="field-label"><span className="label">Title</span><input className="field" maxLength={120} value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} /></label>
      <label className="field-label"><span className="label">Message</span><textarea className="field" maxLength={320} value={draft.message} onChange={(event) => setDraft((value) => ({ ...value, message: event.target.value }))} /></label>
      <label className="field-label"><span className="label">Expires</span><input className="field" type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft((value) => ({ ...value, expiresAt: event.target.value }))} /></label>
      <label className="toggle"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((value) => ({ ...value, active: event.target.checked }))} /><span>Published</span></label>
      {error && <p className="note note--bad">{error}</p>}
    </Modal>}
  </AccessState>;
}
