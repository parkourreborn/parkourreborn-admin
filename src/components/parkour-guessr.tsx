'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import AccessState from '@/components/access-state';
import { useAuth } from '@/components/auth-provider';
import GuessrImages from '@/components/guessr-images';
import GuessrUploader from '@/components/guessr-uploader';
import type { GuessrMap } from '@/lib/types';

const fallbackMap = 'https://assets.parkourreborn.com/guessr/maps/main-v1.jpg';

export default function ParkourGuessr() {
  const { admin, api } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [map, setMap] = useState<GuessrMap | null>(null);
  const [mapError, setMapError] = useState('');

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

  return (
    <AccessState permission="guessr.view">
      {mapError && <p className="note note--warn" role="alert"><AlertTriangle aria-hidden="true" />{mapError}</p>}
      <GuessrUploader map={map} fallbackMap={fallbackMap} onUploaded={() => setRefreshKey((value) => value + 1)} />
      <GuessrImages map={map} fallbackMap={fallbackMap} refreshKey={refreshKey} />
    </AccessState>
  );
}
