import { LinkManager } from '@/components/admin/LinkManager';
import { getLinks } from '@/lib/api-handlers/links';
import { getCategories } from '@/lib/api-handlers/categories';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export default async function AdminLinksPage() {
  const session = await getSession();
  const userId = (session?.id as number) ?? null;
  
  const [links, categories] = await Promise.all([
    getLinks(userId, { limit: 1000 }), 
    getCategories(userId)
  ]);

  return <LinkManager initialLinks={links} categories={categories} />;
}
