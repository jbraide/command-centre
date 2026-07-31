'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Calendar,
  Flag,
  Loader2,
  Square,
  CheckSquare,
  Pencil,
  X,
  Check,
  Grid3x3,
  AlertTriangle,
  Clock,
  Send,
  Trash2,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectInfo {
  id: string;
  name: string;
  color: string;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string;
  completed: boolean;
  sortOrder: number;
  project: ProjectInfo;
}

interface Quadrants {
  do: Task[];
  schedule: Task[];
  delegate: Task[];
  eliminate: Task[];
}

type QuadrantId = 'do' | 'schedule' | 'delegate' | 'eliminate';

// ---------------------------------------------------------------------------
// Quadrant config
// ---------------------------------------------------------------------------

const QUADRANT_CONFIG: Record<
  QuadrantId,
  {
    label: string;
    description: string;
    headerBg: string;
    headerText: string;
    borderColor: string;
    accent: string;
  }
> = {
  do: {
    label: 'Do',
    description: 'Urgent & Important',
    headerBg: 'bg-red-500/15',
    headerText: 'text-red-400',
    borderColor: 'border-red-500/30',
    accent: '#ef4444',
  },
  schedule: {
    label: 'Schedule',
    description: 'Not Urgent & Important',
    headerBg: 'bg-blue-500/15',
    headerText: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    accent: '#3b82f6',
  },
  delegate: {
    label: 'Delegate',
    description: 'Urgent & Not Important',
    headerBg: 'bg-amber-500/15',
    headerText: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    accent: '#f59e0b',
  },
  eliminate: {
    label: 'Eliminate',
    description: 'Not Urgent & Not Important',
    headerBg: 'bg-gray-500/15',
    headerText: 'text-gray-400',
    borderColor: 'border-gray-500/30',
    accent: '#6b7280',
  },
};

const PRIORITY_CONFIG: Record<
  string,
  { text: string; label: string; dot: string }
> = {
  LOW: { text: 'var(--accent)', label: 'Low', dot: '#4ade80' },
  MEDIUM: { text: 'var(--warning)', label: 'Medium', dot: '#fbbf24' },
  HIGH: { text: 'var(--danger)', label: 'High', dot: '#ef4444' },
};

const QUADRANT_ORDER: QuadrantId[] = ['do', 'schedule', 'delegate', 'eliminate'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toISOString().split('T')[0];
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function daysFromNowISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MatrixPage() {
  const [quadrants, setQuadrants] = useState<Quadrants | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const editRef = useRef<HTMLDivElement>(null);

  // ── Fetching ──

  const fetchMatrix = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects/matrix');
      if (!res.ok) throw new Error('Failed to fetch matrix');
      const data = await res.json();
      setQuadrants(data.quadrants);
    } catch {
      toast.error('Failed to load Eisenhower Matrix');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMatrix();
  }, [fetchMatrix]);

  // ── Task update helper ──

  const updateTaskInState = (taskId: string, updates: Partial<Task>) => {
    setQuadrants((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      for (const key of QUADRANT_ORDER) {
        updated[key] = updated[key].map((t) =>
          t.id === taskId ? { ...t, ...updates } : t
        );
      }
      return updated;
    });
  };

  const removeTaskFromState = (taskId: string) => {
    setQuadrants((prev) => {
      if (!prev) return prev;
      const updated = { ...prev };
      for (const key of QUADRANT_ORDER) {
        updated[key] = updated[key].filter((t) => t.id !== taskId);
      }
      return updated;
    });
  };

  // ── Toggle completion ──

  const handleToggleTask = async (task: Task) => {
    const newCompleted = !task.completed;

    // Optimistic
    updateTaskInState(task.id, { completed: newCompleted });

    try {
      const res = await fetch(`/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted }),
      });
      if (!res.ok) throw new Error('Failed to update task');
    } catch {
      updateTaskInState(task.id, { completed: !newCompleted });
      toast.error('Failed to update task');
    }
  };

  // ── Inline editing ──

  const openEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditPriority(task.priority || 'MEDIUM');
    setEditDueDate(toDateInputValue(task.dueDate));
    setEditDescription(task.description || '');
  };

  const closeEdit = () => {
    setEditingTaskId(null);
    setEditTitle('');
    setEditPriority('MEDIUM');
    setEditDueDate('');
    setEditDescription('');
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingTaskId) {
        closeEdit();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [editingTaskId]);

  const handleSaveTask = async (taskId: string) => {
    const title = editTitle.trim();
    if (!title) {
      toast.error('Title is required');
      return;
    }

    const snapshot = { editTitle, editPriority, editDueDate, editDescription };

    // Optimistic
    updateTaskInState(taskId, {
      title,
      priority: editPriority,
      dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
      description: editDescription || null,
    });

    try {
      setSavingTask(true);
      const res = await fetch(`/api/projects/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          priority: editPriority,
          dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
          description: editDescription || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save task');
      closeEdit();
      // Refetch to ensure consistent quadrant assignment
      await fetchMatrix();
    } catch {
      // Revert optimistic
      setEditTitle(snapshot.editTitle);
      updateTaskInState(taskId, {
        title: snapshot.editTitle,
        priority: snapshot.editPriority,
        dueDate: snapshot.editDueDate
          ? new Date(snapshot.editDueDate).toISOString()
          : null,
        description: snapshot.editDescription || null,
      });
      toast.error('Failed to save task');
    } finally {
      setSavingTask(false);
    }
  };

  // ── Drag & Drop ──

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (targetQuadrant: QuadrantId) => {
    if (!draggedTask) return;

    const quadrantConfig = {
      do: { priority: 'HIGH', days: 0 },
      schedule: { priority: 'HIGH', days: 7 },
      delegate: { priority: 'LOW', days: 0 },
      eliminate: { priority: 'LOW', days: 7 },
    };

    const config = quadrantConfig[targetQuadrant];
    const newDueDate = daysFromNowISO(config.days);

    // Remove from current quadrant, add to target quadrant
    const taskSnapshot = { ...draggedTask };
    removeTaskFromState(draggedTask.id);

    const updatedTask: Task = {
      ...draggedTask,
      priority: config.priority,
      dueDate: new Date(newDueDate).toISOString(),
    };

    setQuadrants((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [targetQuadrant]: [...prev[targetQuadrant], updatedTask],
      };
    });

    setDraggedTask(null);

    try {
      const res = await fetch(`/api/projects/tasks/${taskSnapshot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority: config.priority,
          dueDate: new Date(newDueDate).toISOString(),
        }),
      });
      if (!res.ok) throw new Error('Failed to move task');
      // Refetch for consistency
      await fetchMatrix();
    } catch {
      toast.error('Failed to move task');
      await fetchMatrix();
    }
  };

  // ── Total count ──

  const totalTasks = quadrants
    ? QUADRANT_ORDER.reduce((sum, key) => sum + quadrants[key].length, 0)
    : 0;

  // ── Render task card ──

  const renderTaskCard = (task: Task) => {
    const pConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
    const isEditing = editingTaskId === task.id;
    const isOverdue =
      task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;

    return (
      <div
        key={task.id}
        draggable={!isEditing}
        onDragStart={() => handleDragStart(task)}
        className={`
          rounded-lg border bg-[var(--panel)] transition-all cursor-grab active:cursor-grabbing
          ${
            isEditing
              ? 'ring-1 ring-[var(--accent)]/40 border-[var(--accent)]/30 cursor-default'
              : 'hover:shadow-lg hover:shadow-black/20 hover:border-[var(--border)]/60'
          }
        `}
        style={{
          borderLeft: `3px solid ${pConfig.dot}`,
          borderTopLeftRadius: '7px',
          borderBottomLeftRadius: '7px',
        }}
      >
        {/* ── View Mode ── */}
        {!isEditing && (
          <div
            onClick={() => openEdit(task)}
            className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer group"
          >
            {/* Checkbox */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTask(task);
              }}
              className="flex-shrink-0 text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
              title={task.completed ? 'Mark incomplete' : 'Mark complete'}
            >
              {task.completed ? (
                <CheckSquare size={15} className="text-[var(--accent)]" />
              ) : (
                <Square size={15} />
              )}
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <span
                className={`block text-xs font-medium truncate ${
                  task.completed
                    ? 'line-through text-[var(--muted)]'
                    : 'text-[var(--foreground)]'
                }`}
              >
                {task.title}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {/* Project name */}
                <span
                  className="text-[10px] font-medium truncate max-w-[100px]"
                  style={{ color: task.project.color }}
                >
                  {task.project.name}
                </span>

                {/* Priority dot */}
                <span className="inline-flex items-center gap-1 text-[9px] text-[var(--muted)]">
                  <span
                    className="w-1.5 h-1.5 rounded-full inline-block"
                    style={{ backgroundColor: pConfig.dot }}
                  />
                  {pConfig.label}
                </span>

                {/* Due date */}
                {task.dueDate && (
                  <span
                    className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border ${
                      isOverdue
                        ? 'text-red-400 border-red-500/30 bg-red-500/10'
                        : 'text-[var(--muted)] border-[var(--border)] bg-[var(--background)]'
                    }`}
                  >
                    <Calendar size={9} />
                    {formatDateShort(task.dueDate)}
                  </span>
                )}
              </div>
            </div>

            {/* Edit indicator */}
            <Pencil
              size={12}
              className="flex-shrink-0 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        )}

        {/* ── Edit Mode ── */}
        {isEditing && (
          <div ref={editRef} className="px-3 py-2.5 space-y-2.5">
            {/* Close */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider">
                Edit Task
              </span>
              <button
                type="button"
                onClick={closeEdit}
                className="p-0.5 rounded text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Title */}
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
            />

            {/* Priority */}
            <div className="flex items-center gap-1.5">
              <Flag size={11} className="text-[var(--muted)] flex-shrink-0" />
              {['LOW', 'MEDIUM', 'HIGH'].map((p) => {
                const cfg = PRIORITY_CONFIG[p];
                const isSelected = editPriority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditPriority(p)}
                    className={`px-2 py-1 text-[10px] font-medium rounded border transition-all ${
                      isSelected
                        ? 'bg-[var(--panel)] shadow-sm shadow-black/10'
                        : 'bg-transparent text-[var(--muted)] hover:text-[var(--foreground)] border-[var(--border)]'
                    }`}
                    style={
                      isSelected
                        ? {
                            borderColor: `color-mix(in srgb, ${cfg.dot} 60%, transparent)`,
                            backgroundColor: `color-mix(in srgb, ${cfg.dot} 8%, transparent)`,
                            color: cfg.dot,
                          }
                        : {}
                    }
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            {/* Due date */}
            <div className="flex items-center gap-1.5">
              <Calendar size={11} className="text-[var(--muted)] flex-shrink-0" />
              <input
                type="date"
                value={editDueDate}
                onChange={(e) => setEditDueDate(e.target.value)}
                className="px-2 py-1 text-[10px] rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all [color-scheme:dark]"
              />
              {editDueDate && (
                <button
                  type="button"
                  onClick={() => setEditDueDate('')}
                  className="text-[9px] text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Description */}
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all resize-none"
            />

            {/* Actions */}
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={closeEdit}
                className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveTask(task.id)}
                disabled={savingTask || !editTitle.trim()}
                className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingTask ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Check size={11} />
                )}
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Render quadrant ──

  const renderQuadrant = (quadrantId: QuadrantId) => {
    const config = QUADRANT_CONFIG[quadrantId];
    const tasks = quadrants?.[quadrantId] ?? [];
    const isEmpty = tasks.length === 0;

    return (
      <div
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(quadrantId)}
        className={`
          rounded-lg border ${config.borderColor} bg-[var(--panel)]/60
          flex flex-col min-h-0
          transition-all ${draggedTask ? 'ring-1 ring-[var(--accent)]/20' : ''}
        `}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-4 py-2.5 rounded-t-lg ${config.headerBg} border-b ${config.borderColor}`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-bold tracking-wide ${config.headerText}`}
            >
              {config.label}
            </span>
            <span className="text-[10px] text-[var(--muted)] hidden sm:inline">
              {config.description}
            </span>
          </div>
          <span
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${config.headerBg} ${config.headerText}`}
          >
            {tasks.length}
          </span>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[500px]">
          {isEmpty && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="mb-2 opacity-30">
                {quadrantId === 'do' && <AlertTriangle size={24} />}
                {quadrantId === 'schedule' && <Clock size={24} />}
                {quadrantId === 'delegate' && <Send size={24} />}
                {quadrantId === 'eliminate' && <Trash2 size={24} />}
              </div>
              <p className="text-[11px] text-[var(--muted)]">
                {quadrantId === 'do' && 'No urgent tasks'}
                {quadrantId === 'schedule' && 'No scheduled tasks'}
                {quadrantId === 'delegate' && 'No delegate tasks'}
                {quadrantId === 'eliminate' && 'No tasks to eliminate'}
              </p>
              <p className="text-[10px] text-[var(--muted)]/50 mt-0.5">
                Drag tasks here to reassign
              </p>
            </div>
          )}
          {tasks.map(renderTaskCard)}
        </div>
      </div>
    );
  };

  // ── Loading skeleton ──

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="flex items-center gap-3 mb-8">
          <Grid3x3 size={24} className="text-[var(--accent)]" />
          <h1 className="text-2xl font-bold">Eisenhower Matrix</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[calc(100vh-12rem)]">
          {QUADRANT_ORDER.map((key) => (
            <div
              key={key}
              className="rounded-lg border border-[var(--border)] bg-[var(--panel)]/60 animate-pulse"
            >
              <div className="px-4 py-2.5 border-b border-[var(--border)]">
                <div className="h-4 w-24 bg-[var(--border)] rounded" />
              </div>
              <div className="p-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-12 bg-[var(--border)]/50 rounded-lg"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Main render ──

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Grid3x3 size={24} className="text-[var(--accent)]" />
          <h1 className="text-2xl font-bold">Eisenhower Matrix</h1>
          <span className="text-xs text-[var(--muted)] bg-[var(--panel)] border border-[var(--border)] px-2.5 py-1 rounded-full">
            {totalTasks} total tasks
          </span>
        </div>
      </div>

      {/* 2×2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {QUADRANT_ORDER.map((key) => (
          <div key={key} className="flex flex-col">
            {renderQuadrant(key)}
          </div>
        ))}
      </div>
    </div>
  );
}
