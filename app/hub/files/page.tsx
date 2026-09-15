import type { Metadata } from 'next';
import ContentManager from '@/components/content-manager';

export const metadata: Metadata = { title: 'Files' };

export default function Page() {
  return <ContentManager section="files" />;
}
