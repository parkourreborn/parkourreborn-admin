import { FieldValue } from 'firebase-admin/firestore';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { permissions } from '@/lib/types';
import { normalizePermissions } from '@/lib/permissions';
import { apiError } from '@/lib/server/api';
import { requireAdmin, requireOwner } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { documentIdSchema } from '@/lib/server/content-sections';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { OWNER_UID } from '@/lib/server/owner';

export const runtime = 'nodejs';

const createSchema = z.object({
  uid: documentIdSchema,
  displayName: z.string().trim().min(1).max(80),
  permissions: z.array(z.enum(permissions)).max(permissions.length),
}).strict();

const value = (doc: QueryDocumentSnapshot) => {
  const data = doc.data();
  return {
    uid: doc.id,
    displayName: data.displayName || 'Admin',
    disabled: data.disabled === true,
    permissions: Array.isArray(data.permissions) ? data.permissions.filter((item) => permissions.includes(item)) : [],
    isOwner: doc.id === OWNER_UID,
  };
};

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'admins.view');
    const docs = await getAdminDb().collection('admins').limit(100).get();
    const admins = docs.docs.map(value).sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.displayName.localeCompare(b.displayName));
    return NextResponse.json({ admins });
  } catch (error) {
    return apiError(error, 'Could not load admins');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireOwner(request.headers.get('authorization'));
    const body = createSchema.parse(await request.json());
    if (body.uid === OWNER_UID) return NextResponse.json({ error: 'The owner account is protected' }, { status: 400 });
    const ref = getAdminDb().collection('admins').doc(body.uid);
    if ((await ref.get()).exists) return NextResponse.json({ error: 'Admin already exists' }, { status: 409 });
    await ref.create({
      displayName: body.displayName,
      permissions: normalizePermissions(body.permissions),
      disabled: false,
      createdBy: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeAudit(admin.uid, 'admin.created', body.uid, { permissions: body.permissions });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid admin details' }, { status: 400 });
    return apiError(error, 'Could not create admin');
  }
}
