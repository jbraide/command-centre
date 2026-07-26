'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession, SessionProvider } from 'next-auth/react';
import { useState } from 'react';
import {
  LayoutDashboard,
  Film,
  Key,
  FileText,
  CheckSquare,
  FolderKanban,
  Settings,
  Menu,
  X,
  LogOut,
  SquarePen,
  BookOpen,
  Palette,
  Plug,
} from 'lucide-react';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: 'Home', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/transcriber', label: 'Reel Transcriber', icon: Film },
      { href: '/scripts', label: 'Script Writer', icon: SquarePen },
      { href: '/principles', label: 'Key Principles', icon: BookOpen },
      { href: '/styles', label: 'Script Styles', icon: Palette },
    ],
  },
  {
    label: 'Security',
    items: [
      { href: '/passwords', label: 'Password Vault', icon: Key },
      { href: '/api-keys', label: 'API Keys', icon: Key },
    ],
  },
  {
    label: 'Services',
    items: [
      { href: '/integrations', label: 'Integrations', icon: Plug },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/projects', label: 'Projects', icon: FolderKanban },
      { href: '/invoices', label: 'Invoices', icon: FileText },
      { href: '/todos', label: 'Tasks', icon: CheckSquare },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-30 w-64
          bg-[var(--panel)] border-r border-[var(--border)]
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
      >
        <div className="flex flex-col h-full">
          <div className="p-5 border-b border-[var(--border)]">
            <div className="text-lg font-bold text-[var(--accent)] tracking-wider">
              $ COMMAND CENTER
            </div>
          </div>

          <nav className="flex-1 p-3 overflow-y-auto space-y-4">
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1 text-[10px] font-semibold text-[var(--muted)] uppercase tracking-widest">
                  {group.label}
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {group.items.map((item) => {
                    const isActive = pathname === item.href;
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          flex items-center gap-3 px-3 py-2 text-sm rounded-sm transition-colors
                          ${
                            isActive
                              ? 'bg-[var(--background)] text-[var(--accent)] border border-[var(--border)]'
                              : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]'
                          }
                        `}
                      >
                        <Icon size={17} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-3 border-t border-[var(--border)]">
            <div className="flex items-center gap-3 px-3 py-2 text-sm text-[var(--muted)]">
              <div className="flex-1 truncate">
                {session?.user?.email}
              </div>
              <button
                onClick={() => signOut()}
                className="hover:text-[var(--danger)] transition-colors"
                title="Sign out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--panel)]">
          <div className="text-sm font-bold text-[var(--accent)] tracking-wider">
            $ COMMAND CENTER
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <DashboardShell>{children}</DashboardShell>
    </SessionProvider>
  );
}
