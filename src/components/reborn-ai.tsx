'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, ThumbsDown, ThumbsUp } from 'lucide-react';
import AccessState from '@/components/access-state';
import Modal from '@/components/modal';
import { useAuth } from '@/components/auth-provider';
import type { RebornAiDetail, RebornAiLog, RebornAiReport } from '@/lib/types';

type Filter = 'all' | 'problems' | 'down' | 'cached';

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'problems', label: 'Problems' },
  { key: 'down', label: '👎' },
  { key: 'cached', label: 'Cached' },
];

const when = (value: string | null) => (value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—');
const percent = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');
const seconds = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)}s`);
const isProblem = (log: RebornAiLog) => log.outcome === 'failed' || log.outcome === 'rescued' || log.check === 'flagged' || log.feedback?.vote === 'down';

const outcomeClass: Record<string, string> = {
  answered: 'status-active',
  cached: 'status-active',
  rescued: 'status-warn',
  failed: 'status-bad',
  limited: 'status-muted',
};

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong></div>;
}

function Counts({ title, values }: { title: string; values: Record<string, number> }) {
  return (
    <section className="panel panel--pad">
      <div className="section-head"><h2 className="section-title">{title}</h2></div>
      <div className="meta">
        {Object.entries(values).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
          <span className={`badge ${outcomeClass[name] ?? ''}`} key={name}>{name} · {count}</span>
        ))}
        {!Object.keys(values).length && <span className="badge">—</span>}
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
    <div className="detail-row"><span className="label">{label}</span><div className="min-w-0 break-words text-sm text-[var(--hud-value)]">{value}</div></div>
  );
  const facts = () => { try { return JSON.stringify(JSON.parse(log?.facts || ''), null, 2); } catch { return log?.facts || '—'; } };

  return (
    <Modal wide title={log ? when(log.at) : 'Loading…'} onClose={onClose}>
      {error && <p className="note note--bad">{error}</p>}
      {log && <>
        {row('Question', <strong>{log.question}</strong>)}
        {row('Answer', <p className="m-0 whitespace-pre-wrap">{log.answer || '—'}</p>)}
        {row('Outcome', <span className="meta"><span className={`badge ${outcomeClass[log.outcome] ?? ''}`}>{log.outcome}</span><span className="badge">check {log.check}</span>{log.escalated && <span className="badge">full guide</span>}{log.cut && <span className="badge">cut short</span>}{log.guard && <span className="badge">guard {log.guard}</span>}</span>)}
        {log.error && row('Error', <span className="text-[var(--hub-danger)]">{log.error}</span>)}
        {log.feedback && row('Feedback', <span>{log.feedback.vote === 'up' ? '👍' : '👎'} {log.feedback.triage ? `(${log.feedback.triage})` : ''} {log.feedback.note && <em>“{log.feedback.note}”</em>}</span>)}
        {row('Routes', `${log.routes.join(', ') || 'none'} · ${log.handling} · style ${log.style ?? '—'} · ${log.viewer ? 'logged in' : 'anonymous'}`)}
        {row('Lookups', log.tools.map((tool) => `${tool.name} (${tool.status})`).join(', ') || 'none')}
        {!!log.chunks.length && row('Guide chunks', <span className="mono text-muted">{log.chunks.join(', ')}</span>)}
        {row('Models', <div className="grid gap-1">{log.models.map((attempt, index) => <span className="mono" key={`${attempt.model}-${index}`}>{attempt.model} → {attempt.result} · {attempt.ms} ms{attempt.status ? ` · ${attempt.status}` : ''}{attempt.detail ? ` · ${attempt.detail}` : ''}</span>)}{!log.models.length && <span>—</span>}</div>)}
        {row('Timings', <span className="mono">{Object.entries(log.timings).map(([name, value]) => `${name} ${value}`).join(' · ')}</span>)}
        {row('Jev', <pre className="code">{JSON.stringify(log.jev, null, 2)}</pre>)}
        {row('Entities', <pre className="code">{JSON.stringify(log.entities, null, 2)}</pre>)}
        {row('Facts', <pre className="code !max-h-80">{facts()}</pre>)}
      </>}
    </Modal>
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
      {error && <p className="note note--bad">{error}</p>}
      {!report && !error && <p className="empty">Loading</p>}

      {report && <>
        <section className="stats" aria-label="Reborn AI statistics">
          <Stat label="Requests" value={String(sample)} />
          <Stat label="Median" value={seconds(report.medianMs)} />
          <Stat label="Cached" value={percent(report.outcomes.cached ?? 0, sample)} />
          <Stat label="Full guide" value={String(report.escalated)} />
          <Stat label="👍 / 👎" value={`${report.feedback.up} / ${report.feedback.down}`} />
          <Stat label="Quota" value={report.quota ? `${report.quota.remaining ?? '?'} / ${report.quota.limit ?? '?'}` : '—'} />
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <Counts title="Outcomes" values={report.outcomes} />
          <Counts title="Checks" values={report.checks} />
        </div>

        <section className="panel">
          <div className="section-head"><h2 className="section-title">Models</h2></div>
          <div className="table-scroll">
            <table className="data-table min-w-[600px]">
              <thead><tr><th>Model</th><th>Success</th><th>Tries</th><th>Avg</th><th>Failures</th></tr></thead>
              <tbody>{report.models.map((model) => (
                <tr key={model.model}>
                  <td className="mono !normal-case !tracking-normal">{model.model}</td>
                  <td><span className={`badge ${model.ok / model.tries >= 0.8 ? 'status-active' : 'status-warn'}`}>{percent(model.ok, model.tries)}</span></td>
                  <td>{model.tries}</td>
                  <td>{seconds(model.averageMs)}</td>
                  <td className="muted">{Object.entries(model.failures).map(([kind, count]) => `${count} ${kind}`).join(', ') || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {!report.models.length && <p className="empty">No model calls</p>}
        </section>

        <section className="panel">
          <div className="section-head"><h2 className="section-title">Knowledge gaps</h2><span className="badge">{report.gaps.length}</span></div>
          <div className="rows max-h-96 overflow-y-auto">
            {report.gaps.map((gap) => (
              <div className="row" key={gap.id}>
                <div className="row__main">
                  <span className="row__title !whitespace-normal">{gap.question}</span>
                  <span className="row__sub">{gap.routes.join(', ') || 'no routes'}{gap.answerable !== null ? ` · ${gap.answerable.toFixed(2)}` : ''}</span>
                </div>
                <time className="time">{when(gap.at)}</time>
              </div>
            ))}
          </div>
          {!report.gaps.length && <p className="empty">No gaps</p>}
        </section>

        <section className="panel">
          <div className="section-head">
            <h2 className="section-title">Requests</h2>
            <div className="tabs">{filters.map((item) => (
              <button className={filter === item.key ? 'is-on' : ''} onClick={() => setFilter(item.key)} key={item.key}>{item.label}</button>
            ))}</div>
            <label className="search ml-auto max-w-xs"><Search aria-hidden="true" /><span className="sr-only">Search</span><input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" /></label>
            <button className="icon-btn" onClick={() => void load()} disabled={loading} title="Refresh" aria-label="Refresh"><RefreshCw className={loading ? 'animate-spin' : ''} /></button>
          </div>
          <div className="rows">
            {visible.map((log) => (
              <button className="row" onClick={() => setOpen(log.id)} key={log.id}>
                <div className="row__main">
                  <span className="row__title">{log.question}</span>
                  <span className="row__sub">{log.answer || log.error || '—'}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {log.feedback && (log.feedback.vote === 'up' ? <ThumbsUp className="size-3.5 text-[#8fe6b4]" /> : <ThumbsDown className="size-3.5 text-[var(--hub-danger)]" />)}
                  <span className={`badge ${outcomeClass[log.outcome] ?? ''}`}>{log.outcome}</span>
                  <span className="time hidden sm:inline">{seconds(log.totalMs)} · {when(log.at)}</span>
                </div>
              </button>
            ))}
          </div>
          {!visible.length && <p className="empty">No requests</p>}
        </section>
      </>}

      {open && <Detail id={open} onClose={() => setOpen(null)} />}
    </AccessState>
  );
}
