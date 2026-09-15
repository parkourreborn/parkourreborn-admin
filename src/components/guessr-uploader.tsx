'use client';

import { useRef, useState } from 'react';
import { Check, ImagePlus, UploadCloud, X } from 'lucide-react';
import MapStage from '@/components/map-stage';
import { useAuth } from '@/components/auth-provider';
import type { GuessrDifficulty, GuessrMode, MapPoint } from '@/lib/types';

const maxBytes = 4 * 1024 * 1024;
const defaultMap = process.env.NEXT_PUBLIC_GUESSR_MAP_URL || '/maps/parkour-reborn-clean.jpg';

const webp = async (file: File) => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
  if (!blob) throw new Error('Could not convert the image to WebP');
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
};

const uploadPut = (url: string, file: File, progress: (value: number) => void) => new Promise<void>((resolve, reject) => {
  const request = new XMLHttpRequest();
  request.open('PUT', url);
  request.setRequestHeader('Content-Type', 'image/webp');
  request.upload.onprogress = (event) => event.lengthComputable && progress(Math.round((event.loaded / event.total) * 100));
  request.onerror = () => reject(new Error('Network error while uploading to R2'));
  request.onload = () => request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`R2 upload failed (${request.status})`));
  request.send(file);
});

export default function GuessrUploader({ onUploaded }: { onUploaded: () => void }) {
  const { api, can, setup } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [mode, setMode] = useState<GuessrMode>('classic');
  const [difficulty, setDifficulty] = useState<GuessrDifficulty>('normal');
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const choose = async (next: File | undefined) => {
    setError('');
    setDone(false);
    if (!next) return;
    if (!next.type.startsWith('image/')) return setError('Choose an image file.');
    if (next.size >= maxBytes) return setError('The image must be smaller than 4 MB.');
    try {
      const converted = await webp(next);
      if (converted.size >= maxBytes) return setError('The converted WebP is still 4 MB or larger.');
      if (preview) URL.revokeObjectURL(preview);
      setFile(converted);
      setPreview(URL.createObjectURL(converted));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not prepare the image');
    }
  };

  const upload = async () => {
    if (!file || !point) return setError('Choose an image and a map target.');
    setBusy(true);
    setError('');
    setDone(false);
    setProgress(1);
    try {
      const init = await api('/api/admin/uploads/init', {
        method: 'POST',
        body: JSON.stringify({ fileName: file.name, contentType: 'image/webp', bytes: file.size, mode, difficulty, coordinates: point }),
      });
      const initData = await init.json() as { uploadId?: string; uploadUrl?: string; error?: string };
      if (!init.ok || !initData.uploadId || !initData.uploadUrl) throw new Error(initData.error || 'Could not initialize upload');
      await uploadPut(initData.uploadUrl, file, setProgress);
      const complete = await api('/api/admin/uploads/complete', { method: 'POST', body: JSON.stringify({ uploadId: initData.uploadId }) });
      const completeData = await complete.json() as { error?: string };
      if (!complete.ok) throw new Error(completeData.error || 'Could not verify upload');
      setDone(true);
      setProgress(100);
      setFile(null);
      setPreview('');
      setPoint(null);
      if (inputRef.current) inputRef.current.value = '';
      onUploaded();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const liveReady = Boolean(setup?.firebaseAdmin && setup.r2 && setup.map && can('guessr.images.create'));

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="label">New image</p><h3 className="mt-1 font-display text-xl uppercase tracking-wider">Create a draft</h3></div><span className="badge">WebP · max 4 MB</span></div>

      <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="grid content-start gap-5">
          <button
            type="button"
            className="group relative grid min-h-64 place-items-center overflow-hidden border border-dashed border-accent/35 bg-accent/[0.035] p-5 text-center hover:border-accent"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}
          >
            {preview ? <><img src={preview} alt="Upload preview" className="absolute inset-0 size-full object-cover" /><span className="absolute inset-0 bg-black/35 opacity-0 transition group-hover:opacity-100" /><span className="relative btn btn-secondary bg-black/75"><ImagePlus className="size-4" /> Replace image</span></> : <span><UploadCloud className="mx-auto mb-4 size-9 text-accent" /><strong className="block font-display text-lg uppercase tracking-wider">Drop an image here</strong><span className="mt-2 block text-sm text-muted">or choose a file</span></span>}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => void choose(event.target.files?.[0])} />

          <div className="grid grid-cols-2 gap-4">
            <label><span className="label mb-2 block">Mode</span><select className="field" value={mode} onChange={(event) => setMode(event.target.value as GuessrMode)}><option value="classic">Classic</option><option value="graffiti">Graffiti</option></select></label>
            <label><span className="label mb-2 block">Difficulty</span><select className="field" value={difficulty} onChange={(event) => setDifficulty(event.target.value as GuessrDifficulty)}><option value="normal">Normal</option><option value="hard">Hard</option></select></label>
          </div>

          {progress > 0 && <div><div className="mb-2 flex justify-between text-sm"><span>{busy ? 'Uploading and verifying' : 'Upload complete'}</span><span className="font-mono">{progress}%</span></div><div className="h-2 overflow-hidden bg-white/[0.06]"><span className="block h-full bg-accent transition-[width]" style={{ width: `${progress}%` }} /></div></div>}
          {error && <p className="flex items-start gap-2 border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200"><X className="mt-0.5 size-4 shrink-0" />{error}</p>}
          {done && <p className="flex items-center gap-2 border border-emerald-400/25 bg-emerald-400/[0.06] p-3 text-sm text-emerald-200"><Check className="size-4" />Draft created and verified.</p>}
          <button className="btn btn-primary w-full" onClick={() => void upload()} disabled={busy || !file || !point || !liveReady}>{busy ? `Uploading ${progress}%` : liveReady ? 'Upload draft' : 'Upload unavailable — finish setup'}</button>
        </div>

        <div><p className="label mb-2">Map target</p><MapStage src={defaultMap} value={point} onChange={setPoint} /></div>
      </div>
    </section>
  );
}
