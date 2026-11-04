import type { Metadata } from 'next';
import RebornAi from '@/components/reborn-ai';

export const metadata: Metadata = { title: 'Reborn AI' };

export default function Page() {
  return <RebornAi />;
}
