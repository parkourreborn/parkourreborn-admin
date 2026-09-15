import type { Metadata } from 'next';
import Admins from '@/components/admins';

export const metadata: Metadata = { title: 'Admins' };

export default function Page() {
  return <Admins />;
}
