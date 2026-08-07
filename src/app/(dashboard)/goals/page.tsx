'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Target,
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  CheckCircle2,
  Archive,
  RotateCcw,
  Calendar,
  ListChecks,
} from 'lucide-react';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Goal {
  id: string;
  name: string;
  description: string | null;
  targetDate: string | null;
  status: string;
  color: string;
  createdAt: string;
  taskCount: number;
  completedTasks: number;
  remainingTasks: number;
}

interface GoalTask {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string | null;
  priority: string;
  projectId: string;
  project: { name: string } | null;
}

const STATUS_BADGES: Record<string, string> = {
  ACTIVE: 'bg-green-500/15 text-green-400 border-green-500/30',
  ACHIEVED: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  ARCHIVED: 'bg-[var(--muted)]/10 text-[var(--muted)] border-[var(--border)]',
};

const PRESET_COLORS = ['#7fd858', '#58d8d8', '#d8a058', '#58a0d8', '#a058d8', '#d85858'];

function formatTargetDate(iso: string | null): string {
  if (!iso) return 'No target date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'No target date';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [goalTasks, setGoalTasks] = useState<Record<string, GoalTask[]>>({});

  /* Form state */
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTargetDate, setFormTargetDate] = useState('');
  const [formColor, setFormColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/goals');
      if (!res.ok) throw new Error('Failed to load goals');
      setGoals(await res.json());
    } catch {
      toast.error('Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const openCreate = () => {
    setEditingId(null);
    setFormName('');
    setFormDescription('');
    setFormTargetDate('');
    setFormColor(PRESET_COLORS[0]);
    setShowForm(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setFormName(goal.name);
    setFormDescription(goal.description ?? '');
    setFormTargetDate(goal.targetDate ? goal.targetDate.slice(0, 10) : '');
    setFormColor(goal.color || PRESET_COLORS[0]);
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        targetDate: formTargetDate ? new Date(formTargetDate + 'T12:00:00').toISOString() : null,
        color: formColor,
      };
      const res = await fetch(editingId ? `/api/goals/${editingId}` : '/api/goals', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to save goal');
      }
      toast.success(editingId ? 'Goal updated' : 'Goal created');
      setShowForm(false);
      fetchGoals();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (goal: Goal, status: string) => {
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update goal');
      fetchGoals();
    } catch {
      toast.error('Failed to update goal');
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete goal');
      setGoals((prev) => prev.filter((g) => g.id !== id));
      setConfirmDeleteId(null);
      toast.success('Goal deleted');
    } catch {
      toast.error('Failed to delete goal');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpand = async (goal: Goal) => {
    if (expandedId === goal.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(goal.id);
    if (!goalTasks[goal.id]) {
      try {
        const res = await fetch(`/api/goals/${goal.id}`);
        if (res.ok) {
          const data = await res.json();
          setGoalTasks((prev) => ({ ...prev, [goal.id]: data.tasks ?? [] }));
        }
      } catch {}
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Target className="text-[var(--accent)]" size={24} />
            Goals
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Track outcomes and tie tasks to them.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          New Goal
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 rounded-sm bg-[var(--panel)] border border-[var(--border)] animate-pulse" />
          ))}
        </div>
      )}

      {/* List */}
      {!loading && goals.length === 0 && (
        <div className="rounded-sm border border-dashed border-[var(--border)] bg-[var(--panel)]/50 p-12 text-center space-y-3">
          <Target size={32} className="mx-auto text-[var(--muted)]" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">No goals yet</h3>
            <p className="text-xs text-[var(--muted)] mt-1">
              Create a goal, then link tasks to it from any project.
            </p>
          </div>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            Create your first goal
          </button>
        </div>
      )}

      {!loading && goals.length > 0 && (
        <div className="space-y-3">
          {goals.map((goal) => {
            const pct =
              goal.taskCount > 0
                ? Math.round((goal.completedTasks / goal.taskCount) * 100)
                : 0;
            return (
              <div
                key={goal.id}
                className="rounded-sm border border-[var(--border)] bg-[var(--panel)] overflow-hidden"
              >
                <div className="p-4 flex items-start gap-3">
                  <div
                    className="h-10 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: goal.color || '#7fd858' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <button
                          onClick={() => toggleExpand(goal)}
                          className="text-left font-semibold text-sm text-[var(--foreground)] hover:underline"
                        >
                          {goal.name}
                        </button>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-medium border ${
                              STATUS_BADGES[goal.status] ?? STATUS_BADGES.ACTIVE
                            }`}
                          >
                            {goal.status.toLowerCase()}
                          </span>
                          {goal.targetDate && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)]">
                              <Calendar size={11} />
                              {formatTargetDate(goal.targetDate)}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)]">
                            <ListChecks size={11} />
                            {goal.completedTasks}/{goal.taskCount} tasks
                          </span>
                        </div>
                        {goal.description && (
                          <p className="text-xs text-[var(--muted)] mt-2 leading-relaxed">
                            {goal.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {goal.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleStatus(goal, 'ACHIEVED')}
                            className="p-1.5 rounded-sm text-[var(--muted)] hover:text-green-400 transition-colors"
                            title="Mark achieved"
                          >
                            <CheckCircle2 size={15} />
                          </button>
                        )}
                        {goal.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleStatus(goal, 'ARCHIVED')}
                            className="p-1.5 rounded-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                            title="Archive"
                          >
                            <Archive size={15} />
                          </button>
                        )}
                        {goal.status !== 'ACTIVE' && (
                          <button
                            onClick={() => handleStatus(goal, 'ACTIVE')}
                            className="p-1.5 rounded-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                            title="Reactivate"
                          >
                            <RotateCcw size={15} />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(goal)}
                          className="p-1.5 rounded-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        {confirmDeleteId === goal.id ? (
                          <button
                            onClick={() => handleDelete(goal.id)}
                            disabled={deletingId === goal.id}
                            className="flex items-center gap-1 px-2 py-1.5 rounded-sm bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors disabled:opacity-50"
                          >
                            {deletingId === goal.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Trash2 size={13} />
                            )}
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(goal.id)}
                            className="p-1.5 rounded-sm text-[var(--muted)] hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-[var(--border)] overflow-hidden rounded-sm">
                        <div
                          className="h-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: goal.color || '#7fd858' }}
                        />
                      </div>
                      <span className="text-[10px] text-[var(--muted)] w-10 text-right shrink-0">
                        {pct}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Linked tasks */}
                {expandedId === goal.id && (
                  <div className="border-t border-[var(--border)] px-4 py-3 bg-[var(--background)]/40">
                    {goalTasks[goal.id] && goalTasks[goal.id].length > 0 ? (
                      <div className="space-y-1.5">
                        {goalTasks[goal.id].map((task) => (
                          <div key={task.id} className="flex items-center gap-2 text-xs">
                            <span
                              className={`shrink-0 ${task.completed ? 'text-green-400' : 'text-[var(--muted)]'}`}
                            >
                              {task.completed ? '✓' : '○'}
                            </span>
                            <Link
                              href={`/projects/${task.projectId}`}
                              className="truncate text-[var(--foreground)] hover:underline"
                            >
                              {task.title}
                            </Link>
                            {task.project && (
                              <span className="shrink-0 text-[var(--muted)] ml-auto truncate max-w-[160px]">
                                {task.project.name}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--muted)]">
                        No tasks linked to this goal yet — assign tasks to goals
                        from the project view.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="w-full max-w-md rounded-sm border border-[var(--border)] bg-[var(--panel)] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                {editingId ? 'Edit Goal' : 'New Goal'}
              </h3>
              <button
                onClick={() => setShowForm(false)}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Launch 10 videos by December"
                  required
                  className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  placeholder="What does success look like?"
                  className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                  Target Date
                </label>
                <input
                  type="date"
                  value={formTargetDate}
                  onChange={(e) => setFormTargetDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
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
                  disabled={saving || !formName.trim()}
                  className="flex items-center gap-2 px-5 py-2 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                  {saving ? 'Saving…' : editingId ? 'Update Goal' : 'Create Goal'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2 rounded-sm border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
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
