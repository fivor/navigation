import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/session';
import { Category } from '@/types';
import { revalidatePath } from 'next/cache';

export const categoriesHandlers = {
  list: async () => {
    try {
      const session = await getSession();
      const userId = (session?.id as number) ?? null;
      
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
  },

  create: async (request: Request) => {
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
  },

  update: async (request: Request, id: number) => {
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

      const result = await sql<Category>`
        UPDATE categories
        SET name = ${name},
            icon = ${icon || null},
            parent_id = ${parent_id || null},
            sort_order = ${sort_order || 0},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
      `;

      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Category not found' }, { status: 404 });
      }

      revalidatePath('/');
      revalidatePath('/admin');
      revalidatePath('/admin/categories');
      return NextResponse.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      console.error('Update category error:', error);
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to update category' },
        { status: 500 }
      );
    }
  },

  delete: async (id: number) => {
    try {
      const session = await getSession();
      if (!session || session.role !== 'admin') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
      }

      const userId = session.id as number;

      // Check if category has links
      const linksResult = await sql`SELECT count(*) as count FROM links WHERE category_id = ${id} AND user_id = ${userId}`;
      if (parseInt(linksResult.rows[0].count as string) > 0) {
        return NextResponse.json({ 
          success: false, 
          message: 'Cannot delete category with existing links. Please move or delete links first.' 
        }, { status: 400 });
      }

      // Check if category has subcategories
      const childrenResult = await sql`SELECT count(*) as count FROM categories WHERE parent_id = ${id} AND user_id = ${userId}`;
      if (parseInt(childrenResult.rows[0].count as string) > 0) {
        return NextResponse.json({ 
          success: false, 
          message: 'Cannot delete category with subcategories. Please move or delete subcategories first.' 
        }, { status: 400 });
      }

      const result = await sql`
        DELETE FROM categories
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING id
      `;

      if (result.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Category not found' }, { status: 404 });
      }

      revalidatePath('/');
      revalidatePath('/admin');
      revalidatePath('/admin/categories');
      return NextResponse.json({ success: true, id });
    } catch (error: any) {
      console.error('Delete category error:', error);
      return NextResponse.json(
        { success: false, message: error.message || 'Failed to delete category' },
        { status: 500 }
      );
    }
  }
};
