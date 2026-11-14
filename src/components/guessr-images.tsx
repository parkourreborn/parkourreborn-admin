'use client';

import { useEffect, useMemo, useState } from 'react';
import { Edit3, EyeOff, RefreshCw, Rocket, RotateCcw, Trash2, X } from 'lucide-react';
import MapStage from '@/components/map-stage';
import Modal from '@/components/modal';
import { NearbyNote, poolDots, poolLabel, useNearbyConfirm } from '@/components/nearby-prompt';
import type { NearbySubject } from '@/components/nearby-prompt';
import { useAuth } from '@/components/auth-provider';
import type { GuessrLibrary } from '@/components/parkour-guessr';
import { findNearby, formatMeters, metersToMapPixels, nearbyMeters } from '@/lib/guessr-distance';
import { personName } from '@/lib/people';
import { editKeepsPublished, guessrCan, isGuessrAdmin, ownsImage } from '@/lib/policy';
import type { GuessrAction, Verdict } from '@/lib/policy';
import type { GuessrDifficulty, GuessrImage, GuessrMap, GuessrMode, GuessrStatus, MapPoint, NearbyImage } from '@/lib/types';

type Show = 'everyone' | 'mine' | 'review';
type Filters = { show: Show; mode: string; difficulty: string; status: string };
const initialFilters: Filters = { show: 'everyone', mode: 'all', difficulty: 'all', status: 'all' };
type Run = ReturnType<typeof useNearbyConfirm>['run'];
const noAccess: Verdict = { ok: false, reason: 'Sign in again', kind: 'forbidden', visible: false };

export default function GuessrImages({ map, fallbackMap, library }: { map: GuessrMap | null; fallbackMap: string; library: GuessrLibrary }) {
  const { admin, api, can } = useAuth();
  const { images, people, loading, error: loadError, reload } = library;
  const [filters, setFilters] = useState(initialFilters);
  const [editing, setEditing] = useState<GuessrImage | null>(null);
  const [actionKey, setActionKey] = useState('');
  const [error, setError] = useState('');
  const { run, prompt } = useNearbyConfirm({ map, fallbackMap, people });
  const reviewer = Boolean(admin && isGuessrAdmin(admin));

  useEffect(() => {
    if (!can('guessr.publish') || !document.modelContext?.registerTool) return;
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
        const data = await response.json() as { error?: string; code?: string };
        if (data.code === 'nearby') throw new Error('This image is really close to another one in its pool. Publish it from the page to confirm.');
        if (!response.ok) throw new Error(data.error || 'Could not publish image');
        await reload();
        return { imageId, status: 'published' };
      },
    }, { signal: lifecycle.signal });
    void Promise.resolve(register).catch(() => undefined);
    return () => lifecycle.abort();
  }, [api, can, reload]);

  const mine = (image: GuessrImage) => Boolean(admin && ownsImage(admin, image));
  const needsReview = (image: GuessrImage) => image.status === 'draft' && !mine(image);
  const reviewCount = reviewer ? images.filter(needsReview).length : 0;

  const visible = images.filter((image) => {
    if (filters.show === 'mine' && !mine(image)) return false;
    if (filters.show === 'review' && !needsReview(image)) return false;
    return (['mode', 'difficulty', 'status'] as const).every((key) => filters[key] === 'all' || image[key] === filters[key]);
  });
  const order: Record<GuessrStatus, number> = { draft: 0, published: 1, disabled: 2 };
  const sorted = [...visible].sort((a, b) => order[a.status] - order[b.status]);

  // Closest other image in the same pool, so crowded spots stand out.
  const closest = useMemo(() => {
    const result = new Map<string, NearbyImage>();
    if (!map) return result;
    for (const image of images) {
      if (image.status === 'disabled') continue;
      const [first] = findNearby(image.coordinates, image, images, map, image.id);
      if (first) result.set(image.id, first);
    }
    return result;
  }, [images, map]);

  const subjectFor = (image: GuessrImage, action: NearbySubject['action']): NearbySubject => ({
    imageUrl: image.imageUrl,
    point: image.coordinates,
    pool: poolLabel(image),
    action,
    acknowledged: image.nearbyAcknowledged,
  });

  const action = async (image: GuessrImage, kind: 'publish' | 'disable' | 'restore' | 'delete') => {
    if (kind === 'delete' && !window.confirm('Permanently delete this image from Firestore and R2? This cannot be undone.')) return;

    const baseUrl = `/api/admin/guessr/images/${encodeURIComponent(image.id)}`;
    setActionKey(`${image.id}:${kind}`);
    setError('');
    try {
      const response = kind === 'publish' || kind === 'restore'
        ? await run(
          (confirmNearby) => api(`${baseUrl}/${kind === 'publish' ? 'publish' : 'reactivate'}`, { method: 'POST', body: JSON.stringify({ confirmNearby }) }),
          subjectFor(image, kind),
        )
        : await api(`${baseUrl}${kind === 'delete' ? '?permanent=true' : ''}`, { method: 'DELETE' });
      if (!response) return;
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || `Could not ${kind} image`);
      await reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : `Could not ${kind} image`);
    } finally {
      setActionKey('');
    }
  };

  const busyAction = Boolean(actionKey) || !map;
  const shownError = error || loadError;

  return (
    <section className="panel panel--pad">
      <div className="section-head">
        <h2 className="section-title">Images</h2>
        <span className="badge">{visible.length}</span>
        {reviewCount > 0 && filters.show !== 'review' && <button type="button" className="badge status-warn" onClick={() => setFilters({ ...initialFilters, show: 'review' })}>{reviewCount} to review</button>}
        <button className="icon-btn ml-auto" onClick={() => void reload()} disabled={loading} title="Refresh" aria-label="Refresh"><RefreshCw className={loading ? 'animate-spin' : ''} /></button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Filter
          label="Show"
          value={filters.show}
          values={reviewer ? ['everyone', 'mine', 'review'] : ['everyone', 'mine']}
          labels={{ everyone: 'Everyone', mine: 'Mine', review: `Needs review (${reviewCount})` }}
          onChange={(show) => setFilters({ ...filters, show: show as Show })}
        />
        <Filter label="Mode" value={filters.mode} values={['all', 'classic', 'graffiti']} onChange={(mode) => setFilters({ ...filters, mode })} />
        <Filter label="Difficulty" value={filters.difficulty} values={['all', 'normal', 'hard']} onChange={(difficulty) => setFilters({ ...filters, difficulty })} />
        <Filter label="Status" value={filters.status} values={['all', 'draft', 'published', 'disabled']} onChange={(status) => setFilters({ ...filters, status })} />
      </div>

      {shownError && <p className="note note--bad"><X aria-hidden="true" />{shownError}</p>}
      {loading && !images.length ? <p className="empty">Loading</p> : sorted.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{sorted.map((image) => {
        const verdict = (kind: GuessrAction) => admin ? guessrCan(admin, kind, image) : noAccess;
        const [publish, edit, restore, disable, remove] = (['publish', 'edit', 'restore', 'disable', 'delete'] as const).map(verdict);
        const near = closest.get(image.id);
        const own = mine(image);
        // The first rule blocking the person's own image, explained in plain words.
        const blocked = [restore, remove].find((item): item is Extract<Verdict, { ok: false }> => !item.ok && item.visible);
        return (
          <article className="card" key={image.id}>
            <div className="card__media"><img src={image.imageUrl} alt={`${image.mode} target`} /><span className={`badge ${statusClass[image.status]}`}>{image.status}</span></div>
            <div className="card__body">
              <div className="meta">
                <span className={`badge ${own ? 'badge--accent' : ''}`} title="Uploaded by">{own ? 'You' : personName(people, image.createdBy)}</span>
                <span className="badge">{image.mode}</span>
                <span className="badge">{image.difficulty}</span>
                {!publish.ok && publish.visible && <span className="badge status-warn" title={publish.reason}>Awaiting review</span>}
                {near && <span className={`badge ${near.level === 'veryClose' ? 'status-bad' : 'status-warn'}`} title="Closest other image in the same mode and difficulty">{formatMeters(near.meters)} from another</span>}
                <span className="badge" title="Map target">{image.coordinates.x.toFixed(3)}, {image.coordinates.y.toFixed(3)}</span>
              </div>
              {blocked && <p className="row__sub">{blocked.reason}</p>}
              <div className="flex flex-wrap gap-2">
                {publish.ok && <button className="btn btn-primary btn-sm" onClick={() => void action(image, 'publish')} disabled={busyAction}><Rocket /> {actionKey === `${image.id}:publish` ? '…' : 'Publish'}</button>}
                {edit.ok && <button className="btn btn-secondary btn-sm" onClick={() => setEditing(image)}><Edit3 /> Edit</button>}
                {restore.ok && <button className="btn btn-secondary btn-sm" onClick={() => void action(image, 'restore')} disabled={busyAction}><RotateCcw /> {actionKey === `${image.id}:restore` ? '…' : 'Restore'}</button>}
                {disable.ok && <button className="icon-btn icon-btn--danger ml-auto" onClick={() => void action(image, 'disable')} disabled={busyAction} title="Deactivate" aria-label="Deactivate"><EyeOff /></button>}
                {remove.ok && <button className="icon-btn icon-btn--danger ml-auto" onClick={() => void action(image, 'delete')} disabled={busyAction} title="Delete" aria-label="Delete"><Trash2 /></button>}
              </div>
            </div>
          </article>
        );
      })}</div> : <p className="empty">No images</p>}

      {editing && <ImageEditor image={editing} map={map} fallbackMap={fallbackMap} library={library} run={run} close={() => setEditing(null)} saved={async () => { setEditing(null); await reload(); }} />}
      {prompt}
    </section>
  );
}

const statusClass: Record<GuessrStatus, string> = { draft: 'status-warn', published: 'status-active', disabled: 'status-muted' };

function Filter({ label, value, values, labels, onChange }: { label: string; value: string; values: string[]; labels?: Record<string, string>; onChange: (value: string) => void }) {
  return <label className="field-label"><span className="label">{label}</span><select className="field capitalize" value={value} onChange={(event) => onChange(event.target.value)}>{values.map((item) => <option value={item} key={item}>{labels?.[item] ?? item}</option>)}</select></label>;
}

function ImageEditor({ image, map, fallbackMap, library, run, close, saved }: {
  image: GuessrImage;
  map: GuessrMap | null;
  fallbackMap: string;
  library: GuessrLibrary;
  run: Run;
  close: () => void;
  saved: () => void;
}) {
  const { admin, api } = useAuth();
  const [mode, setMode] = useState<GuessrMode>(image.mode);
  const [difficulty, setDifficulty] = useState<GuessrDifficulty>(image.difficulty);
  const [coordinates, setCoordinates] = useState<MapPoint>(image.coordinates);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const moved = mode !== image.mode
    || difficulty !== image.difficulty
    || coordinates.x !== image.coordinates.x
    || coordinates.y !== image.coordinates.y
    || Boolean(map && image.mapVersionId !== map.id);
  const pool = useMemo(() => map ? { mapVersionId: map.id, mode, difficulty } : null, [difficulty, map, mode]);
  const nearby = useMemo(() => pool && map ? findNearby(coordinates, pool, library.images, map, image.id) : [], [coordinates, image.id, library.images, map, pool]);
  const dots = useMemo(() => pool ? poolDots(library.images, pool, nearby, image.id) : [], [image.id, library.images, nearby, pool]);
  const toReview = moved && image.status === 'published' && Boolean(admin && !editKeepsPublished(admin, image));

  const save = async () => {
    if (!map) return;
    setBusy(true);
    setError('');
    try {
      const response = await run(
        (confirmNearby) => api(`/api/admin/guessr/images/${encodeURIComponent(image.id)}`, { method: 'PATCH', body: JSON.stringify({ mode, difficulty, coordinates, mapVersionId: map.id, confirmNearby }) }),
        { imageUrl: image.imageUrl, point: coordinates, pool: poolLabel({ mode, difficulty }), action: 'save' },
        moved ? nearby : [],
      );
      if (!response) return;
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not save image');
      saved();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not save image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      wide
      title="Edit image"
      onClose={close}
      actions={<><button className="btn btn-secondary" onClick={close}>Cancel</button><button className="btn btn-primary" onClick={() => void save()} disabled={busy || !map}>{busy ? 'Saving…' : !map ? 'Setup required' : toReview ? 'Save & send to review' : 'Save'}</button></>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Filter label="Mode" value={mode} values={['classic', 'graffiti']} onChange={(value) => setMode(value as GuessrMode)} />
        <Filter label="Difficulty" value={difficulty} values={['normal', 'hard']} onChange={(value) => setDifficulty(value as GuessrDifficulty)} />
      </div>
      {toReview && <p className="note note--warn">This image is live. Moving it takes it out of the game until a Parkour Guessr administrator publishes it again.</p>}
      <MapStage
        src={map?.url || fallbackMap}
        width={map?.width || 5688}
        height={map?.height || 4800}
        value={coordinates}
        onChange={setCoordinates}
        disabled={!map}
        dots={dots}
        ring={nearby.length ? metersToMapPixels(nearbyMeters.close) : undefined}
        footer={<NearbyNote nearby={nearby} />}
      />
      {error && <p className="note note--bad">{error}</p>}
    </Modal>
  );
}
