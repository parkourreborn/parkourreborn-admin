'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Clipboard, Edit3, Eye, EyeOff, ImagePlus, Trash2, UploadCloud, X } from 'lucide-react';
import AccessState from '@/components/access-state';
import { useAuth } from '@/components/auth-provider';
import type { MediaItem } from '@/lib/types';

const maxBytes = 4 * 1024 * 1024;
const allowedTypes = new Set(['image/gif', 'image/png', 'image/jpeg', 'image/webp']);
const bytesLabel = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value)) : '—';
const nameFromFile = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

export default function MediaManager() {
  const { admin, api, can, setup } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [altText, setAltText] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [editDraft, setEditDraft] = useState({ displayName: '', altText: '', category: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    if (!admin) return;
    try {
      const response = await api('/api/admin/media');
      const data = await response.json() as { media?: MediaItem[]; error?: string };
      if (!response.ok || !data.media) throw new Error(data.error || 'Could not load media');
      setItems(data.media);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load media');
    }
  }, [admin, api]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const choose = (next?: File) => {
    setError('');
    if (!next) return;
    if (!allowedTypes.has(next.type)) return setError('Choose a GIF, PNG, JPG, JPEG, or WebP file.');
    if (next.size <= 0 || next.size > maxBytes) return setError('Files must be 4 MB or smaller.');
    setFile(next);
    setDisplayName(nameFromFile(next.name));
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const init = await api('/api/admin/media/uploads/init', { method: 'POST', body: JSON.stringify({ fileName: file.name, contentType: file.type, bytes: file.size, displayName, altText, category, description }) });
      const session = await init.json() as { uploadId?: string; uploadUrl?: string; error?: string };
      if (!init.ok || !session.uploadId || !session.uploadUrl) throw new Error(session.error || 'Could not start upload');
      const put = await fetch(session.uploadUrl, { method: 'PUT', headers: { 'content-type': file.type }, body: file });
      if (!put.ok) throw new Error('R2 upload failed');
      const complete = await api('/api/admin/media/uploads/complete', { method: 'POST', body: JSON.stringify({ uploadId: session.uploadId }) });
      const result = await complete.json() as { error?: string };
      if (!complete.ok) throw new Error(result.error || 'Could not verify upload');
      setFile(null);
      setDisplayName('');
      setAltText('');
      setCategory('');
      setDescription('');
      if (inputRef.current) inputRef.current.value = '';
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const patch = async (item: MediaItem, body: Record<string, unknown>) => {
    const response = await api(`/api/admin/media/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify(body) });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setError(data.error || 'Could not update media');
    setEditing(null);
    await load();
  };

  const remove = async (item: MediaItem) => {
    if (!window.confirm(`Permanently delete “${item.displayName}” from Firestore and R2?`)) return;
    const response = await api(`/api/admin/media/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setError(data.error || 'Could not delete media');
    await load();
  };

  const copy = async (item: MediaItem) => {
    await navigator.clipboard.writeText(item.publicUrl);
    setCopied(item.id);
    window.setTimeout(() => setCopied(''), 1500);
  };

  const openEdit = (item: MediaItem) => {
    setEditing(item);
    setEditDraft({ displayName: item.displayName, altText: item.altText, category: item.category, description: item.description });
    setError('');
  };

  return <AccessState permission="media.view">
    {can('media.upload') && <section className="panel mb-4 p-4 sm:p-5"><div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
      <button className="group grid min-h-40 place-items-center border border-dashed border-accent/30 bg-accent/[0.035] p-5 text-center hover:border-accent/60" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files[0]); }}>
        <span><UploadCloud className="mx-auto mb-3 size-7 text-accent" /><strong className="block text-sm">{file ? file.name : 'Drop file or browse'}</strong><span className="mt-1 block text-xs text-muted">GIF, PNG, JPG, WebP · 4 MB</span>{file && <span className="badge mt-3">{bytesLabel(file.size)}</span>}</span>
      </button>
      <input ref={inputRef} className="sr-only" type="file" accept=".gif,.png,.jpg,.jpeg,.webp,image/gif,image/png,image/jpeg,image/webp" onChange={(event) => choose(event.target.files?.[0])} />
      <div className="grid gap-3 sm:grid-cols-2"><label><span className="label mb-2 block">Display name</span><input className="field" value={displayName} maxLength={120} onChange={(event) => setDisplayName(event.target.value)} /></label><label><span className="label mb-2 block">Category</span><input className="field" value={category} maxLength={80} onChange={(event) => setCategory(event.target.value)} /></label><label><span className="label mb-2 block">Alt text</span><input className="field" value={altText} maxLength={240} onChange={(event) => setAltText(event.target.value)} /></label><label><span className="label mb-2 block">Description</span><input className="field" value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} /></label><div className="sm:col-span-2 flex justify-end"><button className="btn btn-primary" onClick={() => void upload()} disabled={busy || !file || !displayName.trim() || !setup?.r2}><ImagePlus className="size-4" />{busy ? 'Uploading…' : 'Upload'}</button></div></div>
    </div></section>}
    {error && <div className="mb-4 flex items-start gap-2 border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200"><X className="mt-0.5 size-4 shrink-0" />{error}</div>}
    <section className="panel overflow-hidden"><div className="flex items-center border-b border-line px-4 py-3 sm:px-5"><h2 className="font-display text-sm font-semibold uppercase tracking-wider">Media library</h2><span className="badge ml-auto">{items.length}</span></div><div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article className="min-w-0 bg-[#090e16] p-4" key={item.id}><div className="flex gap-3"><div className="grid size-16 shrink-0 place-items-center overflow-hidden border border-line bg-black/30"><img className="max-h-full max-w-full object-contain" src={item.publicUrl} alt={item.altText || item.displayName} /></div><div className="min-w-0 flex-1"><div className="flex items-start gap-2"><strong className="min-w-0 flex-1 truncate">{item.displayName}</strong><span className={`mt-1 size-2 shrink-0 rounded-full ${item.active ? 'bg-emerald-400' : 'bg-slate-600'}`} title={item.active ? 'Active' : 'Disabled'} /></div><p className="mt-1 truncate font-mono text-[11px] text-muted" title={item.objectKey}>{item.objectKey}</p><p className="mt-2 text-xs text-slate-600">{bytesLabel(item.fileSize)} · {dateLabel(item.createdAt)}</p></div></div><div className="mt-3 flex items-center gap-1"><button className="icon-btn" onClick={() => void copy(item)} title="Copy public URL" aria-label="Copy public URL">{copied === item.id ? <Check className="size-4 text-emerald-300" /> : <Clipboard className="size-4" />}</button>{can('media.upload') && <><button className="icon-btn" onClick={() => openEdit(item)} title="Edit" aria-label="Edit"><Edit3 className="size-4" /></button><button className="icon-btn" onClick={() => void patch(item, { active: !item.active })} title={item.active ? 'Disable' : 'Reactivate'} aria-label={item.active ? 'Disable' : 'Reactivate'}>{item.active ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></>}{can('media.delete') && !item.active && <button className="icon-btn ml-auto text-red-300" onClick={() => void remove(item)} title="Permanently delete" aria-label="Permanently delete"><Trash2 className="size-4" /></button>}</div></article>)}</div>{!items.length && <div className="p-10 text-center text-sm text-muted">No media.</div>}</section>
    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setEditing(null); }}><section className="modal-panel max-w-xl" role="dialog" aria-modal="true" aria-label="Edit media"><div className="modal-head"><h2 className="font-display text-lg font-semibold uppercase tracking-wider">Edit media</h2><button className="icon-btn" onClick={() => setEditing(null)} aria-label="Close"><X className="size-4" /></button></div><div className="grid gap-4 p-4 sm:p-5"><label><span className="label mb-2 block">Display name</span><input className="field" value={editDraft.displayName} onChange={(event) => setEditDraft((value) => ({ ...value, displayName: event.target.value }))} /></label><label><span className="label mb-2 block">Category</span><input className="field" value={editDraft.category} onChange={(event) => setEditDraft((value) => ({ ...value, category: event.target.value }))} /></label><label><span className="label mb-2 block">Alt text</span><input className="field" value={editDraft.altText} onChange={(event) => setEditDraft((value) => ({ ...value, altText: event.target.value }))} /></label><label><span className="label mb-2 block">Description</span><textarea className="field !h-auto min-h-24 py-2" value={editDraft.description} onChange={(event) => setEditDraft((value) => ({ ...value, description: event.target.value }))} /></label></div><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={() => void patch(editing, editDraft)} disabled={!editDraft.displayName.trim()}>Save</button></div></section></div>}
  </AccessState>;
}
