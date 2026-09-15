import type { Metadata } from 'next';
import ContentManager from '@/components/content-manager';

export const metadata: Metadata = { title: 'Links' };

export default function Page() {
  return <ContentManager section="links" />;
}
