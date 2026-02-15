import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';
import { Link } from '@/types';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

export const runtime = 'experimental-edge';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id: idString } = await params;
    const id = parseInt(idString);
    const Schema = z.object({
      title: z.string().min(1).max(200),
      url: z.string().url(),
      description: z.string().max(500).optional().nullable(),
      categoryId: z.number().int(),
      icon: z.string().optional().nullable().or(z.literal('')),
      icon_orig: z.string().optional().nullable().or(z.literal('')),
      sort_order: z.number().int().min(0).optional(),
      is_recommended: z.boolean().optional(),
    });
    const parsed = Schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: 'Invalid link data' }, { status: 400 });
    }
    const { title, url, description, categoryId, icon, icon_orig, sort_order, is_recommended } = parsed.data;

    const result = await sql<Link>`
      UPDATE links
      SET title = ${title},
          url = ${url},
          description = ${description || null},
          category_id = ${categoryId},
          icon = ${icon || null},
          icon_orig = ${icon_orig || null},
          sort_order = ${sort_order || 0},
          is_recommended = ${is_recommended || false},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${id} AND user_id = ${session.id as number}
      RETURNING *
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Link not found' }, { status: 404 });
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/links');
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update link error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update link' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id: idString } = await params;
    const id = parseInt(idString);

    const result = await sql`
      DELETE FROM links
      WHERE id = ${id} AND user_id = ${session.id as number}
      RETURNING id
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Link not found' }, { status: 404 });
    }

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/links');
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Delete link error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete link' },
      { status: 500 }
    );
  }
}
