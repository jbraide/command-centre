'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard,
  Film,
  Key,
  FolderKanban,
  Settings,
  ListChecks,
  Mic,
  Calendar,
  ArrowRight,
  Loader2,
  CircleDot,
  CheckCircle2,
  Clock,
  Bell,
  Timer,
  CalendarCheck,
  Flame,
} from 'lucide-react';

/* ── Types ────────────────────────────────────── */

interface Project {
  id: string;
  name: string;
  color: string | null;
  status: string;
  _count: { tasks: number };
  completedTasks: number;
}

interface Transcription {
  id: string;
  title: string;
  language: string;
  createdAt: string;
  text: string;
}

interface HabitSummary {
  id: string;
  name: string;
  todayDone: boolean;
  streak: number;
}

interface Reminder {
  id: string;
  title: string;
  triggerAt: string;
  note?: string | null;
  fired: boolean;
  task?: { id: string; title: string; projectId: string } | null;
}

interface FocusTodayStats {
  totalSessions: number;
  totalMinutes: number;
  completedPomodoros: number;
}

interface DashboardData {
  projects: Project[];
  transcriptions: Transcription[];
  reminders: Reminder[];
}

/* ── Helpers ──────────────────────────────────── */

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

/* ── Components ───────────────────────────────── */

function StatPill({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] bg-[var(--panel)] border border-[var(--border)] px-3 py-1.5">
      <Icon size={14} className="text-[var(--accent)]" />
      {label}
    </span>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[var(--border)] ${className}`}
      style={{ opacity: 0.3 }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-48" />
        <div className="flex gap-2 mt-3">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-32" />
        </div>
      </div>

      {/* quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>

      {/* rows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-44" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Card Sub-components ──────────────────────── */

function ActiveProjectCard({ project }: { project: Project }) {
  const total = project._count.tasks;
  const done = project.completedTasks;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="block border border-[var(--border)] bg-[var(--background)] p-3 hover:border-[var(--accent)] transition-colors group"
    >
      <div className="flex items-center gap-2 mb-2">
        <CircleDot
          size={12}
          style={{ color: project.color ?? 'var(--accent)' }}
          fill={project.color ?? 'var(--accent)'}
        />
        <span className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors truncate">
          {project.name}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-[var(--muted)] mb-1.5">
        <CheckCircle2 size={12} className="text-[var(--accent)]" />
        <span>
          {done}/{total} tasks
        </span>
        <span className="text-[var(--accent)] font-medium">{pct}%</span>
      </div>

      <div className="h-1.5 bg-[var(--border)] overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  );
}

function TranscriptionCard({ t }: { t: Transcription }) {
  return (
    <Link
      href="/transcriber"
      className="block border border-[var(--border)] bg-[var(--background)] p-3 hover:border-[var(--accent)] transition-colors group"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="text-sm font-medium text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors truncate">
          {t.title || 'Untitled'}
        </span>
        <span className="shrink-0 text-[10px] uppercase tracking-wider font-medium text-[var(--warning)] border border-[var(--warning)]/30 px-1.5 py-0.5 leading-none">
          {t.language}
        </span>
      </div>

      <p className="text-xs text-[var(--muted)] leading-relaxed mb-2">
        {truncate(t.text ?? '', 100)}
      </p>

      <div className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
        <Calendar size={10} />
        {formatDate(t.createdAt)}
      </div>
    </Link>
  );
}

/* ── Main Page ────────────────────────────────── */

export default function DashboardHome() {
  const { data: session } = useSession();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [habits, setHabits] = useState<HabitSummary[]>([]);
  const [focusStats, setFocusStats] = useState<FocusTodayStats | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      fetch('/api/projects').then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch('/api/transcriptions').then((r) =>
        r.ok ? r.json() : Promise.reject(r),
      ),
      fetch('/api/habits').then((r) =>
        r.ok ? r.json() : Promise.reject(r),
      ),
      fetch('/api/reminders?fired=false').then((r) =>
        r.ok ? r.json() : Promise.reject(r),
      ),
      fetch('/api/focus/sessions/today').then((r) =>
        r.ok ? r.json() : Promise.reject(r),
      ),
    ]);

    const projects =
      results[0].status === 'fulfilled' ? results[0].value : [];
    const transcriptions =
      results[1].status === 'fulfilled' ? results[1].value : [];
    const habitsData =
      results[2].status === 'fulfilled' ? results[2].value : [];
    const reminders =
      results[3].status === 'fulfilled' ? results[3].value : [];
    const focusData =
      results[4].status === 'fulfilled' ? results[4].value : null;

    setData({ projects, transcriptions, reminders });
    setHabits(habitsData);
    setFocusStats(focusData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  /* ── Derived stats ──────────────────────────── */

  const activeProjects =
    data?.projects.filter((p) => p.status === 'active') ?? [];
  const totalTasks = data?.projects.reduce(
    (sum, p) => sum + p._count.tasks,
    0,
  );
  const totalTranscriptions = data?.transcriptions.length ?? 0;

  /* ── Loading ────────────────────────────────── */

  if (loading) return <LoadingSkeleton />;

  /* ── Render ─────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* ─── Welcome Header ─────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <LayoutDashboard
            size={20}
            className="text-[var(--accent)]"
          />
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            Welcome back{session?.user?.name ? `, ${session.user.name}` : ''}
          </h1>
        </div>
        <p className="text-xs text-[var(--muted)] mb-3">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>

        <div className="flex flex-wrap gap-2">
          <StatPill
            icon={FolderKanban}
            label={`${activeProjects.length} project${activeProjects.length !== 1 ? 's' : ''} active`}
          />
          <StatPill
            icon={ListChecks}
            label={`${totalTasks} task${totalTasks !== 1 ? 's' : ''} total`}
          />
          <StatPill
            icon={Mic}
            label={`${totalTranscriptions} transcription${totalTranscriptions !== 1 ? 's' : ''} saved`}
          />
          {focusStats && focusStats.totalSessions > 0 && (
            <StatPill
              icon={Timer}
              label={`Today&apos;s focus: ${focusStats.totalMinutes >= 60 ? `${Math.floor(focusStats.totalMinutes / 60)}h ${focusStats.totalMinutes % 60}m` : `${focusStats.totalMinutes}m`} · ${focusStats.completedPomodoros} pomodoro${focusStats.completedPomodoros !== 1 ? 's' : ''}`}
            />
          )}
        </div>
      </div>

      {/* ─── Habits Widget ────────────────────────── */}
      {habits.length > 0 && (
        <Link
          href="/habits"
          className="border border-[var(--border)] bg-[var(--panel)] p-4 hover:border-[var(--accent)] transition-colors group block"
        >
          <div className="flex items-center gap-3 mb-2">
            <CalendarCheck size={18} className="text-[var(--accent)]" />
            <span className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
              Today&apos;s Habits
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)] mb-1.5">
            {habits.filter((h: HabitSummary) => h.todayDone).length}/{habits.length} completed
            <span className="text-[var(--accent)] font-medium">
              {Math.round((habits.filter((h: HabitSummary) => h.todayDone).length / habits.length) * 100)}%
            </span>
          </div>
          <div className="h-1.5 bg-[var(--border)] overflow-hidden">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${Math.round((habits.filter((h: HabitSummary) => h.todayDone).length / habits.length) * 100)}%` }}
            />
          </div>
          {habits.some((h: HabitSummary) => h.streak > 0) && (
            <div className="flex items-center gap-2 mt-2">
              {habits.filter((h: HabitSummary) => h.streak > 0).slice(0, 3).map((h: HabitSummary) => (
                <span key={h.id} className="flex items-center gap-1 text-[10px] text-orange-400">
                  <Flame size={10} />
                  {h.streak}d
                </span>
              ))}
            </div>
          )}
        </Link>
      )}

      {/* ─── Quick Actions ──────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            href: '/transcriber',
            label: 'Transcribe Reel',
            icon: Film,
            color: 'text-[var(--accent)]',
            desc: 'From URL to transcript',
          },
          {
            href: '/passwords',
            label: 'Password Vault',
            icon: Key,
            color: 'text-[var(--warning)]',
            desc: 'Encrypted credentials',
          },
          {
            href: '/projects',
            label: 'Projects',
            icon: FolderKanban,
            color: 'text-purple-400',
            desc: 'Manage your work',
          },
          {
            href: '/settings',
            label: 'Settings',
            icon: Settings,
            color: 'text-[var(--muted)]',
            desc: 'Preferences & account',
          },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="group border border-[var(--border)] bg-[var(--panel)] p-4 hover:border-[var(--accent)] transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className={`${action.color} mt-0.5`}>
                  <Icon size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                    {action.label}
                  </h3>
                  <p className="text-xs text-[var(--muted)] mt-0.5">
                    {action.desc}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* ─── Two-column content rows ────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Projects */}
        <div className="border border-[var(--border)] bg-[var(--panel)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-1.5">
              <FolderKanban size={15} className="text-[var(--accent)]" />
              Active Projects
            </h2>
            <Link
              href="/projects"
              className="text-xs text-[var(--accent)] hover:underline flex items-center gap-0.5"
            >
              View all
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="space-y-2">
            {activeProjects.length === 0 ? (
              <p className="text-xs text-[var(--muted)] italic">
                No active projects yet.
              </p>
            ) : (
              activeProjects.slice(0, 3).map((p) => (
                <ActiveProjectCard key={p.id} project={p} />
              ))
            )}
          </div>
        </div>

        {/* Recent Transcriptions */}
        <div className="border border-[var(--border)] bg-[var(--panel)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-1.5">
              <Mic size={15} className="text-[var(--accent)]" />
              Recent Transcriptions
            </h2>
            <Link
              href="/transcriber"
              className="text-xs text-[var(--accent)] hover:underline flex items-center gap-0.5"
            >
              View all
              <ArrowRight size={12} />
            </Link>
          </div>

          <div className="space-y-2">
            {(data?.transcriptions ?? []).length === 0 ? (
              <p className="text-xs text-[var(--muted)] italic">
                No transcriptions yet.
              </p>
            ) : (
              (data?.transcriptions ?? [])
                .slice(0, 3)
                .map((t) => <TranscriptionCard key={t.id} t={t} />)
            )}
          </div>
        </div>
      </div>

      {/* ─── Upcoming Reminders ───────────────── */}
      {data?.reminders && data.reminders.length > 0 && (
        <div className="border border-[var(--border)] bg-[var(--panel)] p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)] flex items-center gap-1.5">
              <Bell size={15} className="text-[var(--accent)]" />
              Upcoming
            </h2>
          </div>

          <div className="space-y-2">
            {data.reminders.slice(0, 3).map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 border border-[var(--border)] bg-[var(--background)] p-3"
              >
                <Bell size={14} className="text-[var(--warning)] mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate">
                    {r.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-[var(--muted)] flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(r.triggerAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </span>
                    {r.task && (
                      <span className="text-[10px] text-[var(--accent)] truncate">
                        · {r.task.title}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Error banner (if anything failed) ──── */}
      {/* This silently handles partial data; if we want to surface the banner
          we could track per-endpoint failures. For now the user sees partial data. */}
    </div>
  );
}
