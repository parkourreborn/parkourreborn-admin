import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { permissions } from '@/lib/types';
import { normalizePermissions } from '@/lib/permissions';
import { apiError } from '@/lib/server/api';
import { requireOwner } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { documentIdSchema } from '@/lib/server/content-sections';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { OWNER_UID } from '@/lib/server/owner';

export const runtime = 'nodejs';
type Context = { params: Promise<{ uid: string }> };

const schema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  permissions: z.array(z.enum(permissions)).max(permissions.length).optional(),
  disabled: z.boolean().optional(),
}).strict();

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { admin } = await requireOwner(request.headers.get('authorization'));
    const uid = documentIdSchema.parse((await context.params).uid);
    const body = schema.parse(await request.json());
    if (!Object.keys(body).length) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    if (uid === OWNER_UID) return NextResponse.json({ error: 'The owner account is protected' }, { status: 400 });
    const ref = getAdminDb().collection('admins').doc(uid);
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    const patch = {
      ...body,
      ...(body.permissions ? { permissions: normalizePermissions(body.permissions) } : {}),
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    };
    await ref.update(patch);
    if (body.disabled === true || body.permissions) await getAdminAuth().revokeRefreshTokens(uid).catch(() => undefined);
    await writeAudit(admin.uid, 'admin.updated', uid, { fields: Object.keys(body) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid admin changes' }, { status: 400 });
    return apiError(error, 'Could not update admin');
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { admin } = await requireOwner(request.headers.get('authorization'));
    const uid = documentIdSchema.parse((await context.params).uid);
    if (uid === OWNER_UID) return NextResponse.json({ error: 'The owner account is protected' }, { status: 400 });
    const ref = getAdminDb().collection('admins').doc(uid);
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    await ref.delete();
    await getAdminAuth().revokeRefreshTokens(uid).catch(() => undefined);
    await writeAudit(admin.uid, 'admin.deleted', uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid admin' }, { status: 400 });
    return apiError(error, 'Could not remove admin');
  }
}
