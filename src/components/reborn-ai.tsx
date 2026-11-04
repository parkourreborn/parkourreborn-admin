'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bot, Gauge, HelpCircle, RefreshCw, Search, ThumbsDown, ThumbsUp, X, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import AccessState from '@/components/access-state';
import { useAuth } from '@/components/auth-provider';
import type { RebornAiDetail, RebornAiLog, RebornAiReport } from '@/lib/types';

type Filter = 'all' | 'problems' | 'down' | 'cached';

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'problems', label: 'Problems' },
  { key: 'down', label: 'Thumbs down' },
  { key: 'cached', label: 'Cached' },
];

const when = (value: string | null) => (value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—');
const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');
const seconds = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)}s`);
const isProblem = (log: RebornAiLog) => log.outcome === 'failed' || log.outcome === 'rescued' || log.check === 'flagged' || log.feedback?.vote === 'down';

const outcomeClass: Record<string, string> = {
  answered: 'status-active',
  cached: 'status-active',
  rescued: '!border-amber-400/25 !text-amber-200',
  failed: '!border-red-400/25 !text-red-300',
  limited: 'status-muted',
};

function Stat({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint?: string }) {
  return (
    <div className="panel flex min-w-0 items-center gap-3 p-4">
      <span className="grid size-9 shrink-0 place-items-center border border-accent/20 bg-accent/[0.08] text-accent"><Icon className="size-4" /></span>
      <span className="min-w-0">
        <strong className="block font-display text-2xl leading-none">{value}</strong>
        <span className="mt-1 block truncate text-xs text-muted">{label}</span>
        {hint && <span className="block truncate text-[11px] text-slate-500">{hint}</span>}
      </span>
    </div>
  );
}

function Counts({ title, values }: { title: string; values: Record<string, number> }) {
  return (
    <section className="panel p-4">
      <h2 className="label mb-3">{title}</h2>
      <div className="flex flex-wrap gap-2">
        {Object.entries(values).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
          <span className={`badge ${outcomeClass[name] ?? ''}`} key={name}>{name} · {count}</span>
        ))}
        {!Object.keys(values).length && <span className="text-sm text-muted">Nothing yet.</span>}
      </div>
    </section>
  );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const { api } = useAuth();
  const [log, setLog] = useState<RebornAiDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const response = await api(`/api/admin/rebornai/${encodeURIComponent(id)}`);
        const body = await response.json() as { log?: RebornAiDetail; error?: string };
        if (!response.ok || !body.log) throw new Error(body.error || 'Could not load this request');
        if (live) setLog(body.log);
      } catch (nextError) {
        if (live) setError(nextError instanceof Error ? nextError.message : 'Could not load this request');
      }
    })();
    return () => { live = false; };
  }, [api, id]);

  const row = (label: string, value: React.ReactNode) => (
    <div className="grid gap-1 sm:grid-cols-[9rem_1fr]"><span className="label">{label}</span><div className="min-w-0 break-words text-sm">{value}</div></div>
  );

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
      <section className="modal-panel max-w-4xl" role="dialog" aria-modal="true" aria-label="Reborn AI request">
        <div className="modal-head">
          <div><span className="label">Request</span><h2 className="font-display text-lg font-semibold uppercase tracking-wider">{log ? when(log.at) : 'Loading…'}</h2></div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X className="size-4" /></button>
        </div>
        <div className="grid gap-4 p-4 sm:p-5">
          {error && <p className="border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}
          {log && <>
            {row('Question', <strong>{log.question}</strong>)}
            {row('Answer', <p className="whitespace-pre-wrap text-slate-300">{log.answer || '—'}</p>)}
            {row('Outcome', <span className="flex flex-wrap gap-2"><span className={`badge ${outcomeClass[log.outcome] ?? ''}`}>{log.outcome}</span><span className="badge">check {log.check}</span>{log.escalated && <span className="badge">full guide</span>}{log.cut && <span className="badge">cut short</span>}{log.guard && <span className="badge">guard {log.guard}</span>}</span>)}
            {log.error && row('Error', <span className="text-red-200">{log.error}</span>)}
            {log.feedback && row('Feedback', <span>{log.feedback.vote === 'up' ? '👍' : '👎'} {log.feedback.triage ? `(${log.feedback.triage})` : ''} {log.feedback.note && <em className="text-slate-300">“{log.feedback.note}”</em>}</span>)}
            {row('Routes', `${log.routes.join(', ') || 'none'} · ${log.handling} · style ${log.style ?? '—'} · ${log.viewer ? 'logged in' : 'anonymous'}`)}
            {row('Lookups', log.tools.map((tool) => `${tool.name} (${tool.status})`).join(', ') || 'none')}
            {!!log.chunks.length && row('Guide chunks', <span className="font-mono text-[11px] text-muted">{log.chunks.join(', ')}</span>)}
            {row('Models', <div className="grid gap-1">{log.models.map((attempt, index) => <span className="font-mono text-xs" key={`${attempt.model}-${index}`}>{attempt.model} → {attempt.result} · {attempt.ms} ms{attempt.status ? ` · ${attempt.status}` : ''}{attempt.detail ? ` · ${attempt.detail}` : ''}</span>)}{!log.models.length && <span className="text-muted">No model call (cached, limited or rescued before writing).</span>}</div>)}
            {row('Timings', <span className="font-mono text-xs">{Object.entries(log.timings).map(([name, value]) => `${name} ${value}`).join(' · ')}</span>)}
            {row('Jev', <pre className="max-h-48 overflow-auto whitespace-pre-wrap bg-black/25 p-2 font-mono text-[11px] text-slate-300">{JSON.stringify(log.jev, null, 2)}</pre>)}
            {row('Entities', <pre className="max-h-40 overflow-auto whitespace-pre-wrap bg-black/25 p-2 font-mono text-[11px] text-slate-300">{JSON.stringify(log.entities, null, 2)}</pre>)}
            {row('Facts given', <pre className="max-h-80 overflow-auto whitespace-pre-wrap bg-black/25 p-2 font-mono text-[11px] text-slate-300">{log.facts ? (() => { try { return JSON.stringify(JSON.parse(log.facts), null, 2); } catch { return log.facts; } })() : '—'}</pre>)}
          </>}
        </div>
      </section>
    </div>
  );
}

export default function RebornAi() {
  const { admin, api } = useAuth();
  const [report, setReport] = useState<RebornAiReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!admin) return;
    setLoading(true);
    setError('');
    try {
      const response = await api('/api/admin/rebornai');
      const body = await response.json() as RebornAiReport & { error?: string };
      if (!response.ok) throw new Error(body.error || 'Could not load Reborn AI logs');
      setReport(body);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load Reborn AI logs');
    } finally {
      setLoading(false);
    }
  }, [admin, api]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  const visible = useMemo(() => {
    const key = query.trim().toLowerCase();
    return (report?.logs ?? []).filter((log) => {
      if (filter === 'problems' && !isProblem(log)) return false;
      if (filter === 'down' && log.feedback?.vote !== 'down') return false;
      if (filter === 'cached' && log.outcome !== 'cached') return false;
      return !key || `${log.question} ${log.answer} ${log.routes.join(' ')} ${log.answerModel}`.toLowerCase().includes(key);
    });
  }, [filter, query, report]);

  const sample = report?.sample ?? 0;

  return (
    <AccessState permission="rebornai.view">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-muted">
          {report ? `Last ${sample} requests${report.since ? ` since ${when(report.since)}` : ''}. Logs are kept 30 days, gaps 60 days.` : 'Loading…'}
        </p>
        <button className="btn btn-secondary" onClick={() => void load()} disabled={loading}><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>

      {error && <div className="mb-4 border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</div>}

      {report && <>
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6" aria-label="Reborn AI statistics">
          <Stat icon={Bot} label="Requests" value={String(sample)} hint={`${report.outcomes.failed ?? 0} failed · ${report.outcomes.rescued ?? 0} rescued`} />
          <Stat icon={Gauge} label="Median time" value={seconds(report.medianMs)} hint={`average ${seconds(report.averageMs)}`} />
          <Stat icon={Zap} label="From cache" value={percent(report.outcomes.cached ?? 0, sample)} hint={`${percent(report.jevRouted, sample)} routed by Jev`} />
          <Stat icon={HelpCircle} label="Needed the full guide" value={String(report.escalated)} hint={`${report.gaps.length} knowledge gaps`} />
          <Stat icon={ThumbsUp} label="Thumbs up" value={String(report.feedback.up)} />
          <Stat icon={ThumbsDown} label="Thumbs down" value={String(report.feedback.down)} />
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
          <Counts title="Outcomes" values={report.outcomes} />
          <Counts title="Answer checks" values={report.checks} />
          <section className="panel p-4">
            <h2 className="label mb-3">OpenRouter free quota</h2>
            {report.quota
              ? <p className="text-sm"><strong className="font-display text-2xl">{report.quota.remaining ?? '?'}</strong> <span className="text-muted">left of {report.quota.limit ?? '?'} today</span></p>
              : <p className="text-sm text-muted">Unknown. Add the hub&apos;s OPENROUTER_API_KEY to this dashboard&apos;s environment to see it.</p>}
          </section>
        </div>

        <section className="panel mt-4 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
            <Bot className="size-4 text-accent" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider">Models</h2>
            {!!report.configuredModels.length && <span className="ml-auto truncate text-xs text-muted">Order: {report.configuredModels.join(' → ')}</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="data-table min-w-[640px]">
              <thead><tr><th>Model</th><th>Success</th><th>Tries</th><th>Average</th><th>Failures</th></tr></thead>
              <tbody>{report.models.map((model) => (
                <tr key={model.model}>
                  <td className="font-mono text-xs">{model.model}</td>
                  <td><span className={`badge ${model.ok / model.tries >= 0.8 ? 'status-active' : '!border-amber-400/25 !text-amber-200'}`}>{percent(model.ok, model.tries)}</span></td>
                  <td>{model.tries}</td>
                  <td>{seconds(model.averageMs)}</td>
                  <td className="text-xs text-muted">{Object.entries(model.failures).map(([kind, count]) => `${count} ${kind}`).join(', ') || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
            {!report.models.length && <div className="p-8 text-center text-sm text-muted">No model calls logged yet.</div>}
          </div>
        </section>

        <section className="panel mt-4 overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-4 py-3 sm:px-5">
            <AlertTriangle className="size-4 text-amber-300" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider">Knowledge gaps</h2>
            <span className="ml-auto text-xs text-muted">Questions the guide could not answer. Write or extend knowledge pages for these.</span>
          </div>
          <div className="max-h-96 divide-y divide-line overflow-y-auto">
            {report.gaps.map((gap) => (
              <div className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5" key={gap.id}>
                <div className="min-w-0">
                  <strong className="block text-sm">{gap.question}</strong>
                  <p className="mt-1 text-xs text-muted">{gap.routes.join(', ') || 'no routes'}{gap.answerable !== null ? ` · answerable ${gap.answerable.toFixed(2)}` : ''}{gap.escalated ? ' · full guide used' : ''}</p>
                </div>
                <time className="text-xs text-muted">{when(gap.at)}</time>
              </div>
            ))}
            {!report.gaps.length && <div className="p-8 text-center text-sm text-muted">No gaps logged.</div>}
          </div>
        </section>

        <section className="panel mt-4 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3 sm:px-5">
            <h2 className="mr-2 font-display text-sm font-semibold uppercase tracking-wider">Requests</h2>
            {filters.map((item) => (
              <button className={`badge ${filter === item.key ? '!border-accent/40 !text-accent' : ''}`} onClick={() => setFilter(item.key)} key={item.key}>{item.label}</button>
            ))}
            <label className="relative ml-auto min-w-0 flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <span className="sr-only">Search requests</span>
              <input className="field pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search questions and answers" />
            </label>
          </div>
          <div className="divide-y divide-line">
            {visible.map((log) => (
              <button className="grid w-full gap-1 px-4 py-3 text-left transition hover:bg-white/[0.025] sm:grid-cols-[1fr_auto] sm:items-center sm:px-5" onClick={() => setOpen(log.id)} key={log.id}>
                <div className="min-w-0">
                  <strong className="block truncate text-sm">{log.question}</strong>
                  <p className="mt-1 truncate text-xs text-muted">{log.answer || log.error || '—'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {log.feedback && (log.feedback.vote === 'up' ? <ThumbsUp className="size-3.5 text-emerald-300" /> : <ThumbsDown className="size-3.5 text-red-300" />)}
                  <span className={`badge ${outcomeClass[log.outcome] ?? ''}`}>{log.outcome}</span>
                  {log.check !== 'ok' && log.check !== 'none' && <span className="badge">{log.check}</span>}
                  <span className="font-mono text-[11px] text-muted">{seconds(log.totalMs)}</span>
                  <time className="text-xs text-muted">{when(log.at)}</time>
                </div>
              </button>
            ))}
            {!visible.length && <div className="p-10 text-center text-sm text-muted">No requests match.</div>}
          </div>
        </section>
      </>}

      {open && <Detail id={open} onClose={() => setOpen(null)} />}
    </AccessState>
  );
}
