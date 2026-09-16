'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, EyeOff, RefreshCw, Rocket, RotateCcw, Trash2, X } from 'lucide-react';
import MapStage from '@/components/map-stage';
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
  const grouped = ['draft', 'published', 'disabled'].map((status) => ({ status: status as GuessrStatus, images: visible.filter((image) => image.status === status) })).filter((group) => filters.status === 'all' || group.status === filters.status);

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

  return (
    <section className="panel p-5 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="label">Image library</p><h3 className="mt-1 font-display text-xl uppercase tracking-wider">Drafts and published images</h3></div><button className="btn btn-secondary" onClick={() => void load()} disabled={loading}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button></div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Filter label="Mode" value={filters.mode} values={['all', 'classic', 'graffiti']} onChange={(mode) => setFilters({ ...filters, mode })} />
        <Filter label="Difficulty" value={filters.difficulty} values={['all', 'normal', 'hard']} onChange={(difficulty) => setFilters({ ...filters, difficulty })} />
        <Filter label="Status" value={filters.status} values={['all', 'draft', 'published', 'disabled']} onChange={(status) => setFilters({ ...filters, status })} />
      </div>

      {error && <p className="mb-5 flex items-center gap-2 border border-red-400/25 bg-red-400/[0.06] p-3 text-red-200"><X className="size-4" />{error}</p>}
      {loading && !images.length ? <div className="grid min-h-44 place-items-center text-muted">Loading images…</div> : grouped.map((group) => (
        <div className="mb-8 last:mb-0" key={group.status}>
          <div className="mb-3 flex items-center gap-3"><h4 className="font-display text-lg font-semibold uppercase tracking-wider">{group.status}</h4><span className="badge">{group.images.length}</span><span className="h-px flex-1 bg-line" /></div>
          {group.images.length ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{group.images.map((image) => (
            <article className="overflow-hidden border border-line bg-black/20" key={image.id}>
              <div className="relative aspect-video bg-black/50"><img src={image.imageUrl} alt={`${image.mode} target`} className="size-full object-cover" /><span className="absolute left-3 top-3 badge !bg-black/80 !text-white">{image.status}</span></div>
              <div className="p-4">
                <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm"><Meta name="Mode" value={image.mode} /><Meta name="Difficulty" value={image.difficulty} /><Meta name="X" value={image.coordinates.x.toFixed(4)} /><Meta name="Y" value={image.coordinates.y.toFixed(4)} /></div>
                <div className="flex flex-wrap gap-2">
                  {can('guessr.images.edit') && image.status !== 'disabled' && <button className="btn btn-secondary !min-h-9 !px-3" onClick={() => setEditing(image)}><Edit3 className="size-4" /> Edit</button>}
                  {can('guessr.images.publish') && image.status === 'draft' && <button className="btn btn-primary !min-h-9 !px-3" onClick={() => void action(image, 'publish')} disabled={Boolean(actionKey) || !map}><Rocket className="size-4" /> Publish</button>}
                  {can('guessr.images.delete') && image.status !== 'disabled' && <button className="btn btn-danger !min-h-9 !px-3" onClick={() => void action(image, 'disable')} disabled={Boolean(actionKey) || !map}><EyeOff className="size-4" /> Deactivate</button>}
                  {can('guessr.images.delete') && image.status === 'disabled' && <>
                    <button className="btn btn-secondary !min-h-9 !px-3" onClick={() => void action(image, 'reactivate')} disabled={Boolean(actionKey) || !map}><RotateCcw className="size-4" /> {actionKey === `${image.id}:reactivate` ? 'Reactivating' : 'Reactivate'}</button>
                    <button className="btn btn-danger !min-h-9 !px-3" onClick={() => void action(image, 'delete')} disabled={Boolean(actionKey) || !map}><Trash2 className="size-4" /> {actionKey === `${image.id}:delete` ? 'Deleting' : 'Delete'}</button>
                  </>}
                </div>
              </div>
            </article>
          ))}</div> : <div className="border border-dashed border-line py-9 text-center text-muted">No {group.status} images match these filters.</div>}
        </div>
      ))}

      {editing && <ImageEditor image={editing} map={map} fallbackMap={fallbackMap} close={() => setEditing(null)} saved={async () => { setEditing(null); await load(); }} />}
    </section>
  );
}

function Filter({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return <label><span className="label mb-2 block">{label}</span><select className="field capitalize" value={value} onChange={(event) => onChange(event.target.value)}>{values.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>;
}

function Meta({ name, value }: { name: string; value: string }) {
  return <span className="min-w-0"><small className="block font-mono text-[11px] uppercase tracking-wider text-muted">{name}</small><strong className="block truncate font-normal text-slate-200">{value}</strong></span>;
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Edit Guessr image">
      <div className="panel mx-auto max-w-5xl p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between"><div><p className="label">Image {image.id}</p><h3 className="mt-1 font-display text-xl uppercase tracking-wider">Edit target</h3></div><button className="grid size-10 place-items-center border border-line hover:border-accent/40" onClick={close} aria-label="Close editor"><X className="size-5" /></button></div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2">
          <Filter label="Mode" value={mode} values={['classic', 'graffiti']} onChange={(value) => setMode(value as GuessrMode)} />
          <Filter label="Difficulty" value={difficulty} values={['normal', 'hard']} onChange={(value) => setDifficulty(value as GuessrDifficulty)} />
        </div>
        <MapStage src={map?.url || fallbackMap} width={map?.width || 5688} height={map?.height || 4800} value={coordinates} onChange={setCoordinates} disabled={!map} />
        {error && <p className="mt-4 text-red-300">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><button className="btn btn-secondary" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={() => void save()} disabled={busy || !map}>{busy ? 'Saving' : map ? 'Save changes' : 'Map setup required'}</button></div>
      </div>
    </div>
  );
}
