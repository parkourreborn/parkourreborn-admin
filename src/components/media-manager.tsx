'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Clipboard, Edit3, ImagePlus, Trash2, UploadCloud, X } from 'lucide-react';
import AccessState from '@/components/access-state';
import { useAuth } from '@/components/auth-provider';
import type { MediaItem } from '@/lib/types';

const maxBytes = 4 * 1024 * 1024;
const allowedTypes = new Set(['image/gif', 'image/png', 'image/jpeg', 'image/webp']);
const bytesLabel = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const nameFromFile = (name: string) => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
type SourceMode = 'upload' | 'url';

export default function MediaManager() {
  const { admin, api, can, setup } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [sourceMode, setSourceMode] = useState<SourceMode>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [link, setLink] = useState('');
  const [redirect, setRedirect] = useState('');
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [editMode, setEditMode] = useState<SourceMode>('url');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editDraft, setEditDraft] = useState({ label: '', link: '', redirect: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = useCallback(async () => {
    if (!admin) return;
    try {
      const response = await api('/api/admin/media');
      const data = await response.json() as { media?: MediaItem[]; error?: string };
      if (!response.ok || !data.media) throw new Error(data.error || 'Could not load GIFs');
      setItems(data.media);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load GIFs');
    }
  }, [admin, api]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const validFile = (next?: File) => {
    setError('');
    if (!next) return false;
    if (!allowedTypes.has(next.type)) {
      setError('Choose a GIF, PNG, JPG, JPEG, or WebP file.');
      return false;
    }
    if (next.size <= 0 || next.size > maxBytes) {
      setError('Files must be 4 MB or smaller.');
      return false;
    }
    return true;
  };

  const choose = (next?: File) => {
    if (!validFile(next) || !next) return;
    setFile(next);
    if (!label.trim()) setLabel(nameFromFile(next.name));
  };

  const chooseEdit = (next?: File) => {
    if (!validFile(next) || !next) return;
    setEditFile(next);
  };

  const uploadFile = async (nextFile: File, nextLabel: string, nextRedirect: string, replaceId?: string) => {
    const init = await api('/api/admin/media/uploads/init', {
      method: 'POST',
      body: JSON.stringify({
        fileName: nextFile.name,
        contentType: nextFile.type,
        bytes: nextFile.size,
        label: nextLabel,
        redirect: nextRedirect,
        ...(replaceId ? { replaceId } : {}),
      }),
    });
    const session = await init.json() as { uploadId?: string; uploadUrl?: string; error?: string };
    if (!init.ok || !session.uploadId || !session.uploadUrl) throw new Error(session.error || 'Could not start upload');
    const put = await fetch(session.uploadUrl, { method: 'PUT', headers: { 'content-type': nextFile.type }, body: nextFile });
    if (!put.ok) throw new Error('R2 upload failed');
    const complete = await api('/api/admin/media/uploads/complete', {
      method: 'POST',
      body: JSON.stringify({ uploadId: session.uploadId }),
    });
    const result = await complete.json() as { error?: string };
    if (!complete.ok) throw new Error(result.error || 'Could not verify upload');
  };

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      if (sourceMode === 'upload') {
        if (!file) throw new Error('Choose a file to upload');
        await uploadFile(file, label.trim(), '');
      } else {
        const response = await api('/api/admin/media', {
          method: 'POST',
          body: JSON.stringify({ label: label.trim(), link: link.trim(), redirect: redirect.trim() }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || 'Could not add GIF');
      }
      setFile(null);
      setLabel('');
      setLink('');
      setRedirect('');
      if (inputRef.current) inputRef.current.value = '';
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not add GIF');
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      if (editMode === 'upload') {
        if (!editFile) throw new Error('Choose a replacement file');
        await uploadFile(editFile, editDraft.label.trim(), '', editing.id);
      } else {
        const response = await api(`/api/admin/media/${encodeURIComponent(editing.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({
            label: editDraft.label.trim(),
            link: editDraft.link.trim(),
            redirect: editDraft.redirect.trim(),
          }),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) throw new Error(result.error || 'Could not update GIF');
      }
      setEditing(null);
      setEditFile(null);
      if (editInputRef.current) editInputRef.current.value = '';
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not update GIF');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: MediaItem) => {
    if (!window.confirm(`Permanently delete “${item.id}”? Any associated R2 file will also be removed.`)) return;
    setError('');
    const response = await api(`/api/admin/media/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    const data = await response.json() as { error?: string };
    if (!response.ok) return setError(data.error || 'Could not delete GIF');
    await load();
  };

  const copy = async (item: MediaItem) => {
    await navigator.clipboard.writeText(item.link);
    setCopied(item.id);
    window.setTimeout(() => setCopied(''), 1500);
  };

  const openEdit = (item: MediaItem) => {
    setEditing(item);
    setEditMode('url');
    setEditFile(null);
    setEditDraft({ label: item.id, link: item.link, redirect: item.redirect });
    setError('');
    if (editInputRef.current) editInputRef.current.value = '';
  };

  const createDisabled = busy
    || !label.trim()
    || (sourceMode === 'upload' ? !file || !setup?.r2 : !link.trim());
  const editDisabled = busy
    || !editDraft.label.trim()
    || (editMode === 'upload' ? !editFile || !setup?.r2 : !editDraft.link.trim());

  return <AccessState permission="media.view">
    {can('media.upload') && <section className="panel mb-4 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="mr-auto font-display text-sm font-semibold uppercase tracking-wider">Add GIF</h2>
        <div className="flex gap-2" aria-label="GIF source">
          <button type="button" className={`btn ${sourceMode === 'upload' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSourceMode('upload')}>Upload file</button>
          <button type="button" className={`btn ${sourceMode === 'url' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSourceMode('url')}>Use GIF URL</button>
        </div>
      </div>

      <div className={`grid gap-4 ${sourceMode === 'upload' ? 'lg:grid-cols-[0.72fr_1.28fr]' : ''}`}>
        {sourceMode === 'upload' && <>
          <button type="button" className="group grid min-h-40 place-items-center border border-dashed border-accent/30 bg-accent/[0.035] p-5 text-center hover:border-accent/60" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files[0]); }}>
            <span><UploadCloud className="mx-auto mb-3 size-7 text-accent" /><strong className="block text-sm">{file ? file.name : 'Drop file or browse'}</strong><span className="mt-1 block text-xs text-muted">GIF, PNG, JPG, WebP · 4 MB</span>{file && <span className="badge mt-3">{bytesLabel(file.size)}</span>}</span>
          </button>
          <input ref={inputRef} className="sr-only" type="file" accept=".gif,.png,.jpg,.jpeg,.webp,image/gif,image/png,image/jpeg,image/webp" onChange={(event) => choose(event.target.files?.[0])} />
        </>}

        <div className="grid content-start gap-3 sm:grid-cols-2">
          <label><span className="label mb-2 block">Label</span><input className="field" value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} /></label>
          {sourceMode === 'url' && <label><span className="label mb-2 block">GIF URL</span><input className="field" type="url" value={link} onChange={(event) => setLink(event.target.value)} /></label>}
          {sourceMode === 'url' && <label className="sm:col-span-2"><span className="label mb-2 block">Redirect URL</span><input className="field" type="url" value={redirect} onChange={(event) => setRedirect(event.target.value)} /></label>}
          <div className="flex justify-end sm:col-span-2"><button type="button" className="btn btn-primary" onClick={() => void create()} disabled={createDisabled}><ImagePlus className="size-4" />{busy ? 'Saving…' : sourceMode === 'upload' ? 'Upload GIF' : 'Add GIF'}</button></div>
        </div>
      </div>
    </section>}

    {error && !editing && <div className="mb-4 flex items-start gap-2 border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200"><X className="mt-0.5 size-4 shrink-0" />{error}</div>}

    <section className="panel overflow-hidden">
      <div className="flex items-center border-b border-line px-4 py-3 sm:px-5"><h2 className="font-display text-sm font-semibold uppercase tracking-wider">GIF library</h2><span className="badge ml-auto">{items.length}</span></div>
      <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => <article className="min-w-0 bg-[#090e16] p-4" key={item.id}>
          <div className="flex gap-3">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden border border-line bg-black/30"><img className="max-h-full max-w-full object-contain" src={item.link} alt="" /></div>
            <div className="min-w-0 flex-1">
              <strong className="block truncate">{item.id}</strong>
              <p className="mt-1 truncate font-mono text-[11px] text-muted" title={item.link}>{item.link}</p>
              <p className="mt-2 truncate text-xs text-slate-600" title={item.redirect}>{item.redirect || 'No redirect URL'}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1">
            <button type="button" className="icon-btn" onClick={() => void copy(item)} title="Copy GIF URL" aria-label="Copy GIF URL">{copied === item.id ? <Check className="size-4 text-emerald-300" /> : <Clipboard className="size-4" />}</button>
            {can('media.upload') && <button type="button" className="icon-btn" onClick={() => openEdit(item)} title="Edit" aria-label="Edit"><Edit3 className="size-4" /></button>}
            {can('media.delete') && <button type="button" className="icon-btn ml-auto text-red-300" onClick={() => void remove(item)} title="Permanently delete" aria-label="Permanently delete"><Trash2 className="size-4" /></button>}
          </div>
        </article>)}
      </div>
      {!items.length && <div className="p-10 text-center text-sm text-muted">No GIFs.</div>}
    </section>

    {editing && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setEditing(null); }}>
      <section className="modal-panel max-w-xl" role="dialog" aria-modal="true" aria-label="Edit GIF">
        <div className="modal-head"><h2 className="font-display text-lg font-semibold uppercase tracking-wider">Edit GIF</h2><button type="button" className="icon-btn" onClick={() => setEditing(null)} aria-label="Close" disabled={busy}><X className="size-4" /></button></div>
        <div className="grid gap-4 p-4 sm:p-5">
          <div className="flex gap-2" aria-label="GIF source">
            <button type="button" className={`btn ${editMode === 'url' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEditMode('url')}>Use image URL</button>
            <button type="button" className={`btn ${editMode === 'upload' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setEditMode('upload')}>Upload new file</button>
          </div>
          <label><span className="label mb-2 block">Label</span><input className="field" value={editDraft.label} maxLength={120} onChange={(event) => setEditDraft((value) => ({ ...value, label: event.target.value }))} /></label>
          {editMode === 'url' ? <label><span className="label mb-2 block">Image URL</span><input className="field" type="url" value={editDraft.link} onChange={(event) => setEditDraft((value) => ({ ...value, link: event.target.value }))} /></label> : <>
            <button type="button" className="group grid min-h-32 place-items-center border border-dashed border-accent/30 bg-accent/[0.035] p-4 text-center hover:border-accent/60" onClick={() => editInputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseEdit(event.dataTransfer.files[0]); }}>
              <span><UploadCloud className="mx-auto mb-2 size-6 text-accent" /><strong className="block text-sm">{editFile ? editFile.name : 'Choose replacement file'}</strong>{editFile && <span className="badge mt-2">{bytesLabel(editFile.size)}</span>}</span>
            </button>
            <input ref={editInputRef} className="sr-only" type="file" accept=".gif,.png,.jpg,.jpeg,.webp,image/gif,image/png,image/jpeg,image/webp" onChange={(event) => chooseEdit(event.target.files?.[0])} />
          </>}
          {editMode === 'url' && <label><span className="label mb-2 block">Redirect URL</span><input className="field" type="url" value={editDraft.redirect} onChange={(event) => setEditDraft((value) => ({ ...value, redirect: event.target.value }))} /></label>}
          {error && <div className="flex items-start gap-2 border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200"><X className="mt-0.5 size-4 shrink-0" />{error}</div>}
        </div>
        <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</button><button type="button" className="btn btn-primary" onClick={() => void saveEdit()} disabled={editDisabled}>{busy ? 'Saving…' : 'Save'}</button></div>
      </section>
    </div>}
  </AccessState>;
}
