import { HomeClient } from '@/components/public/HomeClient';
import { Suspense } from 'react';

export default function HomePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
    </div>}>
      <HomeClient />
    </Suspense>
  );
}
