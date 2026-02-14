import { sql } from '@/lib/db';
import { Link, Category } from '@/types';
import { LinkManager } from '@/components/admin/LinkManager';
import { getSession } from '@/lib/session';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

async function getLinks() {
  try {
    const session = await getSession();
    const userId = session?.id ?? null;
    const result = await sql<Link>`
      SELECT l.*, c.name as category_name 
      FROM links l
      LEFT JOIN categories c ON l.category_id = c.id
      WHERE (${userId} IS NULL OR l.user_id = ${userId})
      ORDER BY l.sort_order ASC, l.created_at DESC
    `;
    return result.rows as (Link & { category_name: string })[];
  } catch (error) {
    console.error('Failed to fetch links:', error);
    return [];
  }
}

async function getCategories() {
  try {
    const session = await getSession();
    const userId = session?.id ?? null;
    const result = await sql<Category>`
      SELECT * FROM categories 
      WHERE (${userId} IS NULL OR user_id = ${userId})
      ORDER BY sort_order ASC, created_at DESC
    `;
    return result.rows;
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return [];
  }
}

export default async function AdminLinksPage() {
  const links = await getLinks();
  const categories = await getCategories();

  return <LinkManager initialLinks={links} categories={categories} />;
}
