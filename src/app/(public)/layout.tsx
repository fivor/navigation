import { Header } from '@/components/layout/Header';
import { getSession } from '@/lib/session';

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* <Header user={session} />  Removed Header as per requirement */}
      <main>
        {children}
      </main>
    </div>
  );
}
