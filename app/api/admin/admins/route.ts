import { FieldValue } from 'firebase-admin/firestore';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { rolePermissions } from '@/lib/roles';

const createSchema = z.object({
  uid: z.string().trim().min(1).max(128),
  role: z.enum(['admin', 'editor', 'viewer']),
  displayName: z.string().trim().min(1).max(80),
});

const value = (doc: QueryDocumentSnapshot) => {
  const data = doc.data();
  return {
    uid: doc.id,
    role: data.role,
    displayName: data.displayName || 'Admin',
    disabled: data.disabled === true,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  };
};

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'admins.view');
    const docs = await getAdminDb().collection('admins').orderBy('createdAt', 'desc').limit(100).get();
    return NextResponse.json({ admins: docs.docs.map(value) });
  } catch (error) {
    return apiError(error, 'Could not load admins');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdmin(request.headers.get('authorization'), 'admins.manage');
    const body = createSchema.parse(await request.json());
    const ref = getAdminDb().collection('admins').doc(body.uid);
    if ((await ref.get()).exists) return NextResponse.json({ error: 'Admin already exists' }, { status: 409 });
    await ref.create({
      role: body.role,
      displayName: body.displayName,
      permissions: rolePermissions[body.role],
      disabled: false,
      createdBy: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeAudit(admin.uid, 'admin.created', body.uid, { role: body.role });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid admin details' }, { status: 400 });
    return apiError(error, 'Could not create admin');
  }
}
