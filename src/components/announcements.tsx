'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, Edit3, Eye, EyeOff, Plus, Trash2, X } from 'lucide-react';
import AccessState from '@/components/access-state';
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
  const content = <>
    <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5"><Bell className="size-4 text-accent" /><h2 className="font-display text-sm font-semibold uppercase tracking-wider">Recent announcements</h2><span className="badge ml-auto">{items.length}</span>{can('announcements.manage') && <button className="btn btn-primary !min-h-9 !px-3" onClick={() => open('new')}><Plus className="size-4" /> New</button>}</div>
    {error && !editing && <p className="m-4 border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}
    <div className="divide-y divide-line">{shown.map((item) => {
      const expired = Boolean(item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now());
      const state = expired ? 'Expired' : item.active ? 'Published' : 'Unpublished';
      return <article className="flex items-start gap-3 p-4 sm:px-5" key={item.id}><span className={`mt-1.5 size-2 shrink-0 rounded-full ${expired ? 'bg-amber-300' : item.active ? 'bg-emerald-400' : 'bg-slate-600'}`} title={state} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{item.title}</strong>{item.expiresAt && <span className="font-mono text-[11px] text-muted">Expires {formatDate(item.expiresAt)}</span>}</div><p className="mt-1 line-clamp-2 text-sm text-muted">{item.message}</p><span className="mt-2 block font-mono text-[11px] text-slate-600">{item.author} · {formatDate(item.updatedAt || item.createdAt)}</span></div>{can('announcements.manage') && <div className="flex shrink-0 gap-1"><button className="icon-btn" onClick={() => open(item)} title="Edit" aria-label="Edit"><Edit3 className="size-4" /></button><button className="icon-btn" onClick={() => void toggle(item)} title={item.active ? 'Unpublish' : 'Publish'} aria-label={item.active ? 'Unpublish' : 'Publish'}>{item.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>{!compact && <button className="icon-btn text-red-300" onClick={() => void remove(item)} title="Delete" aria-label="Delete"><Trash2 className="size-4" /></button>}</div>}</article>;
    })}</div>
    {!shown.length && <div className="p-8 text-center text-sm text-muted">No announcements.</div>}
  </>;

  return <AccessState permission="announcements.view"><section className="panel overflow-hidden">{content}</section>{editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setEditing(null); }}><section className="modal-panel max-w-xl" role="dialog" aria-modal="true" aria-label="Announcement editor"><div className="modal-head"><h2 className="font-display text-lg font-semibold uppercase tracking-wider">Announcement</h2><button className="icon-btn" onClick={() => setEditing(null)} aria-label="Close"><X className="size-4" /></button></div><div className="grid gap-4 p-4 sm:p-5"><label><span className="label mb-2 block">Title</span><input className="field" maxLength={120} value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} /></label><label><span className="label mb-2 block">Message</span><textarea className="field !h-auto min-h-24 py-2" maxLength={320} value={draft.message} onChange={(event) => setDraft((value) => ({ ...value, message: event.target.value }))} /></label><label><span className="label mb-2 block">Expiry</span><input className="field" type="datetime-local" value={draft.expiresAt} onChange={(event) => setDraft((value) => ({ ...value, expiresAt: event.target.value }))} /></label><label className="flex min-h-10 items-center gap-3 border border-line bg-black/20 px-3"><input type="checkbox" checked={draft.active} onChange={(event) => setDraft((value) => ({ ...value, active: event.target.checked }))} /><span className="text-sm">Published</span></label>{error && <p className="border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}</div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={() => void save()} disabled={busy || !draft.title.trim() || !draft.message.trim()}>{busy ? 'Saving…' : 'Save'}</button></div></section></div>}</AccessState>;
}
