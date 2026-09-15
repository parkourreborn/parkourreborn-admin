import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError } from '@/lib/server/api';
import { requireAdmin } from '@/lib/server/admin-auth';
import { writeAudit } from '@/lib/server/audit';
import { contentSections, documentIdSchema, isContentSection } from '@/lib/server/content-sections';
import { getAdminDb } from '@/lib/server/firebase-admin';
import { contentFromDoc } from '@/lib/server/serializers';

export const runtime = 'nodejs';
type Context = { params: Promise<{ section: string; id: string }> };
const patchSchema = z.object({ id: documentIdSchema.optional(), data: z.unknown() }).strict();

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const params = await context.params;
    if (!isContentSection(params.section)) return NextResponse.json({ error: 'Unknown content section' }, { status: 404 });
    const definition = contentSections[params.section];
    const { admin } = await requireAdmin(request.headers.get('authorization'), definition.manage);
    const currentId = documentIdSchema.parse(params.id);
    const input = patchSchema.parse(await request.json());
    const data = definition.schema.partial().strict().parse(input.data);
    if (!Object.keys(data).length && (!input.id || input.id === currentId)) return NextResponse.json({ error: 'No changes supplied' }, { status: 400 });

    const db = getAdminDb();
    const currentRef = db.collection(definition.collection).doc(currentId);
    const nextId = input.id || currentId;
    const nextRef = db.collection(definition.collection).doc(nextId);
    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(currentRef);
      if (!current.exists) throw new Error('NOT_FOUND');
      if (nextId !== currentId) {
        const next = await transaction.get(nextRef);
        if (next.exists) throw new Error('CONFLICT');
        transaction.create(nextRef, { ...current.data(), ...data, updatedBy: admin.uid, updatedAt: FieldValue.serverTimestamp() });
        transaction.delete(currentRef);
      } else {
        transaction.update(currentRef, { ...data, updatedBy: admin.uid, updatedAt: FieldValue.serverTimestamp() });
      }
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === 'NOT_FOUND') throw new z.ZodError([]);
      throw error;
    });
    const action = Object.keys(data).length === 1 && typeof data.active === 'boolean'
      ? `${params.section}.${data.active ? 'published' : 'disabled'}`
      : `${params.section}.updated`;
    await writeAudit(admin.uid, action, nextId, { ...(nextId !== currentId ? { previousId: currentId } : {}), fields: Object.keys(data) });
    return NextResponse.json({ record: contentFromDoc(await nextRef.get()) });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid content changes or record not found' }, { status: 400 });
    if (error instanceof Error && error.message === 'CONFLICT') return NextResponse.json({ error: 'A record with that name already exists' }, { status: 409 });
    return apiError(error, 'Could not update content');
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const params = await context.params;
    if (!isContentSection(params.section)) return NextResponse.json({ error: 'Unknown content section' }, { status: 404 });
    const definition = contentSections[params.section];
    const { admin } = await requireAdmin(request.headers.get('authorization'), definition.manage);
    const id = documentIdSchema.parse(params.id);
    const ref = getAdminDb().collection(definition.collection).doc(id);
    if (!(await ref.get()).exists) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    await ref.delete();
    await writeAudit(admin.uid, `${params.section}.deleted`, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid content record' }, { status: 400 });
    return apiError(error, 'Could not delete content');
  }
}
