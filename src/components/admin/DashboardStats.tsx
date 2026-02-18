'use client';

import { useEffect, useState } from 'react';
import { IconRenderer } from '@/components/ui/IconRenderer';
import { Link as LinkType } from '@/types';

interface DashboardStats {
  links: number;
  categories: number;
  recommended: number;
  recentLinks: LinkType[];
}

export function DashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    links: 0,
    categories: 0,
    recommended: 0,
    recentLinks: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then((res: any) => {
        if (res.success && res.data) {
          setStats(res.data);
        }
      })
      .catch(err => console.error('Failed to load stats', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
                  <IconRenderer iconName="Link" className="h-6 w-6 text-blue-600 dark:text-blue-400" />
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
                  <IconRenderer iconName="FolderTree" className="h-6 w-6 text-purple-600 dark:text-purple-400" />
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
                  <IconRenderer iconName="Star" className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
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

        {/* Recent Links */}
        <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                    最近添加的链接
                </h3>
            </div>
            <ul role="list" className="divide-y divide-gray-200 dark:divide-gray-700">
                {stats.recentLinks.length > 0 ? (
                    stats.recentLinks.map((link) => (
                        <li key={link.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center truncate">
                                    <div className="flex-shrink-0">
                                        {link.icon ? (
                                             <img src={link.icon} alt="" className="h-8 w-8 rounded bg-gray-100 dark:bg-gray-600" />
                                        ) : (
                                            <div className="h-8 w-8 rounded bg-gray-100 dark:bg-gray-600 flex items-center justify-center">
                                                <IconRenderer iconName="Link" className="h-4 w-4 text-gray-500" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="ml-4 truncate">
                                        <p className="text-sm font-medium text-blue-600 dark:text-blue-400 truncate">{link.title}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{link.url}</p>
                                    </div>
                                </div>
                                <div className="ml-2 flex-shrink-0 flex flex-col items-end">
                                    <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                        {new Date(link.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </li>
                    ))
                ) : (
                    <li className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                        暂无数据
                    </li>
                )}
            </ul>
        </div>
      </div>
    </div>
  );
}
