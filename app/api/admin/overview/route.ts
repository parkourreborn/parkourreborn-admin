import type { Query } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { auditFromDoc } from '@/lib/server/serializers';
import type { Permission } from '@/lib/types';

export const runtime = 'nodejs';

type Stat = { key: string; label: string; value: number; href: string };
type Attention = { key: string; label: string; count: number; href: string };

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'overview.view');
    const db = getAdminDb();
    const can = (permission: Permission) => admin.permissions.includes(permission);
    const count = async (query: Query) => (await query.count().get()).data().count;
    const countActiveAnnouncements = async () => {
      const snapshot = await db.collection('announcements').where('active', '==', true).get();
      const now = Date.now();
      return snapshot.docs.filter((doc) => {
        const expiry = doc.data().expiresAt;
        return !expiry || typeof expiry.toMillis !== 'function' || expiry.toMillis() > now;
      }).length;
    };
    const countUploadedMedia = async () => {
      const snapshot = await db.collection('gifs').get();
      return snapshot.docs.filter((doc) => typeof doc.data().objectKey === 'string' && doc.data().objectKey.startsWith('gifs/')).length;
    };
    const statTasks: Promise<Stat | null>[] = [
      can('techs.view') ? count(db.collection('movement')).then((value) => ({ key: 'techs', label: 'Techs', value, href: '/hub/techs' })) : Promise.resolve(null),
      can('timetrials.view') ? count(db.collection('timetrials')).then((value) => ({ key: 'timetrials', label: 'Time trials', value, href: '/hub/timetrials' })) : Promise.resolve(null),
      can('guessr.view') ? count(db.collection('guessrImages').where('status', '==', 'published')).then((value) => ({ key: 'guessr', label: 'Guessr images', value, href: '/games/parkourguessr' })) : Promise.resolve(null),
      can('announcements.view') ? countActiveAnnouncements().then((value) => ({ key: 'announcements', label: 'Announcements', value, href: '/hub/announcements' })) : Promise.resolve(null),
      can('media.view') ? countUploadedMedia().then((value) => ({ key: 'media', label: 'Uploaded media', value, href: '/hub/media' })) : Promise.resolve(null),
    ];
    const attentionTasks: Promise<Attention | null>[] = [
      can('guessr.view') ? count(db.collection('guessrImages').where('status', '==', 'draft')).then((value) => ({ key: 'guessr-drafts', label: 'Guessr drafts', count: value, href: '/games/parkourguessr' })) : Promise.resolve(null),
      can('guessr.view') ? count(db.collection('guessrImages').where('status', '==', 'disabled')).then((value) => ({ key: 'guessr-disabled', label: 'Disabled Guessr images', count: value, href: '/games/parkourguessr' })) : Promise.resolve(null),
      can('announcements.view') ? count(db.collection('announcements').where('active', '==', false)).then((value) => ({ key: 'announcement-drafts', label: 'Unpublished announcements', count: value, href: '/hub/announcements' })) : Promise.resolve(null),
      can('media.view') ? count(db.collection('gifs').where('active', '==', false)).then((value) => ({ key: 'media-disabled', label: 'Disabled media', count: value, href: '/hub/media' })) : Promise.resolve(null),
      can('techs.view') ? count(db.collection('movement').where('active', '==', false)).then((value) => ({ key: 'techs-disabled', label: 'Disabled techs', count: value, href: '/hub/techs' })) : Promise.resolve(null),
      can('timetrials.view') ? count(db.collection('timetrials').where('active', '==', false)).then((value) => ({ key: 'trials-disabled', label: 'Disabled time trials', count: value, href: '/hub/timetrials' })) : Promise.resolve(null),
    ];
    const [statsSettled, attentionSettled, logs] = await Promise.all([
      Promise.allSettled(statTasks),
      Promise.allSettled(attentionTasks),
      can('audit.view') ? db.collection('guessrAuditLogs').orderBy('createdAt', 'desc').limit(6).get().catch(() => null) : Promise.resolve(null),
    ]);
    const stats = statsSettled.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : []);
    const attention = attentionSettled.flatMap((result) => result.status === 'fulfilled' && result.value && result.value.count > 0 ? [result.value] : []);
    if (attentionSettled.every((result) => result.status === 'fulfilled')) {
      stats.push({ key: 'attention', label: 'Needs attention', value: attention.reduce((sum, item) => sum + item.count, 0), href: attention[0]?.href || '/overview' });
    }
    return NextResponse.json({ stats, attention, activity: logs?.docs.map(auditFromDoc) || [] });
  } catch (error) {
    return apiError(error, 'Could not load overview');
  }
}
