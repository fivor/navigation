import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';
import { Category } from '@/types';
import { revalidatePath } from 'next/cache';

export const runtime = 'experimental-edge';

export async function GET() {
  try {
    const session = await getSession();
    const userId = (session?.id as number) ?? null;
    
    // SQLite 不支持 ::int 转换，直接使用参数化查询
    const result = await sql<Category>`
      SELECT * FROM categories 
      WHERE (${userId} IS NULL OR user_id = ${userId})
      ORDER BY sort_order ASC, created_at DESC
    `;
    
    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get categories error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch categories' },
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

    const { name, icon, parent_id, sort_order } = await request.json();
    const userId = session.id as number;

    if (!name) {
      return NextResponse.json({ success: false, message: 'Name is required' }, { status: 400 });
    }

    // SQLite RETURNING 子句需要 db.all() 支持，已在 db.ts 中处理
    const result = await sql<Category>`
      INSERT INTO categories (name, icon, parent_id, user_id, sort_order)
      VALUES (${name}, ${icon || null}, ${parent_id || null}, ${userId}, ${sort_order || 0})
      RETURNING *
    `;

    revalidatePath('/');
    revalidatePath('/admin');
    revalidatePath('/admin/categories');
    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Create category error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create category' },
      { status: 500 }
    );
  }
}
