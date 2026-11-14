'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import AccessState from '@/components/access-state';
import { useAuth } from '@/components/auth-provider';
import { personName } from '@/lib/people';
import type { AuditEntry, People } from '@/lib/types';

export const auditAction = (action: string) => action.replaceAll('.', ' / ').replace(/\b\w/g, (character) => character.toUpperCase());
export const auditTime = (value: string | null) => value ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : 'Pending';

// Admin UIDs as names; other targets (images, records) stay as IDs.
const targetLabel = (people: People, targetId: string) => people[targetId] ? personName(people, targetId) : targetId;

export function AuditRows({ entries, people = {} }: { entries: AuditEntry[]; people?: People }) {
  return <div className="rows">{entries.map((entry) => (
    <div className="row" key={entry.id}>
      <div className="row__main">
        <span className="row__title">{auditAction(entry.action)}</span>
        <span className="row__sub mono">{personName(people, entry.actorUid)}{entry.targetId ? ` → ${targetLabel(people, entry.targetId)}` : ''}{entry.details.byAdministrator === true ? ' · as administrator' : ''}</span>
      </div>
      <time className="time">{auditTime(entry.createdAt)}</time>
    </div>
  ))}</div>;
}

export default function AuditTrail() {
  const { admin, api } = useAuth();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [people, setPeople] = useState<People>({});
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!admin) return;
    try {
      const response = await api('/api/admin/audit-logs');
      const data = await response.json() as { logs?: AuditEntry[]; people?: People; error?: string };
      if (!response.ok || !data.logs) throw new Error(data.error || 'Could not load audit trail');
      setLogs(data.logs);
      setPeople(data.people ?? {});
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not load audit trail');
    }
  }, [admin, api]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);
  const visible = useMemo(() => {
    const key = query.trim().toLowerCase();
    return key ? logs.filter((entry) => `${entry.action} ${entry.actorUid} ${personName(people, entry.actorUid)} ${entry.targetId || ''}`.toLowerCase().includes(key)) : logs;
  }, [logs, people, query]);

  return <AccessState permission="audit.view">
    {error && <p className="note note--bad">{error}</p>}
    <section className="panel">
      <div className="section-head">
        <h2 className="section-title">Activity</h2>
        <span className="badge">{visible.length}</span>
        <label className="search ml-auto max-w-sm"><Search aria-hidden="true" /><span className="sr-only">Search</span><input className="field" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" /></label>
      </div>
      <AuditRows entries={visible} people={people} />
      {!visible.length && <p className="empty">No activity</p>}
    </section>
  </AccessState>;
}
