'use client';

import { useRef, useState } from 'react';
import { Check, ImagePlus, UploadCloud, X } from 'lucide-react';
import MapStage from '@/components/map-stage';
import { useAuth } from '@/components/auth-provider';
import type { GuessrDifficulty, GuessrMap, GuessrMode, MapPoint } from '@/lib/types';

const maxBytes = 4 * 1024 * 1024;

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

export default function GuessrUploader({ map, fallbackMap, onUploaded }: { map: GuessrMap | null; fallbackMap: string; onUploaded: () => void }) {
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
        body: JSON.stringify({ fileName: file.name, contentType: 'image/webp', bytes: file.size, mode, difficulty, coordinates: point, mapVersionId: map?.id }),
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

  const liveReady = Boolean(map && setup?.firebaseAdmin && setup.r2 && setup.map && can('guessr.images.create'));

  return (
    <section className="panel panel--pad">
      <div className="section-head"><h2 className="section-title">New image</h2></div>

      <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="grid content-start gap-4">
          <button
            type="button"
            className="dropzone group min-h-56"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}
          >
            {preview
              ? <><img src={preview} alt="Upload preview" className="absolute inset-0 size-full object-cover" /><span className="absolute inset-0 grid place-items-center bg-black/55 opacity-0 transition group-hover:opacity-100"><span><ImagePlus aria-hidden="true" />Replace</span></span></>
              : <span><UploadCloud aria-hidden="true" />Drop image</span>}
          </button>
          <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(event) => void choose(event.target.files?.[0])} />

          <div className="grid grid-cols-2 gap-3">
            <label className="field-label"><span className="label">Mode</span><select className="field" value={mode} onChange={(event) => setMode(event.target.value as GuessrMode)}><option value="classic">Classic</option><option value="graffiti">Graffiti</option></select></label>
            <label className="field-label"><span className="label">Difficulty</span><select className="field" value={difficulty} onChange={(event) => setDifficulty(event.target.value as GuessrDifficulty)}><option value="normal">Normal</option><option value="hard">Hard</option></select></label>
          </div>

          {busy && <div className="progress" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>}
          {error && <p className="note note--bad"><X aria-hidden="true" />{error}</p>}
          {done && <p className="note note--ok"><Check aria-hidden="true" />Uploaded</p>}
          <button className="btn btn-primary w-full" onClick={() => void upload()} disabled={busy || !file || !point || !liveReady}>{busy ? `${progress}%` : liveReady ? 'Upload' : 'Setup required'}</button>
        </div>

        <MapStage src={map?.url || fallbackMap} width={map?.width || 5688} height={map?.height || 4800} value={point} onChange={setPoint} disabled={!map} />
      </div>
    </section>
  );
}
