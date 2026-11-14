'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, Eye, EyeOff, Plus, Search, Trash2 } from 'lucide-react';
import AccessState from '@/components/access-state';
import Modal from '@/components/modal';
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
    return <label className="toggle"><input type="checkbox" checked={value === true} onChange={(event) => onChange(event.target.checked)} /><span>{field.label}</span></label>;
  }
  const label = <span className="label">{field.label}</span>;
  if (field.type === 'select') {
    return <label className="field-label">{label}<select className="field" value={String(value ?? '')} onChange={(event) => onChange(event.target.value)}>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
  }
  if (field.type === 'textarea' || field.type === 'list') {
    const shown = field.type === 'list' && Array.isArray(value) ? value.join('\n') : String(value ?? '');
    return <label className="field-label">{label}<textarea className="field" rows={field.key === 'Steps' ? 7 : 4} value={shown} placeholder={field.type === 'list' ? 'One per line' : undefined} onChange={(event) => onChange(field.type === 'list' ? event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) : event.target.value)} required={field.required} /></label>;
  }
  return <label className="field-label">{label}<input className="field" type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'} value={String(value ?? '')} onChange={(event) => onChange(field.type === 'number' ? Number(event.target.value) : event.target.value)} required={field.required} /></label>;
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

  const title = config.singular.replace(/\b\w/g, (character) => character.toUpperCase());

  return (
    <AccessState permission={config.viewPermission}>
      {error && !editing && <p className="note note--bad">{error}</p>}
      <section className="panel">
        <div className="section-head">
          <label className="search max-w-sm"><Search aria-hidden="true" /><span className="sr-only">Search</span><input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" /></label>
          <span className="badge">{visible.length}</span>
          {manage && <button className="btn btn-primary btn-sm ml-auto" onClick={openNew}><Plus /> Add</button>}
        </div>
        <div className="table-scroll">
          <table className="data-table min-w-[680px]">
            <thead><tr><th>Name</th>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}{config.hasStatus && <th>Status</th>}<th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{visible.map((record) => {
              const active = record.data.active !== false;
              return <tr key={record.id}>
                <td>{record.id}</td>
                {config.columns.map((column) => <td className="muted max-w-[16rem] truncate" title={valueText(record.data[column.key])} key={column.key}>{valueText(record.data[column.key])}</td>)}
                {config.hasStatus && <td><span className={`badge ${active ? 'status-active' : 'status-muted'}`}>{active ? 'Live' : 'Hidden'}</span></td>}
                <td><div className="flex justify-end">{manage && <>
                  <button className="icon-btn" onClick={() => openEdit(record)} aria-label={`Edit ${record.id}`} title="Edit"><Edit3 /></button>
                  {config.hasStatus && <button className="icon-btn" onClick={() => void toggle(record)} aria-label={active ? 'Hide' : 'Publish'} title={active ? 'Hide' : 'Publish'}>{active ? <EyeOff /> : <Eye />}</button>}
                  <button className="icon-btn icon-btn--danger" onClick={() => void remove(record)} aria-label={`Delete ${record.id}`} title="Delete"><Trash2 /></button>
                </>}</div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        {!visible.length && <p className="empty">{records.length ? 'No matches' : 'Nothing here yet'}</p>}
      </section>

      {editing && <Modal
        title={editing === 'new' ? `New ${config.singular}` : recordId || title}
        onClose={() => setEditing(null)}
        actions={<><button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={() => void save()} disabled={busy || !recordId.trim()}>{busy ? 'Saving…' : 'Save'}</button></>}
      >
        <label className="field-label"><span className="label">Name</span><input className="field" value={recordId} onChange={(event) => setRecordId(event.target.value)} required /></label>
        {config.fields.map((field) => <Field field={field} value={draft[field.key]} onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))} key={field.key} />)}
        {config.hasStatus && <label className="toggle"><input type="checkbox" checked={draft.active !== false} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} /><span>Published</span></label>}
        {error && <p className="note note--bad">{error}</p>}
      </Modal>}
    </AccessState>
  );
}
