'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Flame,
  Loader2,
  CalendarCheck,
} from 'lucide-react';

/* ── Types ────────────────────────────────────── */

interface Habit {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  color: string;
  active: boolean;
  todayDone: boolean;
  streak: number;
  completionRate: number;
}

interface HabitLogEntry {
  date: string;
  completed: boolean;
}

const PRESET_COLORS = ['#7fd858', '#58d8d8', '#d8a058', '#d85858', '#a058d8', '#58a0d8'];

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'weekdays', label: 'Weekdays' },
];

/* ── Helpers ──────────────────────────────────── */

function getShortDay(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2);
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Skeleton ─────────────────────────────────── */

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[var(--border)] ${className}`}
      style={{ opacity: 0.3 }}
    />
  );
}

function HabitCardSkeleton() {
  return (
    <div className="border border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-1 h-12 shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-60" />
          <div className="flex gap-2 mt-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-14" />
          </div>
        </div>
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────── */

export default function HabitsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFrequency, setNewFrequency] = useState('daily');
  const [newColor, setNewColor] = useState('#7fd858');
  const [adding, setAdding] = useState(false);

  // Expanded habit state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logsData, setLogsData] = useState<Record<string, HabitLogEntry[]>>({});
  const [logsLoading, setLogsLoading] = useState<string | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchHabits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/habits');
      if (res.ok) {
        const data = await res.json();
        setHabits(data);
      }
    } catch (err) {
      console.error('Failed to fetch habits:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHabits();
  }, [fetchHabits]);

  /* ── Add Habit ──────────────────────────────── */

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/habits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
          frequency: newFrequency,
          color: newColor,
        }),
      });
      if (res.ok) {
        await fetchHabits();
        setNewName('');
        setNewDescription('');
        setNewFrequency('daily');
        setNewColor('#7fd858');
        setShowAddForm(false);
      }
    } catch (err) {
      console.error('Failed to add habit:', err);
    } finally {
      setAdding(false);
    }
  };

  /* ── Toggle Log ─────────────────────────────── */

  const handleToggle = async (habitId: string) => {
    setActionLoading(habitId);
    try {
      const res = await fetch(`/api/habits/${habitId}/log`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        setHabits((prev) =>
          prev.map((h) =>
            h.id === habitId
              ? { ...h, todayDone: result.completed, streak: result.streak, completionRate: result.completionRate }
              : h
          )
        );
        // Refresh logs if expanded
        if (expandedId === habitId) {
          fetchLogs(habitId);
        }
      }
    } catch (err) {
      console.error('Failed to toggle habit:', err);
    } finally {
      setActionLoading(null);
    }
  };

  /* ── Fetch Logs (for expanded view) ─────────── */

  const fetchLogs = async (habitId: string) => {
    setLogsLoading(habitId);
    try {
      const res = await fetch(`/api/habits/${habitId}/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogsData((prev) => ({ ...prev, [habitId]: data }));
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLogsLoading(null);
    }
  };

  const handleExpand = (habitId: string) => {
    if (expandedId === habitId) {
      setExpandedId(null);
    } else {
      setExpandedId(habitId);
      if (!logsData[habitId]) {
        fetchLogs(habitId);
      }
    }
  };

  /* ── Delete Habit ───────────────────────────── */

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/habits/${deleteId}`, { method: 'DELETE' });
      if (res.ok) {
        setHabits((prev) => prev.filter((h) => h.id !== deleteId));
        if (expandedId === deleteId) setExpandedId(null);
      }
    } catch (err) {
      console.error('Failed to delete habit:', err);
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  };

  /* ── Derived Stats ──────────────────────────── */

  const totalCount = habits.length;
  const todayDoneCount = habits.filter((h) => h.todayDone).length;
  const todayCompletionRate = totalCount > 0 ? Math.round((todayDoneCount / totalCount) * 100) : 0;

  /* ── Loading ────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="space-y-1">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <HabitCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────── */

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ─── Header ──────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarCheck size={20} className="text-[var(--accent)]" />
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            Habits
          </h1>
          {totalCount > 0 && (
            <span className="text-xs text-[var(--muted)] font-medium">
              ({totalCount})
            </span>
          )}
        </div>
        {totalCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-[var(--muted)] mb-3">
            <span>
              Today: {todayDoneCount}/{totalCount} completed
            </span>
            <span className="text-[var(--accent)] font-medium">
              {todayCompletionRate}%
            </span>
          </div>
        )}
        {totalCount > 0 && (
          <div className="h-1.5 bg-[var(--border)] overflow-hidden max-w-xs">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${todayCompletionRate}%` }}
            />
          </div>
        )}
      </div>

      {/* ─── Add Habit ───────────────────────────── */}
      <div className="border border-[var(--border)] bg-[var(--panel)]">
        {showAddForm ? (
          <div className="p-4 space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Habit name..."
              className="w-full bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--muted)]"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Description (optional)..."
              className="w-full bg-[var(--background)] border border-[var(--border)] text-sm text-[var(--foreground)] px-3 py-2 outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--muted)]"
            />
            <div className="flex items-center gap-4 flex-wrap">
              {/* Color picker */}
              <div className="flex items-center gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewColor(c)}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      newColor === c ? 'border-[var(--foreground)] scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              {/* Frequency dropdown */}
              <select
                value={newFrequency}
                onChange={(e) => setNewFrequency(e.target.value)}
                className="bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] px-2 py-1.5 outline-none focus:border-[var(--accent)] transition-colors"
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAdd}
                disabled={adding || !newName.trim()}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 bg-[var(--accent)] text-black hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Add Habit
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewName('');
                  setNewDescription('');
                  setNewFrequency('daily');
                  setNewColor('#7fd858');
                }}
                className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--background)] transition-colors"
          >
            <Plus size={16} />
            Add Habit
          </button>
        )}
      </div>

      {/* ─── Empty State ─────────────────────────── */}
      {habits.length === 0 && (
        <div className="border border-dashed border-[var(--border)] bg-[var(--panel)] p-8 text-center">
          <CalendarCheck size={32} className="mx-auto mb-2 text-[var(--muted)]" />
          <p className="text-sm text-[var(--muted)]">
            No habits yet. Start building a routine!
          </p>
        </div>
      )}

      {/* ─── Habit List ──────────────────────────── */}
      <div className="space-y-2">
        {habits.map((habit) => {
          const isExpanded = expandedId === habit.id;
          const logs = logsData[habit.id] ?? [];
          const last7Days = logs.slice(-7);

          return (
            <div key={habit.id} className="border border-[var(--border)] bg-[var(--panel)]">
              {/* Card header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[var(--background)] transition-colors group"
                onClick={() => handleExpand(habit.id)}
              >
                {/* Color bar */}
                <div
                  className="w-1 h-12 shrink-0 rounded-full"
                  style={{ backgroundColor: habit.color }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--foreground)] truncate">
                      {habit.name}
                    </span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider font-medium text-[var(--muted)] border border-[var(--border)] px-1.5 py-0.5 leading-none">
                      {FREQUENCY_OPTIONS.find((f) => f.value === habit.frequency)?.label ?? habit.frequency}
                    </span>
                  </div>

                  {habit.description && (
                    <p className="text-xs text-[var(--muted)] mt-0.5 truncate">
                      {habit.description}
                    </p>
                  )}

                  <div className="flex items-center gap-3 mt-1.5">
                    {habit.streak > 0 && (
                      <span className="flex items-center gap-1 text-xs text-orange-400 font-medium">
                        <Flame size={12} />
                        {habit.streak} day{habit.streak !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-xs text-[var(--muted)] flex items-center gap-1">
                      <span
                        className="inline-block w-12 h-1.5 bg-[var(--border)] overflow-hidden rounded-full"
                      >
                        <span
                          className="block h-full bg-[var(--accent)] rounded-full transition-all"
                          style={{ width: `${habit.completionRate}%` }}
                        />
                      </span>
                      {habit.completionRate}% last 30d
                    </span>
                  </div>
                </div>

                {/* Checkbox */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(habit.id);
                  }}
                  className="shrink-0"
                >
                  {actionLoading === habit.id ? (
                    <Loader2 size={22} className="text-[var(--muted)] animate-spin" />
                  ) : habit.todayDone ? (
                    <CheckCircle2 size={22} className="text-[var(--accent)]" />
                  ) : (
                    <Circle size={22} className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors" />
                  )}
                </div>

                {/* Delete button */}
                {deleteId === habit.id ? (
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="text-[10px] font-medium px-2 py-1 bg-[var(--danger)] text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {deleting ? <Loader2 size={10} className="animate-spin" /> : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setDeleteId(null)}
                      className="text-[10px] text-[var(--muted)] hover:text-[var(--foreground)] px-1"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteId(habit.id);
                    }}
                    className="shrink-0 text-[var(--muted)] hover:text-[var(--danger)] transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Expanded: Weekly calendar view */}
              {isExpanded && (
                <div className="border-t border-[var(--border)] px-4 py-3 space-y-3">
                  {logsLoading === habit.id ? (
                    <div className="flex justify-center py-2">
                      <Loader2 size={16} className="text-[var(--muted)] animate-spin" />
                    </div>
                  ) : last7Days.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider mb-2">
                        Last 7 Days
                      </p>
                      <div className="flex items-center gap-2">
                        {last7Days.map((entry) => (
                          <div key={entry.date} className="flex flex-col items-center gap-1">
                            <span className="text-[10px] text-[var(--muted)]">{getShortDay(entry.date)}</span>
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                                entry.completed
                                  ? 'bg-[var(--accent)] text-black'
                                  : isToday(entry.date)
                                  ? 'border border-[var(--accent)] text-[var(--muted)]'
                                  : 'bg-[var(--border)] text-[var(--muted)]'
                              }`}
                            >
                              {new Date(entry.date).getDate()}
                            </div>
                            <span className="text-[8px] text-[var(--muted)]">{formatDate(entry.date)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--muted)] italic">
                      No logs yet for this habit.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
