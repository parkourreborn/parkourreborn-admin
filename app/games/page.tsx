import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ImageIcon } from 'lucide-react';
import AccessState from '@/components/access-state';
import PageHead from '@/components/page-head';

export const metadata: Metadata = { title: 'Games' };

export default function Page() {
  return (
    <AccessState permission="games.view">
      <PageHead eyebrow="Sections" title="Games" detail="Tools and content controls for games in the Parkour Reborn Hub." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link href="/games/parkourguessr" className="panel group min-h-52 p-6 transition hover:-translate-y-0.5 hover:border-accent/45">
          <div className="mb-12 flex items-start justify-between"><span className="grid size-11 place-items-center border border-accent/30 bg-accent/10 text-accent"><ImageIcon className="size-5" /></span><span className="badge !border-emerald-400/20 !text-emerald-300">Available</span></div>
          <div className="flex items-end gap-4"><div className="flex-1"><h3 className="font-display text-2xl font-semibold uppercase tracking-wider">Parkour Guessr</h3><p className="mt-2 text-muted">Manage image locations, map targets, and publishing.</p></div><ArrowRight className="size-5 text-muted transition group-hover:translate-x-1 group-hover:text-white" /></div>
        </Link>
      </div>
    </AccessState>
  );
}
