'use client';

import { useRef, useState } from 'react';
import { LocateFixed, Minus, Plus } from 'lucide-react';
import type { MapPoint } from '@/lib/types';

type Drag = { id: number; x: number; y: number; startX: number; startY: number; moved: boolean };

export default function MapStage({ src, value, onChange, disabled = false }: { src: string; value: MapPoint | null; onChange: (point: MapPoint) => void; disabled?: boolean }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const clampZoom = (next: number) => Math.min(5, Math.max(1, next));
  const zoomAt = (next: number, clientX?: number, clientY?: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const scale = clampZoom(next);
    const rect = stage.getBoundingClientRect();
    const px = (clientX ?? rect.left + rect.width / 2) - rect.left;
    const py = (clientY ?? rect.top + rect.height / 2) - rect.top;
    const ratio = scale / zoom;
    setPan((current) => ({ x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio }));
    setZoom(scale);
  };

  const pointAt = (clientX: number, clientY: number) => {
    const stage = stageRef.current;
    const layer = layerRef.current;
    if (!stage || !layer) return null;
    const rect = stage.getBoundingClientRect();
    const x = (clientX - rect.left - pan.x) / (layer.offsetWidth * zoom);
    const y = (clientY - rect.top - pan.y) / (layer.offsetHeight * zoom);
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)) };
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-secondary !min-h-9 !px-3" onClick={() => zoomAt(zoom - 0.35)} aria-label="Zoom out"><Minus className="size-4" /></button>
        <span className="min-w-16 text-center font-mono text-xs text-muted">{Math.round(zoom * 100)}%</span>
        <button type="button" className="btn btn-secondary !min-h-9 !px-3" onClick={() => zoomAt(zoom + 0.35)} aria-label="Zoom in"><Plus className="size-4" /></button>
        <button type="button" className="btn btn-secondary !min-h-9 !px-3" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><LocateFixed className="size-4" /> Reset view</button>
        <span className="ml-auto font-mono text-xs text-muted">{value ? `x ${value.x.toFixed(4)} · y ${value.y.toFixed(4)}` : 'No target selected'}</span>
      </div>
      <div
        ref={stageRef}
        className={`relative h-[320px] overflow-hidden border border-line bg-black/45 sm:h-[430px] ${disabled ? 'opacity-60' : ''}`}
        style={{ touchAction: 'none' }}
        onWheel={(event) => { event.preventDefault(); zoomAt(zoom + (event.deltaY < 0 ? 0.25 : -0.25), event.clientX, event.clientY); }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.id !== event.pointerId) return;
          const dx = event.clientX - drag.x;
          const dy = event.clientY - drag.y;
          if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) drag.moved = true;
          if (drag.moved) setPan((current) => ({ x: current.x + dx, y: current.y + dy }));
          drag.x = event.clientX;
          drag.y = event.clientY;
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          dragRef.current = null;
          if (!drag?.moved && !disabled) {
            const point = pointAt(event.clientX, event.clientY);
            if (point) onChange(point);
          }
        }}
        onPointerCancel={() => { dragRef.current = null; }}
      >
        <div ref={layerRef} className="absolute left-0 top-0 w-full origin-top-left select-none" style={{ aspectRatio: '5688 / 4800', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          <img src={src} alt="Parkour Reborn map" className="pointer-events-none block size-full object-contain" draggable={false} />
          {value && <span className="absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-accent shadow-[0_0_0_6px_rgba(54,185,236,0.22),0_4px_14px_rgba(0,0,0,0.8)]" style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}><span className="size-1.5 rounded-full bg-[#041018]" /></span>}
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 border border-line bg-black/70 px-2 py-1 font-mono text-[11px] uppercase tracking-wider text-slate-300">Drag to pan · wheel or controls to zoom · tap to place</div>
      </div>
    </div>
  );
}
