import 'server-only';

import type { DocumentSnapshot } from 'firebase-admin/firestore';
import type { RebornAiAttempt, RebornAiDetail, RebornAiFeedback, RebornAiGap, RebornAiLog } from '@/lib/types';

const iso = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('toDate' in value) || typeof value.toDate !== 'function') return null;
  return value.toDate().toISOString();
};

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const strings = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
const record = (value: unknown) => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});

function attempts(value: unknown): RebornAiAttempt[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const entry = record(item);
    if (typeof entry.model !== 'string') return [];
    return [{
      model: entry.model,
      result: text(entry.result) || 'unknown',
      ms: Number(entry.ms) || 0,
      ...(typeof entry.status === 'number' ? { status: entry.status } : {}),
      ...(typeof entry.detail === 'string' ? { detail: entry.detail } : {}),
    }];
  });
}

function feedback(value: unknown): RebornAiFeedback | null {
  const entry = record(value);
  if (entry.vote !== 'up' && entry.vote !== 'down') return null;
  return { vote: entry.vote, note: text(entry.note), triage: typeof entry.triage === 'string' ? entry.triage : null };
}

export const rebornAiLogFromDoc = (doc: DocumentSnapshot): RebornAiLog => {
  const data = doc.data() || {};
  const timings = record(data.timings);
  return {
    id: doc.id,
    at: iso(data.at),
    question: text(data.question),
    answer: text(data.answer).slice(0, 1500),
    outcome: text(data.outcome) || 'unknown',
    check: text(data.check) || 'none',
    routes: strings(data.routes),
    answerModel: text(data.answerModel),
    totalMs: typeof timings.totalMs === 'number' ? timings.totalMs : null,
    escalated: data.escalated === true,
    cut: data.cut === true,
    jevRouted: record(data.jev).routed === true,
    viewer: data.viewer === true,
    error: typeof data.error === 'string' ? data.error : null,
    models: attempts(data.models),
    feedback: feedback(data.feedback),
  };
};

export const rebornAiDetailFromDoc = (doc: DocumentSnapshot): RebornAiDetail => {
  const data = doc.data() || {};
  const tools = Array.isArray(data.tools)
    ? data.tools.flatMap((item: unknown) => {
      const entry = record(item);
      return typeof entry.name === 'string' ? [{ name: entry.name, status: text(entry.status) }] : [];
    })
    : [];
  const timings = Object.fromEntries(Object.entries(record(data.timings)).filter((entry): entry is [string, number] => typeof entry[1] === 'number'));
  return {
    ...rebornAiLogFromDoc(doc),
    answer: text(data.answer),
    handling: text(data.handling),
    style: typeof data.style === 'number' ? data.style : null,
    guard: typeof data.guard === 'string' ? data.guard : null,
    entities: record(data.entities),
    tools,
    chunks: strings(data.chunks),
    jev: record(data.jev),
    timings,
    facts: text(data.facts),
  };
};

export const rebornAiGapFromDoc = (doc: DocumentSnapshot): RebornAiGap => {
  const data = doc.data() || {};
  return {
    id: doc.id,
    at: iso(data.at),
    question: text(data.question),
    routes: strings(data.routes),
    answerable: typeof data.answerable === 'number' ? data.answerable : null,
    escalated: data.escalated === true,
  };
};
