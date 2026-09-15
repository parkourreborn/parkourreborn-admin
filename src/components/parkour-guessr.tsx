'use client';

import { useState } from 'react';
import AccessState from '@/components/access-state';
import GuessrImages from '@/components/guessr-images';
import GuessrUploader from '@/components/guessr-uploader';

export default function ParkourGuessr() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <AccessState permission="guessr.view">
      <div className="grid gap-6">
        <GuessrUploader onUploaded={() => setRefreshKey((value) => value + 1)} />
        <GuessrImages refreshKey={refreshKey} />
      </div>
    </AccessState>
  );
}
