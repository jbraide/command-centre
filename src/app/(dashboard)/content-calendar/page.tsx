'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarRange,
  Plus,
  X,
  Loader2,
  CalendarClock,
  SquarePen,
  CalendarX,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CalendarGrid,
  toDateKey,
  type CalendarItem,
} from '@/components/calendar-grid';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Script {
  id: string;
  title: string;
  scheduledFor: string | null;
  persona: { colorTag: string } | null;
  project: { id: string; name: string } | null;
}

const DEFAULT_COLOR = '#7fd858';

function formatDay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ContentCalendarPage() {
  const [month, setMonth] = useState(() => new Date());
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);

  /* Modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [formScriptId, setFormScriptId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchScripts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/scripts');
      if (!res.ok) throw new Error('Failed to load scripts');
      setScripts(await res.json());
    } catch {
      toast.error('Failed to load scripts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const scheduled = useMemo(
    () => scripts.filter((s) => s.scheduledFor),
    [scripts]
  );
  const unscheduled = useMemo(
    () => scripts.filter((s) => !s.scheduledFor),
    [scripts]
  );

  const items: CalendarItem[] = useMemo(
    () =>
      scheduled.map((s) => ({
        id: s.id,
        date: toDateKey(new Date(s.scheduledFor!)),
        color: s.persona?.colorTag || DEFAULT_COLOR,
        title: s.title,
      })),
    [scheduled]
  );

  const openSchedule = (scriptId?: string, dateKey?: string) => {
    const script = scriptId
      ? scripts.find((s) => s.id === scriptId)
      : undefined;
    setFormScriptId(script?.id ?? '');
    setFormDate(dateKey ?? toDateKey(new Date()));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formScriptId || !formDate) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/scripts/${formScriptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduledFor: new Date(`${formDate}T12:00:00`).toISOString(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to schedule script');
      }
      toast.success('Content scheduled');
      setModalOpen(false);
      fetchScripts();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule script');
    } finally {
      setSaving(false);
    }
  };

  const handleUnschedule = async (scriptId: string) => {
    try {
      const res = await fetch(`/api/scripts/${scriptId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledFor: null }),
      });
      if (!res.ok) throw new Error('Failed to unschedule');
      toast.success('Removed from calendar');
      fetchScripts();
    } catch {
      toast.error('Failed to unschedule');
    }
  };

  const selectedScript = scripts.find((s) => s.id === formScriptId);

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <CalendarRange className="text-[var(--accent)]" size={24} />
            Content Calendar
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Plan when your scripts and content go live.
          </p>
        </div>
        <button
          onClick={() => openSchedule(undefined, toDateKey(new Date()))}
          disabled={scripts.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Plus size={16} />
          Schedule Content
        </button>
      </div>

      {loading ? (
        <div className="h-96 rounded-sm bg-[var(--panel)] border border-[var(--border)] animate-pulse" />
      ) : (
        <div className="rounded-sm border border-[var(--border)] bg-[var(--panel)] p-4">
          <CalendarGrid
            month={month}
            onMonthChange={setMonth}
            items={items}
            onDayClick={(dateKey) => openSchedule(undefined, dateKey)}
          />
        </div>
      )}

      {/* Unscheduled scripts */}
      {!loading && (
        <div className="rounded-sm border border-[var(--border)] bg-[var(--panel)] p-5 space-y-3">
          <div className="flex items-center gap-2">
            <SquarePen size={18} className="text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Unscheduled Content ({unscheduled.length})
            </h3>
          </div>

          {unscheduled.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">
              Everything is scheduled — or you have no scripts yet.{' '}
              <Link href="/scripts" className="text-[var(--accent)] hover:underline">
                Write a script
              </Link>{' '}
              to plan it here.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {unscheduled.map((script) => (
                <div
                  key={script.id}
                  className="flex items-center gap-2 p-2.5 rounded-sm border border-[var(--border)] bg-[var(--background)]"
                >
                  <span
                    className="h-6 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: script.persona?.colorTag || DEFAULT_COLOR }}
                  />
                  <p className="flex-1 min-w-0 text-xs text-[var(--foreground)] truncate">
                    {script.title}
                    {script.project && (
                      <span className="text-[var(--muted)]"> · {script.project.name}</span>
                    )}
                  </p>
                  <button
                    onClick={() => openSchedule(script.id, toDateKey(new Date()))}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm border border-[var(--border)] text-[10px] font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--accent)] transition-colors shrink-0"
                  >
                    <CalendarClock size={12} />
                    Schedule
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Schedule modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md rounded-sm border border-[var(--border)] bg-[var(--panel)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Schedule Content
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                  Script <span className="text-red-400">*</span>
                </label>
                <select
                  value={formScriptId}
                  onChange={(e) => setFormScriptId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                >
                  <option value="" disabled>
                    Select a script…
                  </option>
                  {scripts.map((script) => (
                    <option key={script.id} value={script.id}>
                      {script.title}
                      {script.scheduledFor ? ' (scheduled)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                  Publish Date <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving || !formScriptId || !formDate}
                  className="flex items-center gap-2 px-5 py-2 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                  {saving ? 'Scheduling…' : 'Schedule'}
                </button>
                {selectedScript?.scheduledFor && (
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      handleUnschedule(selectedScript.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-sm bg-red-500/15 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors"
                  >
                    <CalendarX size={14} />
                    Unschedule
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-5 py-2 rounded-sm border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors ml-auto"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
