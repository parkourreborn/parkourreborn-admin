'use client';

import { useEffect, useRef, useState } from 'react';
import { LocateFixed, Maximize2, Minimize2, Minus, Plus } from 'lucide-react';
import { MapCanvas } from '@/components/map-canvas';
import type { MapCanvasHandle, MapDot } from '@/components/map-canvas';
import type { MapPoint } from '@/lib/types';

export default function MapStage({ src, width, height, value, onChange, disabled = false, dots, ring, footer }: {
  src: string;
  width: number;
  height: number;
  value: MapPoint | null;
  onChange: (point: MapPoint) => void;
  disabled?: boolean;
  dots?: MapDot[];
  ring?: number;
  footer?: React.ReactNode;
}) {
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
    <div ref={viewerRef} className={fullscreen ? 'flex size-full flex-col bg-[var(--hub-bg)] p-3 sm:p-5' : ''}>
      <div className="map-toolbar">
        <button type="button" className="icon-btn" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out" title="Zoom out"><Minus /></button>
        <span className="time min-w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button type="button" className="icon-btn" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in" title="Zoom in"><Plus /></button>
        <button type="button" className="icon-btn" onClick={() => mapRef.current?.reset()} aria-label="Reset view" title="Reset view"><LocateFixed /></button>
        <button type="button" className="icon-btn" onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : viewerRef.current?.requestFullscreen())} aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>{fullscreen ? <Minimize2 /> : <Maximize2 />}</button>
        {value && <span className="time ml-auto">{value.x.toFixed(4)}, {value.y.toFixed(4)}</span>}
      </div>
      <div
        className={`map-frame ${fullscreen ? 'min-h-0 flex-1' : 'h-[320px] sm:h-[430px]'} ${disabled ? 'opacity-60' : ''}`}
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
        <MapCanvas key={src} ref={mapRef} className="size-full" image={src} width={width} height={height} value={value} disabled={disabled} onChange={onChange} onZoomChange={setZoom} labels={{ value: 'Image location' }} dots={dots} ring={ring} />
      </div>
      {footer}
    </div>
  );
}
