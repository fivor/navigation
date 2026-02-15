import { sql } from '@/lib/db';
import { Link as LinkIcon, FolderTree, Star, Plus, Import, Download } from 'lucide-react';
import { getSession } from '@/lib/session';
import Link from 'next/link';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const runtime = 'experimental-edge';

async function getStats() {
  try {
    const session = await getSession();
    const userId = (session?.id as number) ?? null;
    
    const [linksCount, categoriesCount, recommendedCount, recentLinks] = await Promise.all([
      sql`SELECT COUNT(*) as count FROM links WHERE (${userId} IS NULL OR user_id = ${userId})`,
      sql`SELECT COUNT(*) as count FROM categories WHERE (${userId} IS NULL OR user_id = ${userId})`,
      sql`SELECT COUNT(*) as count FROM links WHERE (${userId} IS NULL OR user_id = ${userId}) AND is_recommended = 1`,
      sql`SELECT * FROM links WHERE (${userId} IS NULL OR user_id = ${userId}) ORDER BY created_at DESC LIMIT 5`
    ]);
    
    return {
      links: Number(linksCount.rows[0].count),
      categories: Number(categoriesCount.rows[0].count),
      recommended: Number(recommendedCount.rows[0].count),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentLinks: recentLinks.rows as any[]
    };
  } catch (error) {
    console.error('Failed to fetch stats:', error);
    return {
      links: 0,
      categories: 0,
      recommended: 0,
      recentLinks: []
    };
  }
}

export default async function AdminDashboardPage() {
  const stats = await getStats();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">仪表盘</h1>
        
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Links Stat */}
          <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow transition-all hover:shadow-md">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <LinkIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">链接总数</dt>
                    <dd>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.links}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Categories Stat */}
          <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow transition-all hover:shadow-md">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <FolderTree className="h-6 w-6 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">分类总数</dt>
                    <dd>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.categories}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Recommended Stat */}
          <div className="overflow-hidden rounded-lg bg-white dark:bg-gray-800 shadow transition-all hover:shadow-md">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                  <Star className="h-6 w-6 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">推荐链接</dt>
                    <dd>
                      <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.recommended}</div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Links */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">最近添加</h3>
            <Link href="/admin/links" className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400">查看全部</Link>
          </div>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {stats.recentLinks.length > 0 ? (
              stats.recentLinks.map((link) => (
                <li key={link.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <div className="flex items-center space-x-4">
                    {link.icon ? (
                      <img src={link.icon} alt="" className="h-8 w-8 rounded bg-gray-100 object-contain" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <LinkIcon className="h-4 w-4 text-gray-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {link.title}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {link.url}
                      </p>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(link.created_at).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                </li>
              ))
            ) : (
              <li className="px-6 py-10 text-center text-gray-500 dark:text-gray-400">
                暂无链接
              </li>
            )}
          </ul>
        </div>

        {/* Quick Actions */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">快捷操作</h3>
            <div className="grid grid-cols-2 gap-4">
              <Link
                href="/admin/links"
                className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
              >
                <Plus className="h-5 w-5 text-gray-400 group-hover:text-blue-500 mr-3" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-blue-600">添加链接</span>
              </Link>
              <Link
                href="/admin/categories"
                className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors group"
              >
                <Plus className="h-5 w-5 text-gray-400 group-hover:text-purple-500 mr-3" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-purple-600">管理分类</span>
              </Link>
              <Link
                href="/admin/import"
                className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
              >
                <Plus className="h-5 w-5 text-gray-400 group-hover:text-blue-500 mr-3" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-blue-600">批量导入</span>
              </Link>
              <Link
                href="/admin/import"
                className="flex items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors group"
              >
                <Download className="h-5 w-5 text-gray-400 group-hover:text-green-500 mr-3" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 group-hover:text-green-600">导出书签</span>
              </Link>
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg shadow p-6 text-white">
            <h3 className="text-lg font-medium mb-2">欢迎使用导航站管理后台</h3>
            <p className="text-blue-100 text-sm mb-4">
              您可以点击上方快捷操作开始管理您的站点。建议先完善分类体系，再通过&ldquo;批量导入&rdquo;或手动添加链接。
            </p>
            <div className="flex items-center text-xs text-blue-200">
              <span className="flex h-2 w-2 rounded-full bg-green-400 mr-2"></span>
              系统运行正常
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
