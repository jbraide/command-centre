'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut, useSession, SessionProvider } from 'next-auth/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { TranscriptionQueueProvider, useTranscriptionQueue } from '@/lib/transcription-queue';
import { FocusProvider, useFocus } from '@/lib/focus-context';
import { AuthSessionGuard, installAuthInterceptor } from '@/lib/session-guard';

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
  HardDriveUpload,
  Lightbulb,
  Bot,
  BrainCircuit,
  Youtube,
  Users,
  Loader2,
  CheckCircle,
  AlertCircle,
  List,
  Bell,
  Timer,
  Grid3x3,
  CalendarCheck,
  ListFilter,
  ExternalLink,
  Mail,
  Target,
  CalendarDays,
  CalendarRange,
} from 'lucide-react';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/', label: 'Home', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/projects', label: 'Projects', icon: FolderKanban },
      { href: '/invoices', label: 'Invoices', icon: FileText },
      { href: '/todos', label: 'Tasks', icon: CheckSquare },
      { href: '/email', label: 'Email', icon: Mail },
    ],
  },
  {
    label: 'Capture',
    items: [
      { href: '/ideas', label: 'Idea Hub', icon: Lightbulb },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/transcriber', label: 'Reel Transcriber', icon: Film },
      { href: '/youtube-transcriber', label: 'YouTube Transcriber', icon: Youtube },
      { href: '/scripts', label: 'Script Writer', icon: SquarePen },
      { href: '/content-calendar', label: 'Content Calendar', icon: CalendarRange },
      { href: '/principles', label: 'Key Principles', icon: BookOpen },
      { href: '/styles', label: 'Script Styles', icon: Palette },
      { href: '/personas', label: 'Creator Personas', icon: Users },
    ],
  },
  {
    label: 'Planning',
    items: [
      { href: '/goals', label: 'Goals', icon: Target },
      { href: '/calendar', label: 'Calendar', icon: CalendarDays },
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
      { href: '/storage', label: 'File Storage', icon: HardDriveUpload },
    ],
  },
  {
    label: 'Focus',
    items: [
      { href: '/focus', label: 'Focus Timer', icon: Timer },
      { href: '/matrix', label: 'Eisenhower Matrix', icon: Grid3x3 },
      { href: '/habits', label: 'Habits', icon: CalendarCheck },
      { href: '/smart-lists', label: 'Smart Lists', icon: ListFilter },
      { href: '/stopwatch', label: 'Stopwatch', icon: Timer },
    ],
  },
  {
    label: 'AI',
    items: [
      { href: '/memories', label: 'Memory Bank', icon: BrainCircuit },
      { href: '/ai', label: 'AI Assistant', icon: Bot },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

interface Reminder {
  id: string;
  title: string;
  triggerAt: string;
  fired: boolean;
  note?: string | null;
  task?: { id: string; title: string; projectId: string } | null;
  idea?: { id: string; title: string } | null;
}

function NotificationBell() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);
  const previousCountRef = useRef(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch('/api/reminders/pending');
      if (!res.ok) return;
      const data: Reminder[] = await res.json();
      setReminders(data);

      // Show browser notification for new reminders
      if (data.length > previousCountRef.current && previousCountRef.current > 0 && 'Notification' in window && Notification.permission === 'granted') {
        const newOnes = data.slice(0, data.length - previousCountRef.current);
        newOnes.forEach((r) => {
          new Notification(r.title, {
            body: r.note || 'You have a reminder',
            tag: r.id,
          });
        });
      }
      previousCountRef.current = data.length;
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  // Initial fetch + poll every 60s
  useEffect(() => {
    fetchPending();
    pollRef.current = setInterval(fetchPending, 60000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchPending]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`/api/reminders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fired: true }),
      });
      setReminders((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // Silently fail
    }
  };

  function timeRemaining(triggerAt: string): string {
    const diff = Date.now() - new Date(triggerAt).getTime();
    const mins = Math.floor(Math.abs(diff) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {reminders.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
            {reminders.length > 9 ? '9+' : reminders.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-xl shadow-black/30 z-50">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Notifications
            </h3>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {reminders.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[var(--muted)]">
                No pending notifications
              </div>
            ) : (
              reminders.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--background)]/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {r.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-[var(--muted)]">
                          {timeRemaining(r.triggerAt)}
                        </span>
                        {r.note && (
                          <span className="text-[10px] text-[var(--muted)] truncate">
                            · {r.note}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(r.id);
                      }}
                      className="shrink-0 px-2 py-1 text-[10px] font-medium rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
                    >
                      Mark read
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {reminders.length > 5 && (
            <div className="px-4 py-2 text-center border-t border-[var(--border)]">
              <span className="text-[10px] text-[var(--muted)]">
                +{reminders.length - 5} more
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QueueStatusIndicator() {
  const { queue, isProcessing } = useTranscriptionQueue();
  const active = queue.filter((q) => q.status === 'downloading' || q.status === 'transcribing').length;
  const done = queue.filter((q) => q.status === 'done').length;
  const total = queue.length;

  if (total === 0) return null;

  return (
    <a
      href="/youtube-transcriber"
      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
        isProcessing
          ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400'
          : 'border-[var(--accent)]/30 bg-[var(--accent)]/5 text-[var(--accent)]'
      }`}
    >
      {isProcessing ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <CheckCircle size={12} />
      )}
      <span className="font-medium">{done}/{total}</span>
      <List size={12} className="opacity-60" />
    </a>
  );
}

function FloatingTasks() {
  const [tasks, setTasks] = useState<{ id: string; title: string; completed: boolean; projectId: string; projectName: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch from matrix endpoint which returns all tasks with project info
      const res = await fetch('/api/projects/matrix');
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      const all: typeof tasks = [];
      for (const q of ['do', 'schedule', 'delegate', 'eliminate']) {
        for (const t of data.quadrants?.[q] || []) {
          all.push({
            id: t.id,
            title: t.title,
            completed: t.completed,
            projectId: t.projectId,
            projectName: t.project?.name || '',
          });
        }
      }
      setTasks(all.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1)).slice(0, 10));
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchTasks();
  }, [open, fetchTasks]);

  const toggleTask = async (taskId: string, completed: boolean) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed: !completed } : t)));
    try {
      await fetch(`/api/projects/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed }),
      });
    } catch { setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed } : t))); }
  };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-40 w-12 h-12 rounded-full bg-[var(--accent)] text-[var(--background)] shadow-lg shadow-black/30 hover:brightness-110 transition-all flex items-center justify-center"
        title="Quick Tasks"
      >
        <CheckSquare size={20} />
        {tasks.filter((t) => !t.completed).length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {tasks.filter((t) => !t.completed).length}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="fixed bottom-20 right-5 z-50 w-80 max-h-96 bg-[var(--panel)] border border-[var(--border)] rounded-lg shadow-xl shadow-black/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">Quick Tasks</h3>
              <a href="/projects" className="text-[10px] text-[var(--accent)] hover:underline" onClick={() => setOpen(false)}>
                View all
              </a>
            </div>
            <div className="overflow-y-auto max-h-80">
              {loading ? (
                <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-[var(--muted)]" /></div>
              ) : tasks.length === 0 ? (
                <p className="text-sm text-[var(--muted)] text-center py-6">No tasks yet</p>
              ) : (
                tasks.map((t) => (
                  <a
                    key={t.id}
                    href={`/projects/${t.projectId}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--background)]/50 transition-colors group"
                  >
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleTask(t.id, t.completed); }}
                      className={`shrink-0 ${t.completed ? 'text-[var(--accent)]' : 'text-[var(--muted)] hover:text-[var(--accent)]'}`}
                    >
                      {t.completed ? <CheckCircle size={16} /> : <div className="w-4 h-4 rounded border border-current" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm block truncate ${t.completed ? 'line-through text-[var(--muted)]' : 'text-[var(--foreground)]'}`}>
                        {t.title}
                      </span>
                      {t.projectName && (
                        <span className="text-[10px] text-[var(--muted)]">{t.projectName}</span>
                      )}
                    </div>
                    <ExternalLink size={12} className="shrink-0 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-all" />
                  </a>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function FocusTimerIndicator() {
  const { focus, pauseFocus, resumeFocus, stopFocus } = useFocus();

  // Update browser title with timer — always called (React hooks rule)
  useEffect(() => {
    const isActive = focus.isRunning || focus.isBreak;
    if (isActive) {
      const mins = Math.floor(focus.timeRemaining / 60);
      const secs = focus.timeRemaining % 60;
      const prefix = `${mins}:${secs.toString().padStart(2, '0')}`;
      const suffix = focus.isBreak ? ' 🔋' : ' 🎯';
      document.title = `${prefix}${suffix} - Command Center`;
    } else {
      document.title = 'Command Center';
    }
    return () => { if (!isActive) document.title = 'Command Center'; };
  }, [focus.isRunning, focus.isBreak, focus.timeRemaining]);

  // Also restore title on unmount
  useEffect(() => {
    return () => { document.title = 'Command Center'; };
  }, []);

  if (!focus.isRunning && !focus.isBreak) return null;

  const mins = Math.floor(focus.timeRemaining / 60);
  const secs = focus.timeRemaining % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
  const progress = focus.totalDuration > 0 ? ((focus.totalDuration - focus.timeRemaining) / focus.totalDuration) * 100 : 0;

  return (
    <Link
      href="/focus"
      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/5 text-xs hover:bg-[var(--accent)]/10 transition-colors"
    >
      <span className={`w-2 h-2 rounded-full ${focus.isRunning ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'}`} />
      <span className="font-mono font-medium text-[var(--accent)]">{timeStr}</span>
      <div className="w-12 h-1 bg-[var(--background)] rounded-full overflow-hidden">
        <div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
      {focus.isBreak && <span className="text-[var(--muted)]">break</span>}
      {focus.isRunning ? (
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); pauseFocus(); }} className="p-0.5 text-[var(--muted)] hover:text-[var(--foreground)]" title="Pause">
          ⏸
        </button>
      ) : (
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); resumeFocus(); }} className="p-0.5 text-[var(--muted)] hover:text-[var(--foreground)]" title="Resume">
          ▶
        </button>
      )}
      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); stopFocus(); }} className="p-0.5 text-[var(--muted)] hover:text-red-400" title="Stop">
        ⏹
      </button>
    </Link>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Treat API 401 responses (expired/cleared session) as a signal to send the
  // user back to the login page.
  useEffect(() => {
    installAuthInterceptor();
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      // Explicit callbackUrl makes sign-out land on /login instead of the
      // current (protected) page, avoiding a redirect chain.
      await signOut({ callbackUrl: '/login' });
    } catch {
      // If the client-side sign-out call fails, fall back to a hard redirect.
      window.location.assign('/login');
    } finally {
      setSigningOut(false);
    }
  };

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
          fixed inset-y-0 left-0 z-30 w-64
          bg-[var(--panel)] border-r border-[var(--border)]
          transform transition-transform duration-200
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:block
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
                onClick={handleSignOut}
                disabled={signingOut}
                className="hover:text-[var(--danger)] transition-colors disabled:opacity-50"
                title="Sign out"
              >
                {signingOut ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <LogOut size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen md:ml-64">
        <header className="md:hidden flex items-center justify-between px-3 py-3 sm:px-4 border-b border-[var(--border)] bg-[var(--panel)]">
          <div className="text-xs sm:text-sm font-bold text-[var(--accent)] tracking-wider truncate">
            $ COMMAND CENTER
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <FocusTimerIndicator />
            <NotificationBell />
            <QueueStatusIndicator />
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>

        {/* Desktop queue status + focus timer indicator (top-right corner) */}
        <div className="hidden md:flex items-center justify-end gap-2 px-8 pt-3 pb-0">
          <FocusTimerIndicator />
          <NotificationBell />
          <QueueStatusIndicator />
        </div>

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          {children}
        </main>
        <FloatingTasks />
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
      <TranscriptionQueueProvider>
        <FocusProvider>
          <AuthSessionGuard>
            <DashboardShell>{children}</DashboardShell>
          </AuthSessionGuard>
        </FocusProvider>
      </TranscriptionQueueProvider>
    </SessionProvider>
  );
}
