'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Gamepad2, Images, Layers3, MapPinned, ShieldCheck, Upload } from 'lucide-react';
import AccessState from '@/components/access-state';
import PageHead from '@/components/page-head';
import { useAuth } from '@/components/auth-provider';
import type { AuditEntry } from '@/lib/types';

type OverviewData = {
  sections: number;
  games: number;
  activeImages: number;
  mapVersion: string | null;
  activity: AuditEntry[];
};

const time = (value: string | null) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Pending';

export default function Overview() {
  const { admin, api, can } = useAuth();
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!admin) return;
    api('/api/admin/overview').then(async (response) => {
      const body = await response.json() as OverviewData & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not load overview');
      setData(body);
    }).catch((nextError) => setError(nextError instanceof Error ? nextError.message : 'Could not load overview'));
  }, [admin, api]);

  const cards = [
    { name: 'Available sections', value: data?.sections ?? '—', icon: Layers3, meta: 'Overview, games, administration' },
    { name: 'Available games', value: data?.games ?? '—', icon: Gamepad2, meta: 'Parkour Guessr is ready to manage' },
    { name: 'Active Guessr images', value: data?.activeImages ?? '—', icon: Images, meta: 'Published image pool' },
    { name: 'Current map version', value: data?.mapVersion || 'Not set', icon: MapPinned, meta: 'Resolved from the active map document' },
  ];

  return (
    <AccessState permission="overview.view">
      <PageHead eyebrow="Control room" title="Overview" detail="A quick read on the Parkour Guessr content pipeline and admin access." />
      {error && <div className="mb-5 border border-red-400/25 bg-red-400/[0.06] p-4 text-red-200">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Dashboard stats">
        {cards.map(({ name, value, icon: Icon, meta }) => (
          <article className="panel relative overflow-hidden p-5" key={name}>
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent to-transparent" />
            <div className="mb-6 flex items-start justify-between gap-4"><span className="label">{name}</span><Icon className="size-5 text-accent" /></div>
            <strong className="block truncate font-display text-3xl font-semibold text-white">{value}</strong>
            <p className="mt-2 text-sm text-muted">{meta}</p>
          </article>
        ))}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_0.8fr]">
        <div className="panel p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="label">Recent admin activity</p><h3 className="mt-1 font-display text-xl uppercase tracking-wider">Audit trail</h3></div><ShieldCheck className="size-5 text-accent" /></div>
          <div className="divide-y divide-line">
            {data?.activity.length ? data.activity.map((entry) => (
              <div className="grid gap-1 py-4 sm:grid-cols-[1fr_auto] sm:items-center" key={entry.id}>
                <div><strong className="font-display uppercase tracking-wide">{entry.action.replaceAll('.', ' / ')}</strong><p className="mt-1 font-mono text-xs text-muted">{entry.actorUid}{entry.targetId ? ` → ${entry.targetId}` : ''}</p></div>
                <time className="text-sm text-muted">{time(entry.createdAt)}</time>
              </div>
            )) : <div className="py-10 text-center text-muted">{data ? 'No admin activity yet.' : 'Loading activity…'}</div>}
          </div>
        </div>

        <div className="panel p-5 sm:p-6">
          <p className="label">Quick actions</p>
          <h3 className="mt-1 font-display text-xl uppercase tracking-wider">Move work forward</h3>
          <div className="mt-5 grid gap-3">
            <Link href="/games/parkourguessr" className="group flex items-center gap-3 border border-line bg-white/[0.025] p-4 hover:border-accent/40 hover:bg-accent/[0.06]"><Upload className="size-5 text-accent" /><span className="flex-1"><strong className="block">Upload Guessr image</strong><small className="text-muted">Create a validated draft</small></span><ArrowRight className="size-4 text-muted transition group-hover:translate-x-1 group-hover:text-white" /></Link>
            <Link href="/games/parkourguessr" className="group flex items-center gap-3 border border-line bg-white/[0.025] p-4 hover:border-accent/40 hover:bg-accent/[0.06]"><Images className="size-5 text-accent" /><span className="flex-1"><strong className="block">Review drafts</strong><small className="text-muted">Filter, edit, and publish</small></span><ArrowRight className="size-4 text-muted transition group-hover:translate-x-1 group-hover:text-white" /></Link>
            {can('admins.manage') && <Link href="/admins" className="group flex items-center gap-3 border border-line bg-white/[0.025] p-4 hover:border-accent/40 hover:bg-accent/[0.06]"><ShieldCheck className="size-5 text-accent" /><span className="flex-1"><strong className="block">Manage admins</strong><small className="text-muted">Roles and account status</small></span><ArrowRight className="size-4 text-muted transition group-hover:translate-x-1 group-hover:text-white" /></Link>}
          </div>
        </div>
      </section>
    </AccessState>
  );
}
