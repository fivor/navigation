import { AdminSidebar } from '@/components/layout/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AdminSidebar />
      <main className="lg:pl-64 pt-16 lg:pt-0">
        <div className="px-4 py-8 sm:px-6 lg:px-8">
            {children}
        </div>
      </main>
    </div>
  );
}
