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
type Context = { params: Promise<{ section: string }> };
const requestSchema = z.object({ id: documentIdSchema, data: z.unknown() }).strict();

export async function GET(request: NextRequest, context: Context) {
  try {
    const { section } = await context.params;
    if (!isContentSection(section)) return NextResponse.json({ error: 'Unknown content section' }, { status: 404 });
    const definition = contentSections[section];
    await requireAdmin(request.headers.get('authorization'), definition.view);
    const snapshot = await getAdminDb().collection(definition.collection).limit(500).get();
    const records = snapshot.docs.map(contentFromDoc).sort((a, b) => a.id.localeCompare(b.id));
    return NextResponse.json({ records });
  } catch (error) {
    return apiError(error, 'Could not load content');
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { section } = await context.params;
    if (!isContentSection(section)) return NextResponse.json({ error: 'Unknown content section' }, { status: 404 });
    const definition = contentSections[section];
    const { admin } = await requireAdmin(request.headers.get('authorization'), definition.manage);
    const input = requestSchema.parse(await request.json());
    const data = definition.schema.parse(input.data);
    const ref = getAdminDb().collection(definition.collection).doc(input.id);
    if ((await ref.get()).exists) return NextResponse.json({ error: 'A record with that name already exists' }, { status: 409 });
    await ref.create({ ...data, createdBy: admin.uid, updatedBy: admin.uid, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await writeAudit(admin.uid, `${section}.created`, input.id);
    return NextResponse.json({ record: contentFromDoc(await ref.get()) }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid content record' }, { status: 400 });
    return apiError(error, 'Could not create content');
  }
}
