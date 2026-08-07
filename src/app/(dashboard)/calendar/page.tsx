'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  X,
  Loader2,
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

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start: string;
  end: string | null;
  allDay: boolean;
  color: string;
}

const PRESET_COLORS = ['#7fd858', '#58d8d8', '#d8a058', '#58a0d8', '#a058d8', '#d85858'];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function CalendarPage() {
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  /* Modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formAllDay, setFormAllDay] = useState(true);
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const range = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 41);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [month]);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/calendar-events?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`
      );
      if (!res.ok) throw new Error('Failed to load events');
      setEvents(await res.json());
    } catch {
      toast.error('Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const items: CalendarItem[] = useMemo(
    () =>
      events.map((e) => {
        const d = new Date(e.start);
        return {
          id: e.id,
          date: toDateKey(d),
          color: e.color || '#7fd858',
          title: e.allDay ? e.title : `${formatTime(e.start)} ${e.title}`,
          allDay: e.allDay,
        };
      }),
    [events]
  );

  const openCreate = (dateKey?: string) => {
    setEditingId(null);
    setFormTitle('');
    setFormDescription('');
    setFormDate(dateKey ?? toDateKey(new Date()));
    setFormTime('');
    setFormAllDay(true);
    setFormColor(PRESET_COLORS[0]);
    setModalOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setEditingId(event.id);
    setFormTitle(event.title);
    setFormDescription(event.description ?? '');
    setFormDate(toDateKey(new Date(event.start)));
    setFormTime(event.allDay ? '' : formatTime(event.start));
    setFormAllDay(event.allDay);
    setFormColor(event.color || PRESET_COLORS[0]);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formDate) return;

    let start: string;
    if (formAllDay) {
      start = new Date(`${formDate}T12:00:00`).toISOString();
    } else {
      const time = formTime || '09:00';
      start = new Date(`${formDate}T${time}`).toISOString();
    }

    setSaving(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        start,
        allDay: formAllDay,
        color: formColor,
      };
      const res = await fetch(
        editingId ? `/api/calendar-events/${editingId}` : '/api/calendar-events',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to save event');
      }
      toast.success(editingId ? 'Event updated' : 'Event created');
      setModalOpen(false);
      fetchEvents();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/calendar-events/${editingId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete event');
      toast.success('Event deleted');
      setModalOpen(false);
      fetchEvents();
    } catch {
      toast.error('Failed to delete event');
    } finally {
      setDeleting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <CalendarIcon className="text-[var(--accent)]" size={24} />
            Calendar
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Your personal schedule — events, plans, and reminders.
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          New Event
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
            onDayClick={(dateKey) => openCreate(dateKey)}
          />
        </div>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md rounded-sm border border-[var(--border)] bg-[var(--panel)] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {editingId ? 'Edit Event' : 'New Event'}
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
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Team sync, Gym, Deadline"
                  required
                  className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setFormAllDay(true)}
                  className={`flex-1 px-3 py-2 rounded-sm text-xs font-medium border transition-colors ${
                    formAllDay
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--muted)]'
                  }`}
                >
                  All day
                </button>
                <button
                  type="button"
                  onClick={() => setFormAllDay(false)}
                  className={`flex-1 px-3 py-2 rounded-sm text-xs font-medium border transition-colors ${
                    !formAllDay
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--muted)]'
                  }`}
                >
                  Timed
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                    Date <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
                {!formAllDay && (
                  <div>
                    <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                      Time
                    </label>
                    <input
                      type="time"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFormColor(color)}
                      className={`h-7 w-7 rounded-sm transition-transform ${
                        formColor === color ? 'ring-2 ring-[var(--foreground)] scale-110' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving || !formTitle.trim() || !formDate}
                  className="flex items-center gap-2 px-5 py-2 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                  {saving ? 'Saving…' : editingId ? 'Update Event' : 'Create Event'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-sm bg-red-500/15 text-red-400 text-sm font-medium hover:bg-red-500/25 transition-colors disabled:opacity-50 ml-auto"
                  >
                    {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    Delete
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
