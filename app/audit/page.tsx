import type { Metadata } from 'next';
import AuditTrail from '@/components/audit-trail';

export const metadata: Metadata = { title: 'Audit Trail' };

export default function Page() {
  return <AuditTrail />;
}
