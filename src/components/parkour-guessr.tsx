'use client';

import { useState } from 'react';
import AccessState from '@/components/access-state';
import GuessrImages from '@/components/guessr-images';
import GuessrUploader from '@/components/guessr-uploader';
import PageHead from '@/components/page-head';

export default function ParkourGuessr() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <AccessState permission="guessr.view">
      <PageHead eyebrow="Games / Parkour Guessr" title="Images" detail="Upload WebP drafts, place exact map targets, and control what enters the live game pool." />
      <div className="grid gap-6">
        <GuessrUploader onUploaded={() => setRefreshKey((value) => value + 1)} />
        <GuessrImages refreshKey={refreshKey} />
      </div>
    </AccessState>
  );
}
