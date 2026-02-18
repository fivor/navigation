'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconPicker } from '@/components/ui/IconPicker';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Category } from '@/types';
import { useRouter } from 'next/navigation';

interface CategoryManagerProps {
  initialCategories?: (Category & { parent_name: string; links_count: number })[];
}

export function CategoryManager({ initialCategories = [] }: CategoryManagerProps) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  
  // 监听 initialCategories 变化并同步到本地状态
  useEffect(() => {
    // 只有当传入的 initialCategories 与当前的 categories 不一致（且确实有数据变化）时才更新
    // 简单的引用比较可能不够，因为每次 router.refresh() 都可能产生新数组引用
    // 这里我们做一个简单的 id 列表对比，或者直接更新
    
    // 为了防止“本地刚添加完 -> router.refresh() 触发 -> 导致数据回跳或重复”等问题，
    // 我们信任 initialCategories 为最新数据源。
    
    // 去重逻辑：确保不会出现重复 ID
    const uniqueCategories = initialCategories.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
    setCategories(uniqueCategories);
  }, [initialCategories]);
  
  // Only fetch if initialCategories is empty on mount (SPA navigation to this page)
  useEffect(() => {
    if (initialCategories.length === 0) {
      fetch('/api/categories')
        .then(res => res.json())
        .then((res: any) => {
          if (res.success && res.data) {
            setCategories(res.data);
          }
        })
        .catch(err => console.error('Failed to load categories', err));
    }
  }, []); // Run once on mount if empty
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [currentCategory, setCurrentCategory] = useState<Partial<Category>>({});

  const openAddModal = () => {
    setIsEditing(false);
    setCurrentCategory({});
    setIsOpen(true);
  };

  const openEditModal = (category: Category) => {
    setIsEditing(true);
    setCurrentCategory(category);
    setIsOpen(true);
  };

  const handleSubmit = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmittingRef.current || isLoading) return;
    
    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const url = isEditing ? `/api/categories/${currentCategory.id}` : '/api/categories';
      const method = isEditing ? 'PUT' : 'POST';

      const body = {
        name: currentCategory.name,
        icon: currentCategory.icon || null,
        parent_id: currentCategory.parent_id || null,
        sort_order: currentCategory.sort_order
      };

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setIsOpen(false);
        const responseData = await res.json() as any;
        
        // Update local state immediately
        // Removed manual state update to avoid duplicates with router.refresh()
        // The router.refresh() call below will trigger a re-fetch of the data
        /*
        if (responseData.success && responseData.data) {
          const newCategory = responseData.data;
          
          setCategories(prev => {
            if (isEditing) {
              return prev.map(c => c.id === newCategory.id ? { ...c, ...newCategory } : c);
            } else {
              // Check if category already exists to avoid duplicates (e.g. from router.refresh race condition)
              if (prev.some(c => c.id === newCategory.id)) {
                return prev;
              }
              // Add new category
              const categoryWithExtras = {
                ...newCategory,
                parent_name: categories.find(p => p.id === newCategory.parent_id)?.name || null,
                links_count: 0
              };
              return [categoryWithExtras, ...prev];
            }
          });
        }
        */
        
        router.refresh();
      } else {
        const data = await res.json() as any;
        alert(data.message || '操作失败');
      }
    } catch (error) {
      console.error(error);
      alert('发生错误');
    } finally {
      setIsLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleDelete = async (id: number) => {
      if(!confirm('确定要删除吗？注意：如果有下级分类或关联的链接，删除将失败。')) return;
      
      try {
        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
        if (res.ok) {
            // Update local state
            setCategories(prev => prev.filter(c => c.id !== id));
            router.refresh();
        } else {
            const data = await res.json() as any;
            alert(data.message || '删除失败');
        }
      } catch (error) {
          console.error(error);
          alert('删除出错');
      }
  };

  // Filter out the current category and its children to prevent circular references in parent selection
  // (Simple version: just filter out self)
  const availableParents = categories.filter(c => !isEditing || c.id !== currentCategory.id);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">分类管理</h1>
        <Button onClick={openAddModal}>添加分类</Button>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">名称</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">图标 (Lucide)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">父级分类</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">排序</th>
              <th className="relative px-6 py-3"><span className="sr-only">编辑</span></th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {category.name}
                    <span className="ml-2 inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/20" title={`当前分类共收录 ${category.links_count} 条链接`}>
                        {category.links_count}
                    </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {category.icon || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{category.parent_name || '-'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{category.sort_order}</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => openEditModal(category)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4">编辑</button>
                  <button onClick={() => handleDelete(category.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">删除</button>
                </td>
              </tr>
            ))}
             {categories.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  暂无分类。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto max-w-sm rounded bg-white dark:bg-gray-800 p-6 w-full shadow-xl">
            <DialogTitle className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
              {isEditing ? '编辑分类' : '添加分类'}
            </DialogTitle>
            <div className="space-y-4">
              <Input
                label="名称"
                required
                value={currentCategory.name || ''}
                onChange={e => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
              />
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  图标
                </label>
                <IconPicker
                  value={currentCategory.icon || ''}
                  onChange={(icon) => setCurrentCategory({ ...currentCategory, icon })}
                />
              </div>
              <Input
                label="排序权重"
                type="number"
                value={currentCategory.sort_order || 0}
                onChange={e => setCurrentCategory({ ...currentCategory, sort_order: parseInt(e.target.value) })}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">父级分类</label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white p-2"
                  value={currentCategory.parent_id || ''}
                  onChange={e => setCurrentCategory({ ...currentCategory, parent_id: e.target.value ? Number(e.target.value) : null })}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                >
                  <option value="">无 (作为顶级分类)</option>
                  {availableParents.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>取消</Button>
                <Button type="button" isLoading={isLoading} onClick={handleSubmit}>保存</Button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
