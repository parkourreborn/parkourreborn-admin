'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import AccessState from '@/components/access-state';
import { useAuth } from '@/components/auth-provider';
import type { AuditEntry } from '@/lib/types';

export const auditAction = (action: string) => action.replaceAll('.', ' / ').replace(/\b\w/g, (character) => character.toUpperCase());
export const auditTime = (value: string | null) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Pending';

export function AuditRows({ entries }: { entries: AuditEntry[] }) {
  return <div className="divide-y divide-line">{entries.map((entry) => <div className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5" key={entry.id}><div className="min-w-0"><strong className="block truncate text-sm">{auditAction(entry.action)}</strong><p className="mt-1 truncate font-mono text-[11px] text-muted">{entry.actorUid}{entry.targetId ? ` → ${entry.targetId}` : ''}</p></div><time className="text-xs text-muted">{auditTime(entry.createdAt)}</time></div>)}</div>;
}

export default function AuditTrail() {
  const { admin, api } = useAuth();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!admin) return;
    try {
      const response = await api('/api/admin/audit-logs');
      const data = await response.json() as { logs?: AuditEntry[]; error?: string };
      if (!response.ok || !data.logs) throw new Error(data.error || 'Could not load audit trail');
      setLogs(data.logs);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load audit trail');
    }
  }, [admin, api]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const visible = useMemo(() => {
    const key = query.trim().toLowerCase();
    return key ? logs.filter((entry) => `${entry.action} ${entry.actorUid} ${entry.targetId || ''}`.toLowerCase().includes(key)) : logs;
  }, [logs, query]);

  return <AccessState permission="audit.view"><div className="mb-4 flex items-center gap-2"><label className="relative min-w-0 flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" /><span className="sr-only">Search audit trail</span><input className="field pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search activity" /></label><span className="badge">{visible.length}</span></div>{error && <div className="mb-4 border border-red-400/25 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</div>}<section className="panel overflow-hidden"><AuditRows entries={visible} />{!visible.length && <div className="p-10 text-center text-sm text-muted">No activity.</div>}</section></AccessState>;
}
