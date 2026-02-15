import { sql } from '@/lib/db';
import { Category, Link } from '@/types';
import { ExternalLink } from 'lucide-react';
import NextLink from 'next/link';
import Image from 'next/image';
import { SearchBar } from '@/components/public/SearchBar';
import { CategoryNav } from '@/components/public/CategoryNav';
import { IconRenderer } from '@/components/ui/IconRenderer';
import { unstable_cache } from 'next/cache';

// Force dynamic rendering and use edge runtime for Cloudflare
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

const getCategoriesCached = unstable_cache(
  async () => {
    const result = await sql<Category>`SELECT * FROM categories ORDER BY sort_order ASC, created_at DESC`;
    return result.rows;
  },
  ['categories:list'],
  { tags: ['categories'], revalidate: 300 }
);

async function getAllLinks(search?: string) {
  const searchPattern = search ? `%${search}%` : null;
  // Fetch all links, ordered by category sort order then link sort order
  if (search) {
    const result = await sql<Link>`
        SELECT l.* 
        FROM links l
        LEFT JOIN categories c ON l.category_id = c.id
        WHERE (${searchPattern} IS NULL OR l.title LIKE ${searchPattern} OR l.description LIKE ${searchPattern})
        ORDER BY c.sort_order ASC, l.sort_order ASC, l.created_at DESC
    `;
    return result.rows;
  }
  const cached = await unstable_cache(
    async () => {
      const result = await sql<Link>`
        SELECT l.* 
        FROM links l
        LEFT JOIN categories c ON l.category_id = c.id
        ORDER BY c.sort_order ASC, l.sort_order ASC, l.created_at DESC
      `;
      return result.rows;
    },
    ['links:all'],
    { tags: ['links'], revalidate: 300 }
  )();
  return cached;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;

  const categories = await getCategoriesCached();
  const allLinks = await getAllLinks(search);

  // Group links by category
  const linksByCategory: Record<number, Link[]> = {};
  const recommendedLinks: Link[] = [];

  allLinks.forEach(link => {
    if (link.is_recommended) {
      recommendedLinks.push(link);
    }
    if (!linksByCategory[link.category_id]) {
      linksByCategory[link.category_id] = [];
    }
    linksByCategory[link.category_id].push(link);
  });

  return (
    <div className="flex min-h-screen">
      {/* Left Sidebar - Full height, fixed */}
      <aside 
        className="w-64 flex-shrink-0 bg-[#27272a] text-white fixed top-0 bottom-0 left-0 overflow-y-auto z-40 flex flex-col transition-colors duration-300 border-r border-gray-800"
      >
        <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
                <Image src="/favicon.ico" alt="Logo" width={32} height={32} className="rounded-md" />
                <h1 className="text-2xl font-bold text-white font-handwriting">一个导航站</h1>
            </div>
            <CategoryNav categories={categories} hasRecommended={recommendedLinks.length > 0} />
        </div>
        
        {/* Bottom Actions */}
        <div className="mt-auto p-4 border-t border-gray-800">
             <NextLink href="/admin" className="flex items-center gap-2 p-2 text-gray-400 hover:text-white transition-colors group" title="管理后台">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-settings group-hover:rotate-90 transition-transform duration-500"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1-1-1.72v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                <span className="text-sm font-medium">设置</span>
             </NextLink>
        </div>
      </aside>

      {/* Main Content - Offset by sidebar width */}
      <div className="flex-1 ml-64 min-h-screen bg-gray-50 dark:bg-gray-900">
         <div className="max-w-7xl mx-auto px-8 py-8 space-y-12">
            
           {/* Search Bar - width equals one card column */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 mb-4">
               <div>
                 <SearchBar />
               </div>
            </div>

        {search && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              &ldquo;{search}&rdquo; 的搜索结果
            </h1>
          </div>
        )}

        {recommendedLinks.length > 0 && (
            <section id="recommended" className="scroll-mt-12">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <span className="w-1 h-5 bg-red-500 rounded-full"></span>
                常用推荐
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                {recommendedLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  className="group relative block bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-md shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden hover:shadow-2xl hover:scale-105 hover:border-blue-500/50 dark:hover:border-blue-400/50 transition-all duration-300 h-20"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="p-2 flex gap-2 h-full items-center relative z-10">
                      {/* Left: Icon */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 overflow-hidden">
                          {link.icon ? (
                            <img src={link.icon} alt="" className="w-8 h-8 object-cover" />
                          ) : (
                            <ExternalLink className="w-4 h-4" />
                          )}
                        </div>
                      </div>

                      {/* Right: Content */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                            {link.title}
                        </h3>
                        
                        {link.description && (
                          <p className="mt-0 text-[10px] text-gray-400 dark:text-gray-500 line-clamp-2 break-words">
                            {link.description}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* URL Tooltip/Footer - Absolute positioned at bottom */}
                     <div className="absolute bottom-0 left-0 right-0 px-2 py-0.5 bg-gray-50/90 dark:bg-gray-700/90 text-[8px] text-gray-400 truncate opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                        {link.url}
                     </div>
                  </a>
                ))}
              </div>
            </section>
        )}

        {categories.map((category) => {
          const categoryLinks = linksByCategory[category.id] || [];
          if (categoryLinks.length === 0) return null;

          return (
            <section key={category.id} id={`category-${category.id}`} className="scroll-mt-12">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <IconRenderer iconName={category.icon} className="w-5 h-5 text-blue-600" />
                {!category.icon && <span className="w-1 h-5 bg-blue-600 rounded-full"></span>}
                {category.name}
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
                {categoryLinks.map((link) => (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  className="group relative block bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-md shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden hover:shadow-2xl hover:scale-105 hover:border-blue-500/50 dark:hover:border-blue-400/50 transition-all duration-300 h-20"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="p-2 flex gap-2 h-full items-center relative z-10">
                      {/* Left: Icon */}
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-gray-50 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 overflow-hidden">
                          {link.icon ? (
                            <img src={link.icon} alt="" className="w-8 h-8 object-cover" />
                          ) : (
                            <ExternalLink className="w-4 h-4" />
                          )}
                        </div>
                      </div>

                      {/* Right: Content */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                            {link.title}
                        </h3>
                        
                        {link.description && (
                          <p className="mt-0 text-[10px] text-gray-400 dark:text-gray-500 line-clamp-2 break-words">
                            {link.description}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* URL Tooltip/Footer - Absolute positioned at bottom */}
                     <div className="absolute bottom-0 left-0 right-0 px-2 py-0.5 bg-gray-50/90 dark:bg-gray-700/90 text-[8px] text-gray-400 truncate opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                        {link.url}
                     </div>
                  </a>
                ))}
              </div>
            </section>
          );
        })}

        {allLinks.length === 0 && (
           <div className="text-center py-12 text-gray-500 dark:text-gray-400">
             未找到相关链接。
           </div>
        )}
        </div>
      </div>
    </div>
  );
}
