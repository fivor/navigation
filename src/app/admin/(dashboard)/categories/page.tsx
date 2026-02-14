import { sql } from '@/lib/db';
import { Category } from '@/types';
import { CategoryManager } from '@/components/admin/CategoryManager';
import { getSession } from '@/lib/session';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

async function getCategories() {
  try {
    const session = await getSession();
    const userId = session?.id ?? null;
    const result = await sql<Category & { parent_name: string; links_count: number }>`
      SELECT c.*, p.name as parent_name,
      (SELECT COUNT(*) FROM links l WHERE l.category_id = c.id) as links_count
      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      WHERE (${userId} IS NULL OR c.user_id = ${userId})
      ORDER BY c.sort_order ASC, c.created_at DESC
    `;
    return result.rows;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return [];
  }
}

export default async function AdminCategoriesPage() {
  const categories = await getCategories();

  return <CategoryManager initialCategories={categories} />;
}
