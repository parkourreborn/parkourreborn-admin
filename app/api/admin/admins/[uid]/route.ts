import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { permissions } from '@/lib/types';
import { normalizePermissions } from '@/lib/permissions';
import { adminManageCan } from '@/lib/policy';
import { apiError } from '@/lib/server/api';
import { adminFromDoc } from '@/lib/server/admin-records';
import { assertAllowed, authenticateAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { documentIdSchema } from '@/lib/server/content-sections';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { OWNER_UID } from '@/lib/server/owner';

export const runtime = 'nodejs';
type Context = { params: Promise<{ uid: string }> };

const schema = z.object({
  permissions: z.array(z.enum(permissions)).max(permissions.length).optional(),
  disabled: z.boolean().optional(),
}).strict();

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { admin } = await authenticateAdmin(request.headers.get('authorization'));
    const uid = documentIdSchema.parse((await context.params).uid);
    const body = schema.parse(await request.json());
    if (!Object.keys(body).length) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });
    if (uid === OWNER_UID) return NextResponse.json({ error: 'The owner account is protected' }, { status: 400 });
    const ref = getAdminDb().collection('admins').doc(uid);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    const granted = body.permissions ? normalizePermissions(body.permissions) : undefined;
    assertAllowed(adminManageCan(admin, adminFromDoc(doc), granted));

    await ref.update({
      ...(granted ? { permissions: granted } : {}),
      ...(typeof body.disabled === 'boolean' ? { disabled: body.disabled } : {}),
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (body.disabled === true || granted) await getAdminAuth().revokeRefreshTokens(uid).catch(() => undefined);
    await writeAudit(admin.uid, 'admin.updated', uid, { fields: Object.keys(body), ...(granted ? { permissions: granted } : {}) });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid admin changes' }, { status: 400 });
    return apiError(error, 'Could not update admin');
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { admin } = await authenticateAdmin(request.headers.get('authorization'));
    const uid = documentIdSchema.parse((await context.params).uid);
    if (uid === OWNER_UID) return NextResponse.json({ error: 'The owner account is protected' }, { status: 400 });
    const ref = getAdminDb().collection('admins').doc(uid);
    const doc = await ref.get();
    if (!doc.exists) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    assertAllowed(adminManageCan(admin, adminFromDoc(doc)));
    await ref.delete();
    await getAdminAuth().revokeRefreshTokens(uid).catch(() => undefined);
    await writeAudit(admin.uid, 'admin.deleted', uid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid admin' }, { status: 400 });
    return apiError(error, 'Could not remove admin');
  }
}
