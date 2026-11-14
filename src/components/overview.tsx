'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import AccessState from '@/components/access-state';
import Announcements from '@/components/announcements';
import { AuditRows } from '@/components/audit-trail';
import { useAuth } from '@/components/auth-provider';
import type { AuditEntry } from '@/lib/types';

type OverviewData = {
  stats: { key: string; label: string; value: number; href: string }[];
  attention: { key: string; label: string; count: number; href: string }[];
  activity: AuditEntry[];
};

export default function Overview() {
  const { admin, api, can } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!admin) return;
    setError('');
    try {
      const response = await api('/api/admin/overview');
      const body = await response.json() as OverviewData & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not load overview');
      setData(body);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load overview');
    }
  }, [admin, api]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  return (
    <AccessState permission="overview.view">
      {error && <p className="note note--bad">{error}</p>}
      {!!data?.stats.length && <section className="stats" aria-label="Hub statistics">{data.stats.map((stat) => (
        <Link href={stat.href} className="stat" key={stat.key}><span>{stat.label}</span><strong>{stat.value}</strong></Link>
      ))}</section>}

      {!!data?.attention.length && <section className="panel">
        <div className="section-head"><h2 className="section-title">Needs attention</h2></div>
        <div className="rows">{data.attention.map((item) => (
          <Link href={item.href} className="row" key={item.key}><span className="row__main"><span className="row__title">{item.label}</span></span><span className="badge status-warn">{item.count}</span></Link>
        ))}</div>
      </section>}

      {can('announcements.view') && <Announcements compact onChanged={load} />}

      {can('audit.view') && <section className="panel">
        <div className="section-head"><h2 className="section-title">Activity</h2><Link href="/audit" className="btn btn-secondary btn-sm ml-auto">All</Link></div>
        {data?.activity.length ? <AuditRows entries={data.activity} /> : <p className="empty">{data ? 'No activity' : 'Loading'}</p>}
      </section>}
    </AccessState>
  );
}
