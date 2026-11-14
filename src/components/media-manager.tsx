'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Clipboard, Edit3, ImagePlus, Trash2, UploadCloud } from 'lucide-react';
import AccessState from '@/components/access-state';
import Modal from '@/components/modal';
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

  const accept = '.gif,.png,.jpg,.jpeg,.webp,image/gif,image/png,image/jpeg,image/webp';

  return <AccessState permission="media.view">
    {can('media.upload') && <section className="panel panel--pad">
      <div className="section-head">
        <h2 className="section-title">Add GIF</h2>
        <div className="tabs ml-auto" aria-label="Source">
          <button type="button" className={sourceMode === 'upload' ? 'is-on' : ''} onClick={() => setSourceMode('upload')}>File</button>
          <button type="button" className={sourceMode === 'url' ? 'is-on' : ''} onClick={() => setSourceMode('url')}>URL</button>
        </div>
      </div>

      <div className={`grid gap-4 ${sourceMode === 'upload' ? 'md:grid-cols-[0.8fr_1.2fr]' : ''}`}>
        {sourceMode === 'upload' && <>
          <button type="button" className="dropzone" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); choose(event.dataTransfer.files[0]); }}>
            <span><UploadCloud aria-hidden="true" />{file ? file.name : 'Drop file'}{file && <span className="badge mt-3">{bytesLabel(file.size)}</span>}</span>
          </button>
          <input ref={inputRef} className="sr-only" type="file" accept={accept} onChange={(event) => choose(event.target.files?.[0])} />
        </>}

        <div className="grid content-start gap-3 sm:grid-cols-2">
          <label className="field-label"><span className="label">Name</span><input className="field" value={label} maxLength={120} onChange={(event) => setLabel(event.target.value)} /></label>
          {sourceMode === 'url' && <label className="field-label"><span className="label">GIF URL</span><input className="field" type="url" value={link} onChange={(event) => setLink(event.target.value)} /></label>}
          {sourceMode === 'url' && <label className="field-label sm:col-span-2"><span className="label">Redirect</span><input className="field" type="url" value={redirect} onChange={(event) => setRedirect(event.target.value)} /></label>}
          <div className="flex justify-end sm:col-span-2"><button type="button" className="btn btn-primary" onClick={() => void create()} disabled={createDisabled}><ImagePlus />{busy ? 'Saving…' : 'Add'}</button></div>
        </div>
      </div>
    </section>}

    {error && !editing && <p className="note note--bad">{error}</p>}

    <section className="panel">
      <div className="section-head"><h2 className="section-title">Library</h2><span className="badge">{items.length}</span></div>
      <div className="grid gap-px bg-[var(--hud-hairline)] sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => <article className="flex min-w-0 items-center gap-3 bg-[var(--hud-panel-bg)] p-3" key={item.id}>
          <div className="grid size-14 shrink-0 place-items-center overflow-hidden border border-line bg-[var(--hub-media-bg)]"><img className="max-h-full max-w-full object-contain" src={item.link} alt="" /></div>
          <div className="row__main">
            <span className="row__title">{item.id}</span>
            {item.redirect && <span className="row__sub" title={item.redirect}>{item.redirect}</span>}
          </div>
          <div className="flex shrink-0">
            <button type="button" className="icon-btn" onClick={() => void copy(item)} title="Copy URL" aria-label="Copy URL">{copied === item.id ? <Check className="text-[#8fe6b4]" /> : <Clipboard />}</button>
            {can('media.upload') && <button type="button" className="icon-btn" onClick={() => openEdit(item)} title="Edit" aria-label="Edit"><Edit3 /></button>}
            {can('media.delete') && <button type="button" className="icon-btn icon-btn--danger" onClick={() => void remove(item)} title="Delete" aria-label="Delete"><Trash2 /></button>}
          </div>
        </article>)}
      </div>
      {!items.length && <p className="empty">No GIFs</p>}
    </section>

    {editing && <Modal
      title={editing.id}
      onClose={() => { if (!busy) setEditing(null); }}
      actions={<><button type="button" className="btn btn-secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</button><button type="button" className="btn btn-primary" onClick={() => void saveEdit()} disabled={editDisabled}>{busy ? 'Saving…' : 'Save'}</button></>}
    >
      <div className="tabs" aria-label="Source">
        <button type="button" className={editMode === 'url' ? 'is-on' : ''} onClick={() => setEditMode('url')}>URL</button>
        <button type="button" className={editMode === 'upload' ? 'is-on' : ''} onClick={() => setEditMode('upload')}>File</button>
      </div>
      <label className="field-label"><span className="label">Name</span><input className="field" value={editDraft.label} maxLength={120} onChange={(event) => setEditDraft((value) => ({ ...value, label: event.target.value }))} /></label>
      {editMode === 'url' ? <>
        <label className="field-label"><span className="label">Image URL</span><input className="field" type="url" value={editDraft.link} onChange={(event) => setEditDraft((value) => ({ ...value, link: event.target.value }))} /></label>
        <label className="field-label"><span className="label">Redirect</span><input className="field" type="url" value={editDraft.redirect} onChange={(event) => setEditDraft((value) => ({ ...value, redirect: event.target.value }))} /></label>
      </> : <>
        <button type="button" className="dropzone !min-h-32" onClick={() => editInputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); chooseEdit(event.dataTransfer.files[0]); }}>
          <span><UploadCloud aria-hidden="true" />{editFile ? editFile.name : 'Drop file'}{editFile && <span className="badge mt-2">{bytesLabel(editFile.size)}</span>}</span>
        </button>
        <input ref={editInputRef} className="sr-only" type="file" accept={accept} onChange={(event) => chooseEdit(event.target.files?.[0])} />
      </>}
      {error && <p className="note note--bad">{error}</p>}
    </Modal>}
  </AccessState>;
}
