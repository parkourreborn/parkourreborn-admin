'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import AccessState from '@/components/access-state';
import { useAuth } from '@/components/auth-provider';
import GuessrImages from '@/components/guessr-images';
import GuessrUploader from '@/components/guessr-uploader';
import type { GuessrImage, GuessrMap, People } from '@/lib/types';

const fallbackMap = 'https://assets.parkourreborn.com/guessr/maps/main-v1.jpg';

export type GuessrLibrary = {
  images: GuessrImage[];
  people: People;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
};

export default function ParkourGuessr() {
  const { admin, api, can } = useAuth();
  const [map, setMap] = useState<GuessrMap | null>(null);
  const [mapError, setMapError] = useState('');
  const [images, setImages] = useState<GuessrImage[]>([]);
  const [people, setPeople] = useState<People>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!admin) return;
    let active = true;
    const load = async () => {
      setMap(null);
      setMapError('');
      try {
        const response = await api('/api/admin/guessr/map');
        const data = await response.json() as { map?: GuessrMap; error?: string };
        if (!response.ok || !data.map) throw new Error(data.error || 'Could not load the active Guessr map');
        const image = new Image();
        image.src = data.map.url;
        await image.decode();
        if (active) setMap(data.map);
      } catch (error) {
        if (active) setMapError(error instanceof Error ? error.message : 'Could not load the active Guessr map');
      }
    };
    void load();
    return () => { active = false; };
  }, [admin, api]);

  // One image list for both the uploader (to warn about nearby images) and
  // the library below it.
  const reload = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setError('');
    try {
      const response = await api('/api/admin/guessr/images');
      const data = await response.json() as { images?: GuessrImage[]; people?: People; error?: string };
      if (!response.ok || !data.images) throw new Error(data.error || 'Could not load images');
      setImages(data.images);
      setPeople(data.people ?? {});
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load images');
    } finally {
      setLoading(false);
    }
  }, [admin, api]);

  useEffect(() => { queueMicrotask(() => void reload()); }, [reload]);

  const library: GuessrLibrary = { images, people, loading, error, reload };

  return (
    <AccessState permission="guessr.view">
      {mapError && <p className="note note--warn" role="alert"><AlertTriangle aria-hidden="true" />{mapError}</p>}
      {can('guessr.contribute') && <GuessrUploader map={map} fallbackMap={fallbackMap} library={library} />}
      <GuessrImages map={map} fallbackMap={fallbackMap} library={library} />
    </AccessState>
  );
}
