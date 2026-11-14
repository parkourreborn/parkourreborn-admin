import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { permissions } from '@/lib/types';
import { normalizePermissions } from '@/lib/permissions';
import { adminManageCan } from '@/lib/policy';
import { apiError } from '@/lib/server/api';
import { adminFromDoc, discordIdSchema, uidForDiscordId } from '@/lib/server/admin-records';
import { assertAllowed, authenticateAdmin, requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { OWNER_UID } from '@/lib/server/owner';

export const runtime = 'nodejs';

const createSchema = z.object({
  discordId: discordIdSchema,
  permissions: z.array(z.enum(permissions)).max(permissions.length),
}).strict();

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request.headers.get('authorization'), 'admins.view');
    const docs = await getAdminDb().collection('admins').limit(100).get();
    const admins = docs.docs.map(adminFromDoc).sort((a, b) => Number(b.isOwner) - Number(a.isOwner) || a.displayName.localeCompare(b.displayName));
    return NextResponse.json({ admins });
  } catch (error) {
    return apiError(error, 'Could not load admins');
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await authenticateAdmin(request.headers.get('authorization'));
    const body = createSchema.parse(await request.json());
    const uid = uidForDiscordId(body.discordId);
    if (uid === OWNER_UID) return NextResponse.json({ error: 'The owner account is protected' }, { status: 400 });
    const granted = normalizePermissions(body.permissions);
    assertAllowed(adminManageCan(admin, null, granted));

    const ref = getAdminDb().collection('admins').doc(uid);
    if ((await ref.get()).exists) return NextResponse.json({ error: 'That Discord account is already an admin' }, { status: 409 });
    // The name starts as their Discord ID; the Discord sign-in callback
    // replaces it with their Discord name the first time they sign in.
    await ref.create({
      displayName: body.discordId,
      discordId: body.discordId,
      permissions: granted,
      disabled: false,
      createdBy: admin.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await writeAudit(admin.uid, 'admin.created', uid, { permissions: granted });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Invalid admin details' }, { status: 400 });
    return apiError(error, 'Could not create admin');
  }
}
