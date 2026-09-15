import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { announcementPatchSchema } from '@/lib/server/announcement-schema';
import { writeAudit } from '@/lib/server/audit';
import { documentIdSchema } from '@/lib/server/content-sections';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { announcementFromDoc } from '@/lib/server/serializers';

export const runtime = 'nodejs';
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'announcements.manage');
    const id = documentIdSchema.parse((await context.params).id);
    const body = announcementPatchSchema.parse(await request.json());
    if (!Object.keys(body).length) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    const ref = getAdminDb().collection('announcements').doc(id);
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    const patch = {
      ...body,
      ...(Object.hasOwn(body, 'expiresAt') ? { expiresAt: body.expiresAt ? new Date(body.expiresAt) : null } : {}),
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    };
    await ref.update(patch);
    const action = Object.keys(body).length === 1 && typeof body.active === 'boolean'
      ? `announcement.${body.active ? 'published' : 'unpublished'}`
      : 'announcement.updated';
    await writeAudit(admin.uid, action, id, { fields: Object.keys(body) });
    return NextResponse.json({ announcement: announcementFromDoc(await ref.get()) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid announcement changes' }, { status: 400 });
    return apiError(error, 'Could not update announcement');
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'announcements.manage');
    const id = documentIdSchema.parse((await context.params).id);
    const ref = getAdminDb().collection('announcements').doc(id);
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    await ref.delete();
    await writeAudit(admin.uid, 'announcement.deleted', id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid announcement' }, { status: 400 });
    return apiError(error, 'Could not delete announcement');
  }
}
