import type { Metadata } from 'next';
import ParkourGuessr from '@/components/parkour-guessr';

export const metadata: Metadata = { title: 'Parkour Guessr' };

export default function Page() {
  return <ParkourGuessr />;
}
