import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { auth } from '@/lib/auth';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  /*
   * Middleware already redirects unauthenticated requests, but this layout
   * re-checks server-side rather than trusting it. Middleware is a redirect
   * convenience, not the security boundary — and this is also where the user
   * details rendered in the topbar come from.
   */
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { name, email, role } = session.user;

  return (
    <div className="flex min-h-full flex-1">
      <Sidebar />

      {/* min-w-0 stops a wide table inside `main` from forcing the whole shell
          to scroll horizontally. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar name={name ?? 'Account'} email={email ?? ''} role={role} />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
