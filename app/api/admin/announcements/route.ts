import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { announcementSchema } from '@/lib/server/announcement-schema';
import { writeAudit } from '@/lib/server/audit';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { announcementFromDoc } from '@/lib/server/serializers';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'announcements.view');
    const snapshot = await getAdminDb().collection('announcements').limit(200).get();
    const announcements = snapshot.docs.map(announcementFromDoc)
      .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
    return NextResponse.json({ announcements });
  } catch (error) {
    return apiError(error, 'Could not load announcements');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'announcements.manage');
    const body = announcementSchema.parse(await request.json());
    const ref = getAdminDb().collection('announcements').doc();
    await ref.create({
      title: body.title,
      message: body.message,
      active: body.active,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      author: admin.displayName,
      createdBy: admin.uid,
      updatedBy: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeAudit(admin.uid, 'announcement.created', ref.id, { active: body.active });
    return NextResponse.json({ announcement: announcementFromDoc(await ref.get()) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid announcement' }, { status: 400 });
    return apiError(error, 'Could not create announcement');
  }
}
