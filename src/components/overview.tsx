'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bell, ImageIcon, ListChecks, ScrollText, Timer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
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

const statIcons: Record<string, LucideIcon> = {
  techs: ListChecks,
  timetrials: Timer,
  guessr: ImageIcon,
  announcements: Bell,
  media: ImageIcon,
  attention: AlertTriangle,
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
      {error && <div className="mb-4 border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</div>}
      {!!data?.stats.length && <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6" aria-label="Hub statistics">{data.stats.map((stat) => {
        const Icon = statIcons[stat.key] || ListChecks;
        return <Link href={stat.href} className="panel group flex min-w-0 items-center gap-3 p-4 transition hover:border-accent/40" key={stat.key}><span className="grid size-9 shrink-0 place-items-center border border-accent/20 bg-accent/[0.08] text-accent"><Icon className="size-4" /></span><span className="min-w-0"><strong className="block font-display text-2xl leading-none">{stat.value}</strong><span className="mt-1 block truncate text-xs text-muted">{stat.label}</span></span></Link>;
      })}</section>}

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        {can('announcements.view') && <Announcements compact onChanged={load} />}
        <section className="panel overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5"><AlertTriangle className="size-4 text-amber-300" /><h2 className="font-display text-sm font-semibold uppercase tracking-wider">Needs attention</h2><span className="badge ml-auto">{data?.attention.reduce((sum, item) => sum + item.count, 0) || 0}</span></div>
          <div className="divide-y divide-line">{data?.attention.map((item) => <Link href={item.href} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-white/[0.025] sm:px-5" key={item.key}><span className="min-w-0 flex-1 truncate">{item.label}</span><strong className="font-mono text-amber-200">{item.count}</strong></Link>)}</div>
          {data && !data.attention.length && <div className="p-8 text-center text-sm text-muted">Nothing pending.</div>}
          {!data && <div className="p-8 text-center text-sm text-muted">Loading…</div>}
        </section>
      </div>

      {can('audit.view') && <section className="panel mt-4 overflow-hidden"><div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5"><ScrollText className="size-4 text-accent" /><h2 className="font-display text-sm font-semibold uppercase tracking-wider">Audit trail</h2><Link href="/audit" className="ml-auto text-xs text-accent hover:text-white">View all</Link></div>{data?.activity.length ? <AuditRows entries={data.activity} /> : <div className="p-8 text-center text-sm text-muted">No activity.</div>}</section>}
    </AccessState>
  );
}
