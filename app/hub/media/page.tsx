import type { Metadata } from 'next';
import MediaManager from '@/components/media-manager';

export const metadata: Metadata = { title: 'Media / GIFs' };

export default function Page() {
  return <MediaManager />;
}
