import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { rebornAiGapFromDoc, rebornAiLogFromDoc } from '@/lib/server/reborn-ai';
import type { RebornAiReport } from '@/lib/types';

export const runtime = 'nodejs';

const sampleSize = 300;

// The free OpenRouter quota left today. Only shown when this dashboard has
// the same OPENROUTER_API_KEY as the hub; otherwise the card says unknown.
async function freeQuota() {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) return null;
  try {
    const response = await fetch('https://openrouter.ai/api/v1/key', {
      headers: { authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(2500),
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body = await response.json() as { data?: { free_model_daily_requests?: { used?: number; limit?: number; remaining?: number } } };
    return body.data?.free_model_daily_requests ?? null;
  } catch {
    return null;
  }
}

// Reborn AI request logs (aiLogs) and unanswered questions (aiGaps), written
// by the hub's /api/reborn-ai/chat route. Both expire on their own (30 and 60
// days) through the hub's nightly Firestore cleanup.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'rebornai.view');
    const db = getAdminDb();
    const [logDocs, gapDocs, quota] = await Promise.all([
      db.collection('aiLogs').orderBy('at', 'desc').limit(sampleSize).get(),
      db.collection('aiGaps').orderBy('at', 'desc').limit(80).get(),
      freeQuota(),
    ]);
    const logs = logDocs.docs.map((doc: DocumentSnapshot) => rebornAiLogFromDoc(doc));

    const outcomes: Record<string, number> = {};
    const checks: Record<string, number> = {};
    const models = new Map<string, { tries: number; ok: number; failures: Record<string, number>; totalMs: number }>();
    const times: number[] = [];
    let escalated = 0;
    let jevRouted = 0;
    let up = 0;
    let down = 0;

    for (const log of logs) {
      outcomes[log.outcome] = (outcomes[log.outcome] ?? 0) + 1;
      checks[log.check] = (checks[log.check] ?? 0) + 1;
      if (log.totalMs !== null) times.push(log.totalMs);
      if (log.escalated) escalated += 1;
      if (log.jevRouted) jevRouted += 1;
      if (log.feedback?.vote === 'up') up += 1;
      if (log.feedback?.vote === 'down') down += 1;
      for (const attempt of log.models) {
        const entry = models.get(attempt.model) ?? { tries: 0, ok: 0, failures: {}, totalMs: 0 };
        entry.tries += 1;
        entry.totalMs += attempt.ms;
        if (attempt.result === 'ok') entry.ok += 1;
        else entry.failures[attempt.result] = (entry.failures[attempt.result] ?? 0) + 1;
        models.set(attempt.model, entry);
      }
    }
    times.sort((a, b) => a - b);

    const report: RebornAiReport = {
      sample: logs.length,
      since: logs.at(-1)?.at ?? null,
      outcomes,
      checks,
      averageMs: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0,
      medianMs: times.length ? times[Math.floor(times.length / 2)] : 0,
      escalated,
      jevRouted,
      feedback: { up, down },
      quota,
      configuredModels: (process.env.OPENROUTER_MODEL ?? '').split(',').map((model) => model.trim()).filter(Boolean),
      models: Array.from(models.entries())
        .map(([model, entry]) => ({ model, tries: entry.tries, ok: entry.ok, failures: entry.failures, averageMs: Math.round(entry.totalMs / entry.tries) }))
        .sort((a, b) => b.tries - a.tries),
      logs,
      gaps: gapDocs.docs.map((doc: DocumentSnapshot) => rebornAiGapFromDoc(doc)),
    };
    return NextResponse.json(report, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return apiError(error, 'Could not load Reborn AI logs');
  }
}
