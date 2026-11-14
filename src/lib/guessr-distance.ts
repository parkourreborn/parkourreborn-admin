import type { GuessrDifficulty, GuessrImage, GuessrMode, MapPoint, NearbyImage } from '@/lib/types';

// Same distance as the game's results screen, so the numbers here match what
// players see. Keep in sync with ../parkourreborn/src/lib/guessr-score.ts.
const metersPerPixel = 1722.3 / 4756;

// Two images closer than this in the same pool get a warning.
export const nearbyMeters = { veryClose: 15, close: 50 } as const;

export type GuessrPool = { mapVersionId: string; mode: GuessrMode; difficulty: GuessrDifficulty };
type Candidate = Pick<GuessrImage, 'id' | 'imageUrl' | 'coordinates' | 'status' | 'createdBy' | 'mapVersionId' | 'mode' | 'difficulty'>;

export const metersToMapPixels = (meters: number) => meters / metersPerPixel;

export const mapDistance =(a: MapPoint, b: MapPoint, width: number, height: number) => Math.hypot((a.x - b.x) * width, (a.y - b.y) * height) * metersPerPixel;

// The game draws a round from published images with the same map, mode and
// difficulty. Drafts count too because they are on their way in.
export const inPool = (image: Candidate, pool: GuessrPool) => image.status !== 'disabled'
  && image.mapVersionId === pool.mapVersionId
  && image.mode === pool.mode
  && image.difficulty === pool.difficulty;

export function findNearby(point: MapPoint, pool: GuessrPool, images: readonly Candidate[], map: { width: number; height: number }, excludeId?: string): NearbyImage[] {
  return images
    .filter((image) => image.id !== excludeId && inPool(image, pool))
    .map((image) => ({ image, meters: mapDistance(point, image.coordinates, map.width, map.height) }))
    .filter(({ meters }) => meters < nearbyMeters.close)
    .sort((a, b) => a.meters - b.meters)
    .map(({ image, meters }) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      coordinates: image.coordinates,
      status: image.status,
      createdBy: image.createdBy,
      meters,
      level: meters < nearbyMeters.veryClose ? 'veryClose' : 'close',
    }));
}

export const formatMeters = (meters: number) => meters < 10 ? `${meters.toFixed(1)} m` : `${Math.round(meters)} m`;
