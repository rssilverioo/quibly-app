import { AuthProvider } from '@/lib/auth-context';
import { AuthGate } from '@/components/layout/auth-gate';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>
        <div className="flex min-h-screen bg-quibly-bg">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <TopBar />
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </AuthGate>
    </AuthProvider>
  );
}
