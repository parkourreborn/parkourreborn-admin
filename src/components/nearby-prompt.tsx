'use client';

import { useCallback, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { MapCanvas } from '@/components/map-canvas';
import type { MapDot } from '@/components/map-canvas';
import Modal from '@/components/modal';
import { formatMeters, inPool, nearbyMeters } from '@/lib/guessr-distance';
import type { GuessrPool } from '@/lib/guessr-distance';
import { personName } from '@/lib/people';
import type { GuessrImage, GuessrMap, MapPoint, NearbyImage, People } from '@/lib/types';

export type NearbyAction = 'upload' | 'save' | 'publish' | 'restore';

// What the prompt compares against: the image being placed and its pool.
export type NearbySubject = {
  imageUrl: string;
  point: MapPoint;
  pool: string;
  action: NearbyAction;
  // Nearby images the uploader already confirmed, shown to reviewers.
  acknowledged?: string[];
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
export const poolLabel = (pool: Pick<GuessrPool, 'mode' | 'difficulty'>) => `${capitalize(pool.mode)} · ${capitalize(pool.difficulty)}`;

// Every other image in the pool as a dot, coloured when it is too close.
export function poolDots(images: readonly GuessrImage[], pool: GuessrPool, nearby: readonly NearbyImage[], excludeId?: string): MapDot[] {
  const close = new Map(nearby.map((item) => [item.id, item.level]));
  return images.filter((image) => image.id !== excludeId && inPool(image, pool)).map((image) => ({
    id: image.id,
    point: image.coordinates,
    tone: close.get(image.id) ?? 'pool',
  }));
}

// Live hint under the map while placing the pin.
export function NearbyNote({ nearby }: { nearby: readonly NearbyImage[] }) {
  if (!nearby.length) return null;
  const veryClose = nearby[0].level === 'veryClose';
  return (
    <p className={`note mt-2 ${veryClose ? 'note--bad' : 'note--warn'}`} aria-live="polite">
      <AlertTriangle aria-hidden="true" />
      {nearby.length === 1 ? '1 image' : `${nearby.length} images`} within {nearbyMeters.close} m in this pool · closest {formatMeters(nearby[0].meters)}
    </p>
  );
}

const verbs: Record<NearbyAction, string> ={ upload: 'Upload', save: 'Save', publish: 'Publish', restore: 'Restore' };
const movable = (action: NearbyAction) => action === 'upload' || action === 'save';

type Pending = { nearby: NearbyImage[]; subject: NearbySubject; resolve: (confirmed: boolean) => void };

// Asks "are you sure?" whenever an image would sit really close to another
// one in the same pool. run() also handles the server finding nearby images
// the page did not know about (409 with code "nearby") by asking and retrying.
export function useNearbyConfirm({ map, fallbackMap, people }: { map: GuessrMap | null; fallbackMap: string; people: People }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const ask = useCallback((nearby: NearbyImage[], subject: NearbySubject) => new Promise<boolean>((resolve) => {
    setPending({ nearby, subject, resolve });
  }), []);

  const run = useCallback(async (send: (confirmNearby: string[]) => Promise<Response>, subject: NearbySubject, known: NearbyImage[] = []) => {
    let confirmed: string[] = [];
    if (known.length) {
      if (!await ask(known, subject)) return null;
      confirmed = known.map((item) => item.id);
    }
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await send(confirmed);
      if (response.status !== 409) return response;
      const data = await response.clone().json().catch(() => null) as { code?: string; nearby?: NearbyImage[] } | null;
      if (data?.code !== 'nearby' || !data.nearby?.length) return response;
      if (!await ask(data.nearby, subject)) return null;
      confirmed = Array.from(new Set([...confirmed, ...data.nearby.map((item) => item.id)]));
    }
    throw new Error('Other images keep appearing nearby. Reload and try again.');
  }, [ask]);

  const finish = (confirmed: boolean) => {
    pending?.resolve(confirmed);
    setPending(null);
  };

  const prompt = pending
    ? <NearbyPrompt nearby={pending.nearby} subject={pending.subject} map={map} fallbackMap={fallbackMap} people={people} onAnswer={finish} />
    : null;

  return { run, prompt };
}

function NearbyPrompt({ nearby, subject, map, fallbackMap, people, onAnswer }: {
  nearby: NearbyImage[];
  subject: NearbySubject;
  map: GuessrMap | null;
  fallbackMap: string;
  people: People;
  onAnswer: (confirmed: boolean) => void;
}) {
  const [selectedId, setSelectedId] = useState(nearby[0]?.id);
  const selected = nearby.find((item) => item.id === selectedId) ?? nearby[0];
  const veryClose = nearby.some((item) => item.level === 'veryClose');
  const others = nearby.length === 1 ? 'another image' : `${nearby.length} other images`;

  return (
    <Modal
      wide
      title="Really close to another image"
      onClose={() => onAnswer(false)}
      actions={<>
        <button type="button" className="btn btn-secondary" onClick={() => onAnswer(true)}>{verbs[subject.action]} anyway</button>
        <button type="button" className="btn btn-primary" onClick={() => onAnswer(false)} autoFocus>{movable(subject.action) ? 'Move it' : 'Cancel'}</button>
      </>}
    >
      <p className={`note ${veryClose ? 'note--bad' : 'note--warn'}`}>
        <AlertTriangle aria-hidden="true" />
        <span>Are you sure? It’s {formatMeters(selected.meters)} from {others} in {subject.pool}{veryClose ? ', basically the same spot' : ''}. Players could get two rounds in almost the same place.</span>
      </p>

      <div className="compare">
        <figure>
          <img src={subject.imageUrl} alt="This image" />
          <figcaption><span className="badge status-bad">This image</span></figcaption>
        </figure>
        <figure>
          <img src={selected.imageUrl} alt="Nearby image" />
          <figcaption>
            <span className="badge status-active">Nearby</span>
            <span className={`badge ${selected.level === 'veryClose' ? 'status-bad' : 'status-warn'}`}>{formatMeters(selected.meters)} away</span>
            <span className="badge">{selected.status}</span>
            <span className="badge">{personName(people, selected.createdBy)}</span>
            {subject.acknowledged?.includes(selected.id) && <span className="badge status-active">Uploader confirmed</span>}
          </figcaption>
        </figure>
      </div>

      {nearby.length > 1 && <div className="levels" role="group" aria-label="Nearby images">{nearby.map((item) => (
        <button type="button" key={item.id} className={item.id === selected.id ? 'is-on' : ''} onClick={() => setSelectedId(item.id)} aria-pressed={item.id === selected.id}>
          {formatMeters(item.meters)}
        </button>
      ))}</div>}

      <div className="map-frame h-[240px]">
        <MapCanvas
          className="size-full"
          image={map?.url || fallbackMap}
          width={map?.width || 5688}
          height={map?.height || 4800}
          value={subject.point}
          target={selected.coordinates}
          labels={{ value: 'This image', target: 'Nearby image' }}
          frame={[subject.point, selected.coordinates]}
          alt={`Both images are within ${nearbyMeters.close} m of each other`}
        />
      </div>
    </Modal>
  );
}
