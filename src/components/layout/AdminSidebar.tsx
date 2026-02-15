'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { IconRenderer } from '@/components/ui/IconRenderer';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from './ThemeToggle';
import { useState } from 'react';
import { Dialog, DialogPanel } from '@headlessui/react';

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: '仪表盘', href: '/admin', icon: 'LayoutDashboard' },
    { name: '链接管理', href: '/admin/links', icon: 'Link' },
    { name: '分类管理', href: '/admin/categories', icon: 'FolderTree' },
    { name: '导入导出', href: '/admin/import', icon: 'Upload' },
    { name: '安全设置', href: '/admin/security', icon: 'Shield' },
    { name: '图标设置', href: '/admin/icons', icon: 'CloudCog' },
  ];

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname === href;
  };

  return (
    <>
      {/* Mobile Sidebar Toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-white dark:bg-gray-900 px-4 py-3 border-b dark:border-gray-800 shadow-sm">
          <Link href="/admin" className="flex items-center gap-2">
             <Image src="/favicon.ico" alt="Logo" width={24} height={24} className="rounded-sm" />
             <span className="font-bold text-xl text-blue-600 dark:text-blue-400 font-handwriting">一个导航站</span>
          </Link>
          <div className="flex items-center gap-2">
             <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-700 dark:text-gray-200">
               <IconRenderer iconName="Menu" className="w-6 h-6" />
             </button>
          </div>
      </div>

      <Dialog as="div" className="relative z-50 lg:hidden" open={sidebarOpen} onClose={setSidebarOpen}>
        <div className="fixed inset-0 bg-gray-900/80" />
        <div className="fixed inset-0 flex">
          <DialogPanel className="relative mr-16 flex w-full max-w-xs flex-1 transform transition-all duration-300 ease-in-out">
            <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white dark:bg-gray-900 px-6 pb-4 ring-1 ring-white/10">
               <div className="flex h-16 shrink-0 items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Image src="/favicon.ico" alt="Logo" width={24} height={24} className="rounded-sm" />
                    <span className="font-bold text-xl dark:text-white font-handwriting">一个导航站</span>
                 </div>
                 <button onClick={() => setSidebarOpen(false)} className="text-gray-700 dark:text-gray-200">
                   <IconRenderer iconName="X" className="w-6 h-6" />
                 </button>
               </div>
               <nav className="flex flex-1 flex-col">
                  <ul role="list" className="flex flex-1 flex-col gap-y-7">
                    <li>
                      <ul role="list" className="-mx-2 space-y-1">
                        {navigation.map((item) => (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              onClick={() => setSidebarOpen(false)}
                              className={`
                                group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6
                                ${isActive(item.href)
                                  ? 'bg-gray-100 text-blue-600 dark:bg-gray-800 dark:text-blue-400'
                                  : 'text-gray-700 hover:bg-gray-50 hover:text-blue-600 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white'}
                              `}
                            >
                              <IconRenderer iconName={item.icon} className="h-6 w-6 shrink-0" />
                              {item.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </li>
                    <li className="mt-auto">
                        <Button variant="ghost" className="w-full justify-start gap-x-3 text-red-600 hover:text-red-700 dark:text-red-400" onClick={handleLogout}>
                            <IconRenderer iconName="LogOut" className="h-6 w-6 shrink-0" />
                            退出登录
                        </Button>
                    </li>
                  </ul>
               </nav>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div 
          className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-800 bg-[#27272a] px-6 pb-4 transition-colors duration-300"
        >
          <div className="flex h-24 shrink-0 items-center">
             <Link href="/" className="flex items-center gap-3">
                <Image src="/favicon.ico" alt="Logo" width={32} height={32} className="rounded-md" />
                <span className="text-2xl font-bold text-white font-handwriting">一个导航站</span>
             </Link>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`
                          group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6
                          ${isActive(item.href)
                            ? 'bg-[#2a2a2a] text-white'
                            : 'text-gray-400 hover:bg-[#2a2a2a] hover:text-white'}
                        `}
                      >
                        <IconRenderer iconName={item.icon} className="h-6 w-6 shrink-0" />
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="mt-auto">
                 <Button variant="ghost" className="w-full justify-start gap-x-3 text-red-400 hover:text-red-300 hover:bg-[#2a2a2a]" onClick={handleLogout}>
                    <IconRenderer iconName="LogOut" className="h-6 w-6 shrink-0" />
                    退出登录
                 </Button>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  );
}
