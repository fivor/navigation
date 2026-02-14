import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';
import { Link } from '@/types';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('category') ? parseInt(searchParams.get('category')!) : null;
    const search = searchParams.get('search') || null;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const searchPattern = search ? `%${search}%` : null;
    const session = await getSession();
    const userId = (session?.id as number) ?? null;

    // SQLite 语法调整: 
    // 1. 移除 ::int, ::text 等转换
    // 2. ILIKE -> LIKE (SQLite 默认 LIKE 不区分大小写)
    const result = await sql<Link>`
      SELECT * FROM links 
      WHERE (${userId} IS NULL OR user_id = ${userId})
      AND (${categoryId} IS NULL OR category_id = ${categoryId})
      AND (${searchPattern} IS NULL OR title LIKE ${searchPattern} OR description LIKE ${searchPattern})
      ORDER BY sort_order ASC, created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Get total count for pagination
    const countResult = await sql`
      SELECT COUNT(*) as total FROM links 
      WHERE (${userId} IS NULL OR user_id = ${userId})
      AND (${categoryId} IS NULL OR category_id = ${categoryId})
      AND (${searchPattern} IS NULL OR title LIKE ${searchPattern} OR description LIKE ${searchPattern})
    `;

    const total = parseInt(countResult.rows[0].total as string);

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get links error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch links' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'admin') {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

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
    const parse = Schema.safeParse(await request.json());
    if (!parse.success) {
      return NextResponse.json({ success: false, message: 'Invalid link data' }, { status: 400 });
    }

    const { title, url, description, categoryId, icon, icon_orig, sort_order, is_recommended } = parse.data;

    const result = await sql<Link>`
      INSERT INTO links (title, url, description, category_id, icon, icon_orig, user_id, sort_order, is_recommended)
      VALUES (${title}, ${url}, ${description || null}, ${categoryId}, ${icon || null}, ${icon_orig || null}, ${session.id as number}, ${sort_order || 0}, ${is_recommended || false})
      RETURNING *
    `;

    // Precise invalidation
    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/links');
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Create link error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create link' },
      { status: 500 }
    );
  }
}
