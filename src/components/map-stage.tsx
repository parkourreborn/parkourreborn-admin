'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import { MapCanvas } from '@/components/map-canvas';
import type { MapCanvasHandle } from '@/components/map-canvas';
import type { MapPoint } from '@/lib/types';

export default function MapStage({ src, width, height, value, onChange, disabled = false }: { src: string; width: number; height: number; value: MapPoint | null; onChange: (point: MapPoint) => void; disabled?: boolean }) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapCanvasHandle>(null);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === viewerRef.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  return (
    <div ref={viewerRef} className={fullscreen ? 'flex size-full flex-col bg-[#060a10] p-3 sm:p-5' : ''}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-secondary !min-h-9 !px-3" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out"><Minus className="size-4" /></button>
        <span className="min-w-16 text-center font-mono text-xs text-muted">{Math.round(zoom * 100)}%</span>
        <button type="button" className="btn btn-secondary !min-h-9 !px-3" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in"><Plus className="size-4" /></button>
        <button type="button" className="btn btn-secondary !min-h-9 !px-3" onClick={() => mapRef.current?.reset()}><LocateFixed className="size-4" /> Reset view</button>
        <button type="button" className="btn btn-secondary !min-h-9 !px-3" onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : viewerRef.current?.requestFullscreen())}>{fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />} {fullscreen ? 'Exit fullscreen' : 'Fullscreen'}</button>
        <span className="ml-auto font-mono text-xs text-muted">{value ? `x ${value.x.toFixed(4)} · y ${value.y.toFixed(4)}` : 'No target selected'}</span>
      </div>
      <div
        className={`relative overflow-hidden border border-line ${fullscreen ? 'min-h-0 flex-1' : 'h-[320px] sm:h-[430px]'} ${disabled ? 'opacity-60' : ''}`}
        tabIndex={0}
        role="group"
        aria-label="Guess location. Use arrow keys to move the marker, Enter to place it."
        onKeyDown={(event) => {
          if (disabled || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', ' '].includes(event.key)) return;
          event.preventDefault();
          const point = value ?? { x: 0.5, y: 0.5 };
          const step = event.shiftKey ? 0.01 : 0.002;
          onChange({
            x: Math.min(1, Math.max(0, point.x + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0))),
            y: Math.min(1, Math.max(0, point.y + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0))),
          });
        }}
      >
        <MapCanvas key={src} ref={mapRef} className="size-full" image={src} width={width} height={height} value={value} disabled={disabled} onChange={onChange} onZoomChange={setZoom} />
        <div className="pointer-events-none absolute bottom-3 left-3 border border-line bg-black/70 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-slate-300">Drag to pan · wheel or pinch to zoom · tap to place</div>
      </div>
    </div>
  );
}
