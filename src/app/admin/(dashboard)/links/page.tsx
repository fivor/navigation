import { LinkManager } from '@/components/admin/LinkManager';
import { getLinks } from '@/lib/api-handlers/links';
import { getCategories } from '@/lib/api-handlers/categories';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';
// 移除 Edge Runtime 配置，让本地开发使用 Node.js 运行时
// export const runtime = 'edge';

export default async function AdminLinksPage() {
  const session = await getSession();
  const userId = (session?.id as number) ?? null;
  
  const [links, categories] = await Promise.all([
    getLinks(userId, { limit: 1000 }), 
    getCategories(userId)
  ]);

  return <LinkManager initialLinks={links} categories={categories} />;
}
