'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, Eye, EyeOff, Plus, Search, Trash2, X } from 'lucide-react';
import AccessState from '@/components/access-state';
import { useAuth } from '@/components/auth-provider';
import { contentManagerConfigs } from '@/lib/content-manager-config';
import type { ContentField, ContentManagerConfig } from '@/lib/content-manager-config';
import type { ContentRecord } from '@/lib/types';

const valueText = (value: unknown) => {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return value === undefined || value === null || value === '' ? '—' : String(value);
};

function Field({ field, value, onChange }: { field: ContentField; value: unknown; onChange: (value: unknown) => void }) {
  if (field.type === 'checkbox') {
    return <label className="flex min-h-10 items-center gap-3 border border-line bg-black/20 px-3"><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} /><span className="text-sm">{field.label}</span></label>;
  }
  if (field.type === 'select') {
    return <label><span className="label mb-2 block">{field.label}</span><select className="field" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
  }
  if (field.type === 'textarea' || field.type === 'list') {
    const shown = field.type === 'list' && Array.isArray(value) ? value.join('\n') : String(value ?? '');
    return <label><span className="label mb-2 block">{field.label}{field.type === 'list' && <span className="ml-2 normal-case tracking-normal text-slate-600">one per line</span>}</span><textarea className="field !h-auto min-h-24 py-2" rows={field.key === 'Steps' ? 7 : 4} value={shown} onChange={(event) => onChange(field.type === 'list' ? event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) : event.target.value)} required={field.required} /></label>;
  }
  return <label><span className="label mb-2 block">{field.label}</span><input className="field" type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'} value={String(value ?? '')} onChange={(event) => onChange(field.type === 'number' ? Number(event.target.value) : event.target.value)} required={field.required} /></label>;
}

export default function ContentManager({ section }: { section: ContentManagerConfig['section'] }) {
  const config = contentManagerConfigs[section];
  const { admin, api, can } = useAuth();
  const [records, setRecords] = useState<ContentRecord[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ContentRecord | 'new' | null>(null);
  const [recordId, setRecordId] = useState('');
  const [draft, setDraft] = useState<Record<string, unknown>>(config.defaults);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!admin) return;
    setError('');
    try {
      const response = await api(`/api/admin/content/${config.section}`);
      const data = await response.json() as { records?: ContentRecord[]; error?: string };
      if (!response.ok || !data.records) throw new Error(data.error || 'Could not load content');
      setRecords(data.records);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load content');
    }
  }, [admin, api, config.section]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  useEffect(() => {
    if (!editing) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setEditing(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [editing]);

  const visible = useMemo(() => {
    const key = query.trim().toLowerCase();
    return key ? records.filter((record) => `${record.id} ${JSON.stringify(record.data)}`.toLowerCase().includes(key)) : records;
  }, [query, records]);

  const openNew = () => {
    setRecordId('');
    setDraft({ ...config.defaults });
    setEditing('new');
    setError('');
  };

  const openEdit = (record: ContentRecord) => {
    setRecordId(record.id);
    setDraft({ ...config.defaults, ...record.data, active: record.data.active !== false });
    setEditing(record);
    setError('');
  };

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const data = Object.fromEntries([...config.fields.map((field) => [field.key, draft[field.key]]), ['active', draft.active !== false]]);
      const creating = editing === 'new';
      const endpoint = creating ? `/api/admin/content/${config.section}` : `/api/admin/content/${config.section}/${encodeURIComponent((editing as ContentRecord).id)}`;
      const response = await api(endpoint, { method: creating ? 'POST' : 'PATCH', body: JSON.stringify({ id: recordId.trim(), data }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || `Could not save ${config.singular}`);
      setEditing(null);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : `Could not save ${config.singular}`);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (record: ContentRecord) => {
    const active = record.data.active !== false;
    const response = await api(`/api/admin/content/${config.section}/${encodeURIComponent(record.id)}`, { method: 'PATCH', body: JSON.stringify({ data: { active: !active } }) });
    const body = await response.json() as { error?: string };
    if (!response.ok) return setError(body.error || `Could not update ${config.singular}`);
    await load();
  };

  const remove = async (record: ContentRecord) => {
    if (!window.confirm(`Permanently delete “${record.id}”?`)) return;
    const response = await api(`/api/admin/content/${config.section}/${encodeURIComponent(record.id)}`, { method: 'DELETE' });
    const body = await response.json() as { error?: string };
    if (!response.ok) return setError(body.error || `Could not delete ${config.singular}`);
    await load();
  };

  const manage = can(config.managePermission);

  return (
    <AccessState permission={config.viewPermission}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><span className="sr-only">Search</span><input className="field pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${config.section}`} /></label>
        <span className="badge">{visible.length} / {records.length}</span>
        {manage && <button className="btn btn-primary ml-auto" onClick={openNew}><Plus className="size-4" /> Add {config.singular}</button>}
      </div>
      {error && !editing && <div className="mb-4 border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</div>}

      <section className="panel overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="data-table min-w-[760px]">
            <thead><tr><th>Name</th>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}{config.hasStatus && <th>Status</th>}<th className="text-right">Actions</th></tr></thead>
            <tbody>{visible.map((record) => {
              const active = record.data.active !== false;
              return <tr key={record.id}><td><strong>{record.id}</strong></td>{config.columns.map((column) => <td className="max-w-xs truncate text-muted" title={valueText(record.data[column.key])} key={column.key}>{valueText(record.data[column.key])}</td>)}{config.hasStatus && <td><span className={`badge ${active ? 'status-active' : 'status-muted'}`}>{active ? 'Published' : 'Disabled'}</span></td>}<td><div className="flex justify-end gap-1">{manage && <><button className="icon-btn" onClick={() => openEdit(record)} aria-label={`Edit ${record.id}`} title="Edit"><Edit3 className="size-4" /></button>{config.hasStatus && <button className="icon-btn" onClick={() => void toggle(record)} aria-label={active ? 'Disable' : 'Publish'} title={active ? 'Disable' : 'Publish'}>{active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>}<button className="icon-btn text-red-300" onClick={() => void remove(record)} aria-label={`Delete ${record.id}`} title="Delete"><Trash2 className="size-4" /></button></>}</div></td></tr>;
            })}</tbody>
          </table>
        </div>
        <div className="divide-y divide-line md:hidden">{visible.map((record) => {
          const active = record.data.active !== false;
          return <article className="p-4" key={record.id}><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><strong className="block truncate">{record.id}</strong><span className={`badge mt-2 ${active ? 'status-active' : 'status-muted'}`}>{active ? 'Published' : 'Disabled'}</span></div>{manage && <div className="flex gap-1"><button className="icon-btn" onClick={() => openEdit(record)} aria-label="Edit"><Edit3 className="size-4" /></button><button className="icon-btn" onClick={() => void toggle(record)} aria-label={active ? 'Disable' : 'Publish'}>{active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button><button className="icon-btn text-red-300" onClick={() => void remove(record)} aria-label="Delete"><Trash2 className="size-4" /></button></div>}</div><div className="mt-3 grid gap-2 text-sm">{config.columns.slice(0, 3).map((column) => <div className="flex gap-3" key={column.key}><span className="w-24 shrink-0 text-muted">{column.label}</span><span className="min-w-0 truncate">{valueText(record.data[column.key])}</span></div>)}</div></article>;
        })}</div>
        {!visible.length && <div className="p-10 text-center text-sm text-muted">{records.length ? 'No matches.' : 'No records.'}</div>}
      </section>

      {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setEditing(null); }}><section className="modal-panel" role="dialog" aria-modal="true" aria-label={`${editing === 'new' ? 'Add' : 'Edit'} ${config.singular}`}>
        <div className="modal-head"><div><span className="label">{editing === 'new' ? 'New' : 'Edit'}</span><h2 className="font-display text-lg font-semibold uppercase tracking-wider">{config.singular}</h2></div><button className="icon-btn" onClick={() => setEditing(null)} aria-label="Close"><X className="size-4" /></button></div>
        <div className="grid gap-4 p-4 sm:p-5">
          <label><span className="label mb-2 block">Name / document ID</span><input className="field" value={recordId} onChange={(event) => setRecordId(event.target.value)} required /></label>
          {config.fields.map((field) => <Field field={field} value={draft[field.key]} onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))} key={field.key} />)}
          {config.hasStatus && <label className="flex min-h-10 items-center gap-3 border border-line bg-black/20 px-3"><input type="checkbox" checked={draft.active !== false} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} /><span className="text-sm">Published</span></label>}
          {error && <p className="border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}
        </div>
        <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={() => void save()} disabled={busy || !recordId.trim()}>{busy ? 'Saving…' : 'Save'}</button></div>
      </section></div>}
    </AccessState>
  );
}
