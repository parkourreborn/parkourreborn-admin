import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { getAdminAuth, getAdminDb } from '@/lib/server/firebase-admin';
import { rolePermissions } from '@/lib/roles';

export const runtime = "nodejs";

const schema = z.object({
  role: z.enum(['admin', 'editor', 'viewer']).optional(),
  disabled: z.boolean().optional(),
}).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'admins.manage');
    const { uid } = await params;
    const body = schema.parse(await request.json());
    if (uid === admin.uid && (body.disabled === true || body.role)) return NextResponse.json({ error: 'You cannot demote or disable your own account' }, { status: 400 });
    const ref = getAdminDb().collection('admins').doc(uid);
    const target = await ref.get();
    if (!target.exists) return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    if (target.data()?.role === 'superadmin') return NextResponse.json({ error: 'Super admins must be managed through the seed process' }, { status: 400 });

    const patch = {
      ...body,
      ...(body.role ? { permissions: rolePermissions[body.role] } : {}),
      updatedBy: admin.uid,
      updatedAt: FieldValue.serverTimestamp(),
    };
    await ref.update(patch);
    if (body.disabled === true) await getAdminAuth().revokeRefreshTokens(uid).catch(() => undefined);
    await writeAudit(admin.uid, 'admin.updated', uid, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid admin changes' }, { status: 400 });
    return apiError(error, 'Could not update admin');
  }
}
