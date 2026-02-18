'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import { Link, Category } from '@/types';
import { useRouter } from 'next/navigation';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IconRenderer } from '@/components/ui/IconRenderer';

interface LinkManagerProps {
  initialLinks?: (Link & { category_name: string })[];
  categories?: Category[];
}

function SortableRow({ link, onEdit, onDelete }: { link: Link & { category_name: string }, onEdit: (link: Link) => void, onDelete: (id: number) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
    position: 'relative' as const,
  };

  return (
    <tr ref={setNodeRef} style={style} className={isDragging ? 'opacity-50 bg-gray-50 dark:bg-gray-700' : ''}>
      <td className="px-6 py-4 whitespace-nowrap">
        <button {...attributes} {...listeners} className="cursor-grab hover:text-gray-700 dark:hover:text-gray-300 text-gray-400">
           <IconRenderer iconName="GripVertical" className="w-5 h-5" />
        </button>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">{link.title}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">{link.url}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          {link.category_name || '未分类'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button onClick={() => onEdit(link)} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-4">编辑</button>
        <button onClick={() => onDelete(link.id)} className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300">删除</button>
      </td>
    </tr>
  );
}

export function LinkManager({
  initialLinks = [],
  categories: initialCategories = []
}: LinkManagerProps) {
  const router = useRouter();
  const [links, setLinks] = useState(initialLinks);
  const [categories, setCategories] = useState(initialCategories);

  useEffect(() => {
    if (initialLinks.length === 0) {
      fetch('/api/links')
        .then(res => res.json())
        .then((res: any) => {
           if(res.success && res.data) setLinks(res.data);
        })
        .catch(err => console.error('Failed to load links', err));
    } else {
        setLinks(initialLinks);
    }
  }, [initialLinks]);

  useEffect(() => {
    if (initialCategories.length === 0) {
      fetch('/api/categories')
        .then(res => res.json())
        .then((res: any) => {
           if(res.success && res.data) setCategories(res.data);
        })
        .catch(err => console.error('Failed to load categories', err));
    } else {
        setCategories(initialCategories);
    }
  }, [initialCategories]);

  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentLink, setCurrentLink] = useState<Partial<Link>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredLinks = useMemo(() => {
    if (selectedCategory === 'all') return links;
    // Sort links: first by sort_order (ASC), then by created_at (DESC)
    // The initialLinks prop might be sorted globally, but when we filter, we want to respect the category-specific sort order.
    // However, our backend query already sorts by sort_order then created_at.
    // The issue is when we reorder locally, we update the array but maybe the sort order logic is lost or we need to rely on the array index as the source of truth for display.
    
    // When selectedCategory is NOT 'all', we should trust the order in 'links' array if we update it correctly.
    // But 'links' contains all links.
    
    return links
        .filter(l => l.category_id.toString() === selectedCategory)
        .sort((a, b) => {
            // If sort_order is different, use it
            if ((a.sort_order || 0) !== (b.sort_order || 0)) {
                return (a.sort_order || 0) - (b.sort_order || 0);
            }
            // Fallback to created_at desc (newest first)
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
  }, [links, selectedCategory]);

  const openAddModal = () => {
    setIsEditing(false);
    // Auto-fill category if a specific category is filtered
    setCurrentLink(selectedCategory !== 'all' ? { category_id: parseInt(selectedCategory) } : {});
    setIsOpen(true);
  };

  const openEditModal = (link: Link) => {
    setIsEditing(true);
    setCurrentLink(link);
    setIsOpen(true);
  };

  const [isFetchingMetadata, setIsFetchingMetadata] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const isSubmittingRef = useRef(false);

  const fetchMetadata = async (url: string) => {
      if (!url) return;
      setIsFetchingMetadata(true);
      setFetchStatus('loading');
      try {
          const res = await fetch(`/api/fetch-metadata?url=${encodeURIComponent(url)}`, {
              method: 'POST'
          });
          
          if (!res.ok) {
              console.error('Fetch metadata failed with status:', res.status);
              setFetchStatus('error');
              return;
          }
          
          const data = await res.json() as any;
          
          if (data.success && data.data) {
              const { title, description, icon, r2_icon } = data.data;
              setCurrentLink(prev => ({
                  ...prev,
                  title: prev.title || title,
                  description: prev.description || description,
                  icon: r2_icon || icon, // Prefer R2 icon if available
                  icon_orig: icon,       // Store original URL
              }));
              setFetchStatus('success');
          } else {
              setFetchStatus('error');
          }
      } catch (e) {
          console.error('Failed to fetch metadata', e);
          setFetchStatus('error');
      } finally {
          setIsFetchingMetadata(false);
      }
  };

  const handleManualFetch = () => {
      if (currentLink.url) {
          fetchMetadata(currentLink.url);
      }
  };

  const handleUrlBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      const url = e.target.value;
      if (url && !currentLink.title && !isEditing) {
          fetchMetadata(url);
      }
  };

  const handleSubmit = async (e?: any) => {
    if (e && e.preventDefault) e.preventDefault();
    e?.stopPropagation(); // Stop propagation to avoid double submit if button is inside a form
    if (isSubmittingRef.current || isLoading) return;
    
    // Validate fields before submitting
    if (!currentLink.title || !currentLink.url) {
      alert('请填写标题和 URL');
      return;
    }
    
    isSubmittingRef.current = true;
    setIsLoading(true);

    try {
      const url = isEditing ? `/api/links/${currentLink.id}` : '/api/links';
      const method = isEditing ? 'PUT' : 'POST';
      
      const body = {
        title: currentLink.title,
        url: currentLink.url,
        description: currentLink.description,
        categoryId: currentLink.category_id || (selectedCategory !== 'all' ? parseInt(selectedCategory) : null),
        icon: currentLink.icon,
        icon_orig: currentLink.icon_orig,
        sort_order: currentLink.sort_order,
        is_recommended: currentLink.is_recommended
      };

      // Ensure categoryId is set
      if (!body.categoryId) {
         alert('请选择分类');
         setIsLoading(false);
         isSubmittingRef.current = false;
         return;
      }

      console.log('Submitting link:', method, url, body);

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data: any = await res.json();
        const saved = data.data as (Link & { category_name?: string });
        setIsOpen(false);
        // Removed manual state update to avoid duplicates with router.refresh()
        /*
        if (isEditing && saved) {
          setLinks(prev => prev.map(l => {
            if (l.id === saved.id) {
              return { ...l, ...saved, category_name: l.category_name };
            }
            return l;
          }));
        } else if (!isEditing && saved) {
          const cat = categories.find(c => c.id === saved.category_id);
          const enriched = { ...saved, category_name: cat ? cat.name : '' } as Link & { category_name: string };
          setLinks(prev => [enriched, ...prev]);
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
      if(!confirm('确定要删除吗？')) return;
      
      try {
        const res = await fetch(`/api/links/${id}`, { method: 'DELETE' });
        if (res.ok) {
            setLinks(prev => prev.filter(l => l.id !== id));
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id && selectedCategory !== 'all') {
      const oldIndex = filteredLinks.findIndex((item) => item.id === active.id);
      const newIndex = filteredLinks.findIndex((item) => item.id === over?.id);

      const newOrderedLinks = arrayMove(filteredLinks, oldIndex, newIndex);
      
      // We need to determine the new global 'sort_order' values.
      // Since 'filteredLinks' is just a subset, we can't just use 0, 1, 2... index unless we are sure.
      // A better way: assign the 'sort_order' of the item at newIndex to the moved item, and shift others?
      // Actually, simplest way for 'sort_order' column is to just re-assign 0, 1, 2... to the reordered list.
      // And update the main state.
      
      // Create a map of id -> new sort_order
      const orderMap = new Map();
      newOrderedLinks.forEach((link, index) => {
          orderMap.set(link.id, index);
      });
      
      const updatedLinks = links.map(link => {
          if (orderMap.has(link.id)) {
              return { ...link, sort_order: orderMap.get(link.id) };
          }
          return link;
      });
      
      setLinks(updatedLinks);

      // Send to backend
      const orderedIds = newOrderedLinks.map(l => l.id);
      
      try {
          await fetch('/api/links/reorder', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ linkIds: orderedIds }),
          });
          // No need to reload, we updated local state correctly
      } catch (e) {
          console.error('Failed to reorder', e);
            alert('排序保存失败');
            // Revert on failure if needed, or refresh the app data
            router.refresh();
      }
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">链接管理</h1>
        <div className="flex gap-4 w-full sm:w-auto">
             <select
                className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-800 dark:border-gray-700 dark:text-white p-2 min-w-[200px]"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
            >
                <option value="all">所有分类</option>
                {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                ))}
            </select>
            <Button onClick={openAddModal}>添加链接</Button>
        </div>
      </div>
      
      {selectedCategory !== 'all' && (
          <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              已筛选 {filteredLinks.length} 条结果（支持拖拽排序）
          </div>
      )}

      {mounted ? (
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <DndContext 
            sensors={sensors} 
            collisionDetection={closestCenter} 
            onDragEnd={handleDragEnd}
        >
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-10"></th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">标题</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">链接地址</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">所属分类</th>
                <th className="relative px-6 py-3"><span className="sr-only">编辑</span></th>
                </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <SortableContext 
                    items={filteredLinks.map(l => l.id)} 
                    strategy={verticalListSortingStrategy}
                    disabled={selectedCategory === 'all'} // Disable sorting when showing all
                >
                    {filteredLinks.map((link) => (
                        <SortableRow 
                            key={link.id} 
                            link={link} 
                            onEdit={openEditModal} 
                            onDelete={handleDelete} 
                        />
                    ))}
                </SortableContext>
                
                {filteredLinks.length === 0 && (
                <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    暂无链接。
                    </td>
                </tr>
                )}
            </tbody>
            </table>
        </DndContext>
      </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg p-8 text-center text-gray-500">
            加载中...
        </div>
      )}

      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <DialogPanel className="mx-auto max-w-sm rounded bg-white dark:bg-gray-800 p-6 w-full shadow-xl">
            <DialogTitle className="text-lg font-medium leading-6 text-gray-900 dark:text-white mb-4">
              {isEditing ? '编辑链接' : '添加链接'}
            </DialogTitle>
            <div onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL {isFetchingMetadata && <span className="text-blue-500 text-xs ml-2">正在获取元数据...</span>}
                    {fetchStatus === 'success' && <span className="text-green-500 text-xs ml-2">获取成功</span>}
                    {fetchStatus === 'error' && <span className="text-red-500 text-xs ml-2">获取失败</span>}
                </label>
                <div className="flex gap-2">
                    <div className="flex-1">
                         <input
                            type="url"
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            required
                            value={currentLink.url || ''}
                            onChange={e => setCurrentLink({ ...currentLink, url: e.target.value })}
                            onBlur={handleUrlBlur}
                            placeholder="输入链接地址"
                         />
                    </div>
                    <Button 
                        type="button" 
                        variant="secondary" 
                        onClick={handleManualFetch}
                        isLoading={isFetchingMetadata}
                        disabled={!currentLink.url}
                    >
                        获取信息
                    </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">标题</label>
                <input
                    type="text"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                    value={currentLink.title || ''}
                    onChange={e => setCurrentLink({ ...currentLink, title: e.target.value })}
                    placeholder="网站标题"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">描述</label>
                <textarea
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    rows={3}
                    value={currentLink.description || ''}
                    onChange={e => setCurrentLink({ ...currentLink, description: e.target.value })}
                    placeholder="网站描述"
                />
              </div>

              <div>
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">图标原始 URL</label>
                 <input
                    type="text"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={currentLink.icon_orig || ''}
                    onChange={e => setCurrentLink({ ...currentLink, icon_orig: e.target.value })}
                    placeholder="自动获取的图标地址"
                 />
              </div>

              <div>
                 <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">图标 R2 URL</label>
                 <input
                    type="text"
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 text-gray-900 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    value={currentLink.icon || ''}
                    onChange={e => setCurrentLink({ ...currentLink, icon: e.target.value })}
                    placeholder="上传后的 R2 地址"
                 />
              </div>

              <div className="flex items-center gap-2">
                 <input
                    type="checkbox"
                    id="is_recommended"
                    checked={currentLink.is_recommended || false}
                    onChange={e => {
                        const val = e.target.checked;
                        setCurrentLink(prev => ({ ...prev, is_recommended: val }));
                    }}
                    className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                 />
                 <label htmlFor="is_recommended" className="text-sm font-medium text-gray-700 dark:text-gray-300">设为常用推荐</label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">分类</label>
                <select
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm text-gray-900 dark:bg-gray-800 dark:border-gray-700 dark:text-white p-2"
                  value={currentLink.category_id || ''}
                  onChange={e => setCurrentLink({ ...currentLink, category_id: Number(e.target.value) })}
                  required
                >
                  <option value="">请选择分类</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="text-gray-900 dark:text-white">取消</Button>
                <Button type="button" onClick={handleSubmit} isLoading={isLoading || isFetchingMetadata}>保存</Button>
              </div>
            </div>
          </DialogPanel>
        </div>
      </Dialog>
    </div>
  );
}
