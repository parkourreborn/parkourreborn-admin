'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, EyeOff, RefreshCw, Rocket, RotateCcw, Trash2, X } from 'lucide-react';
import MapStage from '@/components/map-stage';
import Modal from '@/components/modal';
import { useAuth } from '@/components/auth-provider';
import type { GuessrDifficulty, GuessrImage, GuessrMap, GuessrMode, GuessrStatus, MapPoint } from '@/lib/types';

type Filters = { mode: string; difficulty: string; status: string };
const initialFilters: Filters = { mode: 'all', difficulty: 'all', status: 'all' };

export default function GuessrImages({ map, fallbackMap, refreshKey }: { map: GuessrMap | null; fallbackMap: string; refreshKey: number }) {
  const { admin, api, can } = useAuth();
  const [images, setImages] = useState<GuessrImage[]>([]);
  const [filters, setFilters] = useState(initialFilters);
  const [editing, setEditing] = useState<GuessrImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionKey, setActionKey] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setError('');
    try {
      const response = await api('/api/admin/guessr/images');
      const data = await response.json() as { images?: GuessrImage[]; error?: string };
      if (!response.ok || !data.images) throw new Error(data.error || 'Could not load images');
      setImages(data.images);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load images');
    } finally {
      setLoading(false);
    }
  }, [admin, api]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load, refreshKey]);

  useEffect(() => {
    if (!can('guessr.images.publish') || !document.modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    const register = document.modelContext.registerTool({
      name: 'publish_guessr_image',
      title: 'Publish Guessr image',
      description: 'Publish an existing Parkour Guessr draft by its image ID and refresh the visible image library.',
      inputSchema: {
        type: 'object',
        properties: { imageId: { type: 'string', minLength: 1 } },
        required: ['imageId'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        const imageId = typeof input === 'object' && input && 'imageId' in input ? String(input.imageId) : '';
        if (!imageId) throw new Error('imageId is required');
        const response = await api(`/api/admin/guessr/images/${encodeURIComponent(imageId)}/publish`, { method: 'POST' });
        const data = await response.json() as { error?: string };
        if (!response.ok) throw new Error(data.error || 'Could not publish image');
        await load();
        return { imageId, status: 'published' };
      },
    }, { signal: lifecycle.signal });
    void Promise.resolve(register).catch(() => undefined);
    return () => lifecycle.abort();
  }, [api, can, load]);

  const visible = useMemo(() => images.filter((image) => Object.entries(filters).every(([key, value]) => value === 'all' || image[key as keyof GuessrImage] === value)), [filters, images]);
  const order: Record<GuessrStatus, number> = { draft: 0, published: 1, disabled: 2 };
  const sorted = [...visible].sort((a, b) => order[a.status] - order[b.status]);

  const action = async (image: GuessrImage, kind: 'publish' | 'disable' | 'reactivate' | 'delete') => {
    if (kind === 'delete' && !window.confirm('Permanently delete this image from Firestore and R2? This cannot be undone.')) return;

    const baseUrl = `/api/admin/guessr/images/${encodeURIComponent(image.id)}`;
    const request = kind === 'publish'
      ? { url: `${baseUrl}/publish`, method: 'POST' }
      : kind === 'reactivate'
        ? { url: `${baseUrl}/reactivate`, method: 'POST' }
        : { url: `${baseUrl}${kind === 'delete' ? '?permanent=true' : ''}`, method: 'DELETE' };

    setActionKey(`${image.id}:${kind}`);
    setError('');
    try {
      const response = await api(request.url, { method: request.method });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || `Could not ${kind} image`);
      await load();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : `Could not ${kind} image`);
    } finally {
      setActionKey('');
    }
  };

  const busyAction = Boolean(actionKey) || !map;

  return (
    <section className="panel panel--pad">
      <div className="section-head">
        <h2 className="section-title">Images</h2>
        <span className="badge">{visible.length}</span>
        <button className="icon-btn ml-auto" onClick={() => void load()} disabled={loading} title="Refresh" aria-label="Refresh"><RefreshCw className={loading ? 'animate-spin' : ''} /></button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Filter label="Mode" value={filters.mode} values={['all', 'classic', 'graffiti']} onChange={(mode) => setFilters({ ...filters, mode })} />
        <Filter label="Difficulty" value={filters.difficulty} values={['all', 'normal', 'hard']} onChange={(difficulty) => setFilters({ ...filters, difficulty })} />
        <Filter label="Status" value={filters.status} values={['all', 'draft', 'published', 'disabled']} onChange={(status) => setFilters({ ...filters, status })} />
      </div>

      {error && <p className="note note--bad"><X aria-hidden="true" />{error}</p>}
      {loading && !images.length ? <p className="empty">Loading</p> : sorted.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{sorted.map((image) => (
        <article className="card" key={image.id}>
          <div className="card__media"><img src={image.imageUrl} alt={`${image.mode} target`} /><span className={`badge ${statusClass[image.status]}`}>{image.status}</span></div>
          <div className="card__body">
            <div className="meta"><span className="badge">{image.mode}</span><span className="badge">{image.difficulty}</span><span className="badge" title="Map target">{image.coordinates.x.toFixed(3)}, {image.coordinates.y.toFixed(3)}</span></div>
            <div className="flex flex-wrap gap-2">
              {can('guessr.images.publish') && image.status === 'draft' && <button className="btn btn-primary btn-sm" onClick={() => void action(image, 'publish')} disabled={busyAction}><Rocket /> Publish</button>}
              {can('guessr.images.edit') && image.status !== 'disabled' && <button className="btn btn-secondary btn-sm" onClick={() => setEditing(image)}><Edit3 /> Edit</button>}
              {can('guessr.images.delete') && image.status === 'disabled' && <button className="btn btn-secondary btn-sm" onClick={() => void action(image, 'reactivate')} disabled={busyAction}><RotateCcw /> {actionKey === `${image.id}:reactivate` ? '…' : 'Restore'}</button>}
              {can('guessr.images.delete') && image.status !== 'disabled' && <button className="icon-btn icon-btn--danger ml-auto" onClick={() => void action(image, 'disable')} disabled={busyAction} title="Deactivate" aria-label="Deactivate"><EyeOff /></button>}
              {can('guessr.images.delete') && image.status === 'disabled' && <button className="icon-btn icon-btn--danger ml-auto" onClick={() => void action(image, 'delete')} disabled={busyAction} title="Delete" aria-label="Delete"><Trash2 /></button>}
            </div>
          </div>
        </article>
      ))}</div> : <p className="empty">No images</p>}

      {editing && <ImageEditor image={editing} map={map} fallbackMap={fallbackMap} close={() => setEditing(null)} saved={async () => { setEditing(null); await load(); }} />}
    </section>
  );
}

const statusClass: Record<GuessrStatus, string> = { draft: 'status-warn', published: 'status-active', disabled: 'status-muted' };

function Filter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label className="field-label"><span className="label">{label}</span><select className="field capitalize" value={value} onChange={(event) => onChange(event.target.value)}>{values.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>;
}

function ImageEditor({ image, map, fallbackMap, close, saved }: { image: GuessrImage; map: GuessrMap | null; fallbackMap: string; close: () => void; saved: () => void }) {
  const { api } = useAuth();
  const [mode, setMode] = useState<GuessrMode>(image.mode);
  const [difficulty, setDifficulty] = useState<GuessrDifficulty>(image.difficulty);
  const [coordinates, setCoordinates] = useState<MapPoint>(image.coordinates);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!map) return;
    setBusy(true);
    const response = await api(`/api/admin/guessr/images/${image.id}`, { method: 'PATCH', body: JSON.stringify({ mode, difficulty, coordinates, mapVersionId: map.id }) });
    const data = await response.json() as { error?: string };
    setBusy(false);
    if (!response.ok) return setError(data.error || 'Could not save image');
    saved();
  };

  return (
    <Modal
      wide
      title="Edit image"
      onClose={close}
      actions={<><button className="btn btn-secondary" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={() => void save()} disabled={busy || !map}>{busy ? 'Saving…' : map ? 'Save' : 'Setup required'}</button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Filter label="Mode" value={mode} values={['classic', 'graffiti']} onChange={(value) => setMode(value as GuessrMode)} />
        <Filter label="Difficulty" value={difficulty} values={['normal', 'hard']} onChange={(value) => setDifficulty(value as GuessrDifficulty)} />
      </div>
      <MapStage src={map?.url || fallbackMap} width={map?.width || 5688} height={map?.height || 4800} value={coordinates} onChange={setCoordinates} disabled={!map} />
      {error && <p className="note note--bad">{error}</p>}
    </Modal>
  );
}
