import type { Metadata } from 'next';
import ContentManager from '@/components/content-manager';

export const metadata: Metadata = { title: 'Time Trials' };

export default function Page() {
  return <ContentManager section="timetrials" />;
}
