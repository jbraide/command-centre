'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CircleDot,
  ListChecks,
  StickyNote,
  Link2,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  ExternalLink,
  ChevronDown,
  Loader2,
  BookmarkCheck,
  Calendar,
  Pencil,
  X,
  Check,
  Flag,
  type LucideIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Task {
  id: string;
  projectId: string;
  parentId?: string | null;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  priority: string;
  completed: boolean;
  sortOrder: number;
  repeatInterval?: string | null;
  repeatEndDate?: string | null;
  repeatCount?: number | null;
  subtasks?: Task[];
}

interface Note {
  id: string;
  projectId: string;
  content: string;
  createdAt: string;
}

interface SavedTranscription {
  id: string;
  url: string;
  title: string;
  text: string;
  language: string;
}

interface Link {
  id: string;
  projectId: string;
  url: string;
  title?: string | null;
  description?: string | null;
  savedTranscription?: SavedTranscription | null;
}

interface Project {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  status: string;
  tasks: Task[];
  notes: Note[];
  links: Link[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG: Record<
  string,
  { border: string; bg: string; text: string; label: string; dot: string }
> = {
  LOW: {
    border: 'var(--accent)',
    bg: 'rgba(127,216,88,0.08)',
    text: 'var(--accent)',
    label: 'Low',
    dot: '#4ade80',
  },
  MEDIUM: {
    border: 'var(--warning)',
    bg: 'rgba(255,179,71,0.08)',
    text: 'var(--warning)',
    label: 'Medium',
    dot: '#fbbf24',
  },
  HIGH: {
    border: 'var(--danger)',
    bg: 'rgba(255,107,94,0.08)',
    text: 'var(--danger)',
    label: 'High',
    dot: '#ef4444',
  },
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  MEDIUM: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  HIGH: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'text-[var(--accent)] border-[var(--accent)]',
  ARCHIVED: 'text-[var(--muted)] border-[var(--border)]',
  COMPLETED: 'text-blue-400 border-blue-400/40',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
  COMPLETED: 'Completed',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toISOString().split('T')[0];
}

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = 'tasks' | 'notes' | 'links';

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'tasks', label: 'Tasks', icon: ListChecks },
  { id: 'notes', label: 'Notes', icon: StickyNote },
  { id: 'links', label: 'Links', icon: Link2 },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProjectDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  // Data state
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabId>('tasks');

  // Task creation form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('MEDIUM');
  const [addingTask, setAddingTask] = useState(false);

  // Task inline editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [editDueDate, setEditDueDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editRepeatInterval, setEditRepeatInterval] = useState('');
  const [editRepeatEndDate, setEditRepeatEndDate] = useState('');
  const [editRepeatCount, setEditRepeatCount] = useState('');
  const [savingTask, setSavingTask] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);

  // Subtask state
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState<string | null>(null);

  // Note form state
  const [newNoteContent, setNewNoteContent] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Link form state
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  // Saved transcriptions state (for link creation)
  const [transcriptions, setTranscriptions] = useState<SavedTranscription[]>(
    []
  );
  const [transcriptionsOpen, setTranscriptionsOpen] = useState(false);
  const [loadingTranscriptions, setLoadingTranscriptions] = useState(false);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchProject = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${projectId}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error('Project not found');
          router.push('/projects');
          return;
        }
        throw new Error('Failed to fetch project');
      }
      const data: Project = await res.json();
      setProject(data);
    } catch {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  const fetchTranscriptions = useCallback(async () => {
    try {
      setLoadingTranscriptions(true);
      const res = await fetch('/api/transcriptions');
      if (!res.ok) throw new Error('Failed to fetch transcriptions');
      const data: SavedTranscription[] = await res.json();
      setTranscriptions(data);
    } catch {
      toast.error('Failed to load saved transcriptions');
    } finally {
      setLoadingTranscriptions(false);
    }
  }, []);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Hydration-safe: sync hideCompleted from localStorage after mount
  useEffect(() => {
    const stored = localStorage.getItem('hideCompleted');
    if (stored === 'true') {
      setHideCompleted(true);
    }
  }, []);

  // -----------------------------------------------------------------------
  // Task handlers
  // -----------------------------------------------------------------------

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTaskTitle.trim();
    if (!title) return;

    try {
      setAddingTask(true);
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          priority: newTaskPriority,
        }),
      });
      if (!res.ok) throw new Error('Failed to add task');
      const created: Task = await res.json();
      setProject((prev) =>
        prev ? { ...prev, tasks: [...prev.tasks, created] } : prev
      );
      setNewTaskTitle('');
      setNewTaskPriority('MEDIUM');
    } catch {
      toast.error('Failed to add task');
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (task: Task) => {
    const newCompleted = !task.completed;

    // Optimistic update
    setProject((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === task.id ? { ...t, completed: newCompleted } : t
            ),
          }
        : prev
    );

    try {
      const res = await fetch(`/api/projects/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted }),
      });
      if (!res.ok) throw new Error('Failed to update task');

      const data = await res.json();
      // If a new recurring task was created, add it to the list
      if (data.newRecurringTask) {
        setProject((prev) =>
          prev
            ? { ...prev, tasks: [...prev.tasks, data.newRecurringTask] }
            : prev
        );
      }
    } catch {
      // Revert on error
      setProject((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) =>
                t.id === task.id ? { ...t, completed: !newCompleted } : t
              ),
            }
          : prev
      );
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const prevTasks = project?.tasks ?? [];
    // Close edit if deleting the currently edited task
    if (editingTaskId === taskId) closeEdit();

    // Find subtask IDs to also remove from state
    const task = project?.tasks.find(t => t.id === taskId);
    const subtaskIds = task?.subtasks?.map(s => s.id) || [];
    const idsToRemove = new Set([taskId, ...subtaskIds]);

    // Optimistic remove
    setProject((prev) =>
      prev
        ? { ...prev, tasks: prev.tasks.filter((t) => !idsToRemove.has(t.id)) }
        : prev
    );

    try {
      const res = await fetch(`/api/projects/tasks/${taskId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete task');
    } catch {
      // Revert
      setProject((prev) =>
        prev ? { ...prev, tasks: prevTasks } : prev
      );
      toast.error('Failed to delete task');
    }
  };

  // -----------------------------------------------------------------------
  // Inline editing handlers
  // -----------------------------------------------------------------------

  const openEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditPriority(task.priority || 'MEDIUM');
    setEditDueDate(toDateInputValue(task.dueDate));
    setEditDescription(task.description || '');
    setEditRepeatInterval(task.repeatInterval || '');
    setEditRepeatEndDate(toDateInputValue(task.repeatEndDate));
    setEditRepeatCount(task.repeatCount ? String(task.repeatCount) : '');
  };

  const closeEdit = () => {
    setEditingTaskId(null);
    setEditTitle('');
    setEditPriority('MEDIUM');
    setEditDueDate('');
    setEditDescription('');
    setEditRepeatInterval('');
    setEditRepeatEndDate('');
    setEditRepeatCount('');
  };

  // -----------------------------------------------------------------------
  // Subtask handlers
  // -----------------------------------------------------------------------

  const handleAddSubtask = async (parentId: string, title: string) => {
    if (!title.trim()) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), parentId }),
      });
      if (!res.ok) throw new Error('Failed to add subtask');
      const created: Task = await res.json();
      setProject((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) =>
                t.id === parentId
                  ? { ...t, subtasks: [...(t.subtasks || []), created] }
                  : t
              ),
            }
          : prev
      );
      setNewSubtaskTitle('');
      setAddingSubtask(null);
    } catch {
      toast.error('Failed to add subtask');
    }
  };

  const handleToggleSubtask = async (subtask: Task) => {
    const newCompleted = !subtask.completed;
    // Find the parent task so we can update its subtasks array too
    const parentId = project?.tasks.find((t) =>
      t.subtasks?.some((s) => s.id === subtask.id)
    )?.id;

    // Optimistic update — instant, no reload
    setProject((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) => {
              // Update in flat array
              if (t.id === subtask.id) {
                return { ...t, completed: newCompleted };
              }
              // Update in parent's subtasks array
              if (parentId && t.id === parentId && t.subtasks) {
                return {
                  ...t,
                  subtasks: t.subtasks.map((s) =>
                    s.id === subtask.id ? { ...s, completed: newCompleted } : s
                  ),
                };
              }
              return t;
            }),
          }
        : prev
    );

    try {
      const res = await fetch(`/api/projects/tasks/${subtask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted }),
      });
      if (!res.ok) throw new Error('Failed to update subtask');
    } catch {
      // Revert on failure
      setProject((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) => {
                if (t.id === subtask.id) {
                  return { ...t, completed: !newCompleted };
                }
                if (parentId && t.id === parentId && t.subtasks) {
                  return {
                    ...t,
                    subtasks: t.subtasks.map((s) =>
                      s.id === subtask.id ? { ...s, completed: !newCompleted } : s
                    ),
                  };
                }
                return t;
              }),
            }
          : prev
      );
      toast.error('Failed to update subtask');
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    const prevTasks = project?.tasks ?? [];
    // Optimistic remove from parent's subtasks array
    setProject((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.subtasks
                ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
                : t
            ),
          }
        : prev
    );
    try {
      const res = await fetch(`/api/projects/tasks/${subtaskId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete subtask');
    } catch {
      setProject((prev) =>
        prev ? { ...prev, tasks: prevTasks } : prev
      );
      toast.error('Failed to delete subtask');
    }
  };

  const handleSaveTask = async (taskId: string) => {
    const title = editTitle.trim();
    if (!title) {
      toast.error('Title is required');
      return;
    }

    const previousTask = project?.tasks.find((t) => t.id === taskId);
    if (!previousTask) return;

    // Compute repeat fields
    const repeatInterval = editRepeatInterval || null;
    const repeatEndDate = editRepeatEndDate || null;
    const repeatCount = editRepeatCount ? parseInt(editRepeatCount, 10) : null;

    // Optimistic update
    setProject((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === taskId
                ? {
                    ...t,
                    title,
                    priority: editPriority,
                    dueDate: editDueDate
                      ? new Date(editDueDate).toISOString()
                      : null,
                    description: editDescription || null,
                    repeatInterval,
                    repeatEndDate: repeatEndDate
                      ? new Date(repeatEndDate).toISOString()
                      : null,
                    repeatCount,
                  }
                : t
            ),
          }
        : prev
    );

    try {
      setSavingTask(true);
      const res = await fetch(`/api/projects/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          priority: editPriority,
          dueDate: editDueDate
            ? new Date(editDueDate).toISOString()
            : null,
          description: editDescription || null,
          repeatInterval,
          repeatEndDate: repeatEndDate
            ? new Date(repeatEndDate).toISOString()
            : null,
          repeatCount,
        }),
      });
      if (!res.ok) throw new Error('Failed to save task');
      closeEdit();
    } catch {
      // Revert
      setProject((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) =>
                t.id === taskId ? previousTask : t
              ),
            }
          : prev
      );
      toast.error('Failed to save task');
    } finally {
      setSavingTask(false);
    }
  };

  // Close edit on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingTaskId) {
        closeEdit();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [editingTaskId]);

  // -----------------------------------------------------------------------
  // Note handlers
  // -----------------------------------------------------------------------

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newNoteContent.trim();
    if (!content) return;

    try {
      setAddingNote(true);
      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to add note');
      const created: Note = await res.json();
      setProject((prev) =>
        prev ? { ...prev, notes: [created, ...prev.notes] } : prev
      );
      setNewNoteContent('');
    } catch {
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const prevNotes = project?.notes ?? [];
    setProject((prev) =>
      prev
        ? { ...prev, notes: prev.notes.filter((n) => n.id !== noteId) }
        : prev
    );

    try {
      const res = await fetch(`/api/projects/notes/${noteId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete note');
    } catch {
      setProject((prev) =>
        prev ? { ...prev, notes: prevNotes } : prev
      );
      toast.error('Failed to delete note');
    }
  };

  // -----------------------------------------------------------------------
  // Link handlers
  // -----------------------------------------------------------------------

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = newLinkUrl.trim();
    if (!url) return;

    try {
      setAddingLink(true);
      const res = await fetch(`/api/projects/${projectId}/links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title: newLinkTitle.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to add link');
      const created: Link = await res.json();
      setProject((prev) =>
        prev ? { ...prev, links: [created, ...prev.links] } : prev
      );
      setNewLinkUrl('');
      setNewLinkTitle('');
    } catch {
      toast.error('Failed to add link');
    } finally {
      setAddingLink(false);
    }
  };

  const handlePickTranscription = (t: SavedTranscription) => {
    setNewLinkUrl(t.url);
    setNewLinkTitle(t.title);
    setTranscriptionsOpen(false);
  };

  const handleDeleteLink = async (linkId: string) => {
    const prevLinks = project?.links ?? [];
    setProject((prev) =>
      prev
        ? { ...prev, links: prev.links.filter((l) => l.id !== linkId) }
        : prev
    );

    try {
      const res = await fetch(`/api/projects/links/${linkId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete link');
    } catch {
      setProject((prev) =>
        prev ? { ...prev, links: prevLinks } : prev
      );
      toast.error('Failed to delete link');
    }
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

  const tasksCompleted = project
    ? project.tasks.filter((t) => !t.parentId && t.completed).length
    : 0;
  const tasksTotal = project
    ? project.tasks.filter((t) => !t.parentId).length
    : 0;

  const sortedTasks = project
    ? [...project.tasks]
        .filter((t) => !t.parentId)
        .sort((a, b) => {
          // Incomplete first, then by priority
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
        })
        .filter((t) => (hideCompleted ? !t.completed : true))
    : [];

  // Priority button component for reuse
  const PriorityToggle = ({
    value,
    current,
    onChange,
    size = 'sm',
  }: {
    value: string;
    current: string;
    onChange: (v: string) => void;
    size?: 'sm' | 'xs';
  }) => {
    const config = PRIORITY_CONFIG[value];
    const isSelected = current === value;
    const sizeClasses =
      size === 'xs'
        ? 'px-2 py-1 text-[11px]'
        : 'px-3 py-1.5 text-xs';

    return (
      <button
        type="button"
        onClick={() => onChange(value)}
        className={`
          ${sizeClasses} font-medium rounded-md border transition-all
          ${
            isSelected
              ? 'border-[var(--foreground)]/30 text-[var(--foreground)] bg-[var(--panel)] shadow-sm shadow-black/10'
              : 'border-[var(--border)] text-[var(--muted)] bg-transparent hover:text-[var(--foreground)] hover:border-[var(--border)]/60'
          }
        `}
        style={
          isSelected
            ? {
                borderColor: `color-mix(in srgb, ${config.dot} 60%, transparent)`,
                backgroundColor: config.bg,
                color: config.text,
              }
            : {}
        }
      >
        {config.label}
      </button>
    );
  };

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-[var(--muted)]">
        <Loader2 size={32} className="animate-spin mb-3" />
        <p className="text-sm">Loading project...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-[var(--muted)]">
        <p className="text-lg font-medium text-[var(--foreground)] mb-1">
          Project not found
        </p>
        <button
          onClick={() => router.push('/projects')}
          className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen">
      {/* Back button */}
      <button
        onClick={() => router.push('/projects')}
        className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Projects
      </button>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <CircleDot size={22} style={{ color: project.color }} />
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {project.name}
          </h1>
          <span
            className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
              STATUS_STYLES[project.status] || STATUS_STYLES.ACTIVE
            }`}
          >
            {STATUS_LABELS[project.status] || project.status}
          </span>
        </div>
        {project.description && (
          <p className="text-sm text-[var(--muted)] mt-1 ml-0.5">
            {project.description}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all
                ${
                  isActive
                    ? 'border-[var(--accent)] text-[var(--accent)]'
                    : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)] hover:border-[var(--border)]'
                }
              `}
            >
              <Icon size={16} />
              {tab.label}
              {tab.id === 'tasks' && tasksTotal > 0 && (
                <span
                  className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                      : 'bg-[var(--border)] text-[var(--muted)]'
                  }`}
                >
                  {tasksCompleted}/{tasksTotal}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ──────────────── Tab Content ──────────────── */}

      {/* ── Tasks Tab ── */}
      {activeTab === 'tasks' && (
        <div>
          {/* Add Task form */}
          <form
            onSubmit={handleAddTask}
            className="rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 mb-6"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add a new task..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
              />
              <button
                type="submit"
                disabled={addingTask || !newTaskTitle.trim()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingTask ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Add
              </button>
            </div>

            {/* Priority selector */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
              <Flag size={13} className="text-[var(--muted)] flex-shrink-0" />
              <span className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider mr-1">
                Priority
              </span>
              <PriorityToggle
                value="LOW"
                current={newTaskPriority}
                onChange={setNewTaskPriority}
                size="xs"
              />
              <PriorityToggle
                value="MEDIUM"
                current={newTaskPriority}
                onChange={setNewTaskPriority}
                size="xs"
              />
              <PriorityToggle
                value="HIGH"
                current={newTaskPriority}
                onChange={setNewTaskPriority}
                size="xs"
              />
            </div>
          </form>

          {/* Hide completed toggle */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[var(--muted)]">
              {tasksCompleted}/{tasksTotal} tasks completed
            </span>
            <button
              onClick={() => {
                const next = !hideCompleted;
                setHideCompleted(next);
                localStorage.setItem('hideCompleted', String(next));
              }}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                hideCompleted
                  ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                  : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              {hideCompleted ? 'Show completed' : 'Hide completed'}
            </button>
          </div>

          {/* Task list */}
          {sortedTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
              <ListChecks size={40} className="mb-3 opacity-50" />
              <p className="text-sm">No tasks yet. Add one above.</p>
            </div>
          )}

          <div className="space-y-2">
            {sortedTasks.map((task) => {
              const pConfig = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.MEDIUM;
              const isEditing = editingTaskId === task.id;

              return (
                <div
                  key={task.id}
                  className={`
                    rounded-lg border bg-[var(--panel)] transition-all
                    ${isEditing ? 'ring-1 ring-[var(--accent)]/40' : 'hover:shadow-lg hover:shadow-black/20 hover:border-[var(--border)]/60'}
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
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer group"
                    >
                      {/* Checkbox */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTask(task);
                        }}
                        className="flex-shrink-0 text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                        title={
                          task.completed ? 'Mark incomplete' : 'Mark complete'
                        }
                      >
                        {task.completed ? (
                          <CheckSquare
                            size={18}
                            className="text-[var(--accent)]"
                          />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>

                      {/* Title & meta */}
                      <div className="flex-1 min-w-0">
                        <span
                          className={`block text-sm truncate ${
                            task.completed
                              ? 'line-through text-[var(--muted)]'
                              : 'text-[var(--foreground)]'
                          }`}
                        >
                          {task.title}
                        </span>

                        <div className="flex items-center gap-2 mt-1">
                          {/* Priority dot */}
                          <span
                            className="flex items-center gap-1 text-[10px] font-medium"
                            style={{ color: pConfig.text }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full inline-block"
                              style={{ backgroundColor: pConfig.dot }}
                            />
                            {pConfig.label}
                          </span>

                          {/* Due date chip */}
                          {task.dueDate && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)] bg-[var(--background)] px-1.5 py-0.5 rounded border border-[var(--border)]">
                              <Calendar size={10} />
                              {formatDateShort(task.dueDate)}
                            </span>
                          )}

                          {/* Repeat badge */}
                          {task.repeatInterval && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/30">
                              🔄 {task.repeatInterval === 'daily' ? 'Daily' : task.repeatInterval === 'weekdays' ? 'Weekdays' : task.repeatInterval === 'weekly' ? 'Weekly' : task.repeatInterval === 'monthly' ? 'Monthly' : task.repeatInterval === 'yearly' ? 'Yearly' : task.repeatInterval}
                            </span>
                          )}

                          {/* Description indicator */}
                          {task.description && (
                            <span className="text-[10px] text-[var(--muted)]">
                              &middot; has notes
                            </span>
                          )}

                          {/* Subtask count */}
                          {task.subtasks && task.subtasks.length > 0 && (
                            <span className="text-[10px] text-[var(--muted)]">
                              &middot; {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Edit pencil (visible on hover) */}
                      <span className="flex-shrink-0 p-1 rounded text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                        <Pencil size={13} />
                      </span>

                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                        className="flex-shrink-0 p-1 rounded text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-all"
                        title="Delete task"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}

                  {/* ── Edit Mode ── */}
                  {isEditing && (
                    <div ref={editRef} className="px-4 py-3 space-y-3">
                      {/* Close button row */}
                      <div className="flex items-center justify-end -mt-1 -mr-1">
                        <button
                          type="button"
                          onClick={closeEdit}
                          className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-all"
                          title="Close"
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {/* Title input */}
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        placeholder="Task title"
                        autoFocus
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                      />

                      {/* Priority buttons */}
                      <div className="flex items-center gap-2">
                        <Flag
                          size={13}
                          className="text-[var(--muted)] flex-shrink-0"
                        />
                        <span className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider mr-1">
                          Priority
                        </span>
                        <PriorityToggle
                          value="LOW"
                          current={editPriority}
                          onChange={setEditPriority}
                        />
                        <PriorityToggle
                          value="MEDIUM"
                          current={editPriority}
                          onChange={setEditPriority}
                        />
                        <PriorityToggle
                          value="HIGH"
                          current={editPriority}
                          onChange={setEditPriority}
                        />
                      </div>

                      {/* Due date */}
                      <div className="flex items-center gap-2">
                        <Calendar
                          size={13}
                          className="text-[var(--muted)] flex-shrink-0"
                        />
                        <span className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider mr-1">
                          Due
                        </span>
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                          className="px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all [color-scheme:dark]"
                        />
                        {editDueDate && (
                          <button
                            type="button"
                            onClick={() => setEditDueDate('')}
                            className="text-[10px] text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Repeat */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider">
                            Repeat
                          </span>
                          <select
                            value={editRepeatInterval}
                            onChange={(e) => setEditRepeatInterval(e.target.value)}
                            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                          >
                            <option value="">Never</option>
                            <option value="daily">Daily</option>
                            <option value="weekdays">Weekdays</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                          </select>
                        </div>

                        {editRepeatInterval && (
                          <div className="flex items-center gap-3 pl-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-[var(--muted)]">End after</span>
                              <input
                                type="number"
                                min="1"
                                value={editRepeatCount}
                                onChange={(e) => setEditRepeatCount(e.target.value)}
                                placeholder="∞"
                                className="w-16 px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                              />
                              <span className="text-[10px] text-[var(--muted)]">occurrences</span>
                            </div>
                            <span className="text-[10px] text-[var(--muted)]">or</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-[var(--muted)]">End by</span>
                              <input
                                type="date"
                                value={editRepeatEndDate}
                                onChange={(e) => setEditRepeatEndDate(e.target.value)}
                                className="px-2 py-1 text-xs rounded border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all [color-scheme:dark]"
                              />
                              {editRepeatEndDate && (
                                <button
                                  type="button"
                                  onClick={() => setEditRepeatEndDate('')}
                                  className="text-[10px] text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Description */}
                      <div>
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Description (optional)"
                          rows={3}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all resize-none"
                        />
                      </div>

                      {/* ── Subtasks ── */}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <ListChecks size={13} className="text-[var(--muted)] flex-shrink-0" />
                            <span className="text-[11px] font-medium text-[var(--muted)] uppercase tracking-wider">
                              Subtasks — {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                            </span>
                          </div>
                          <div className="space-y-1">
                            {[...task.subtasks]
                              .sort((a, b) => {
                                if (a.completed !== b.completed) return a.completed ? 1 : -1;
                                return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
                              })
                              .map((subtask) => {
                              const subConfig = PRIORITY_CONFIG[subtask.priority] || PRIORITY_CONFIG.MEDIUM;
                              return (
                                <div
                                  key={subtask.id}
                                  className="flex items-center gap-2 py-1.5 px-2 rounded group hover:bg-[var(--background)]/60 transition-colors"
                                >
                                  {/* Subtask checkbox */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleSubtask(subtask);
                                    }}
                                    className="flex-shrink-0 text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                                  >
                                    {subtask.completed ? (
                                      <CheckSquare size={14} className="text-[var(--accent)]" />
                                    ) : (
                                      <Square size={14} />
                                    )}
                                  </button>

                                  {/* Subtask title */}
                                  <span
                                    className={`flex-1 text-sm ${
                                      subtask.completed
                                        ? 'line-through text-[var(--muted)]'
                                        : 'text-[var(--foreground)]'
                                    }`}
                                  >
                                    {subtask.title}
                                  </span>

                                  {/* Subtask delete */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSubtask(subtask.id);
                                    }}
                                    className="flex-shrink-0 p-0.5 rounded text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--danger)] transition-all"
                                    title="Delete subtask"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Add subtask form */}
                      <div>
                        {addingSubtask === task.id ? (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleAddSubtask(task.id, newSubtaskTitle);
                            }}
                            className="flex items-center gap-2"
                          >
                            <button
                              type="button"
                              onClick={() => { setAddingSubtask(null); setNewSubtaskTitle(''); }}
                              className="flex-shrink-0 p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-all"
                              title="Cancel"
                            >
                              <X size={16} />
                            </button>
                            <input
                              type="text"
                              value={newSubtaskTitle}
                              onChange={(e) => setNewSubtaskTitle(e.target.value)}
                              placeholder="New subtask..."
                              autoFocus
                              className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                            />
                            <button
                              type="submit"
                              disabled={!newSubtaskTitle.trim()}
                              className="px-3 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Add
                            </button>
                          </form>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAddingSubtask(task.id)}
                            className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                          >
                            <Plus size={14} />
                            Add subtask
                          </button>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveTask(task.id)}
                          disabled={savingTask || !editTitle.trim()}
                          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingTask ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Check size={14} />
                          )}
                          Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Notes Tab ── */}
      {activeTab === 'notes' && (
        <div>
          {/* Add Note form */}
          <form onSubmit={handleAddNote} className="mb-5">
            <textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Write a note..."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all resize-none"
            />
            <div className="flex justify-end mt-2">
              <button
                type="submit"
                disabled={addingNote || !newNoteContent.trim()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingNote ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Add Note
              </button>
            </div>
          </form>

          {/* Notes list */}
          {project.notes.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
              <StickyNote size={40} className="mb-3 opacity-50" />
              <p className="text-sm">No notes yet.</p>
            </div>
          )}

          <div className="space-y-3">
            {project.notes.map((note) => (
              <div
                key={note.id}
                className="group rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 hover:border-[var(--border)]/80 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap flex-1">
                    {note.content}
                  </p>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="flex-shrink-0 p-1 rounded text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-all"
                    title="Delete note"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)] mt-2">
                  {formatDate(note.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Links Tab ── */}
      {activeTab === 'links' && (
        <div>
          {/* Add Link form */}
          <form onSubmit={handleAddLink} className="mb-5 space-y-3">
            <div className="flex gap-2">
              <input
                type="url"
                value={newLinkUrl}
                onChange={(e) => setNewLinkUrl(e.target.value)}
                placeholder="https://..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
              />
              <button
                type="submit"
                disabled={addingLink || !newLinkUrl.trim()}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addingLink ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                Add
              </button>
            </div>
            <input
              type="text"
              value={newLinkTitle}
              onChange={(e) => setNewLinkTitle(e.target.value)}
              placeholder="Title (optional)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
            />

            {/* From Saved Transcriptions */}
            <div className="border border-[var(--border)] rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (!transcriptionsOpen) fetchTranscriptions();
                  setTranscriptionsOpen(!transcriptionsOpen);
                }}
                className="flex items-center justify-between w-full px-3 py-2 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BookmarkCheck size={14} />
                  <span>From Saved Transcriptions</span>
                </div>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${
                    transcriptionsOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {transcriptionsOpen && (
                <div className="border-t border-[var(--border)] max-h-48 overflow-y-auto">
                  {loadingTranscriptions && (
                    <div className="flex items-center justify-center py-4 text-[var(--muted)]">
                      <Loader2 size={16} className="animate-spin mr-2" />
                      <span className="text-xs">Loading...</span>
                    </div>
                  )}

                  {!loadingTranscriptions &&
                    transcriptions.length === 0 && (
                      <p className="px-3 py-3 text-xs text-[var(--muted)] text-center">
                        No saved transcriptions yet.
                      </p>
                    )}

                  {!loadingTranscriptions &&
                    transcriptions.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handlePickTranscription(t)}
                        className="w-full text-left px-3 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--background)] border-b border-[var(--border)] last:border-b-0 transition-colors"
                      >
                        <span className="block truncate font-medium">
                          {t.title}
                        </span>
                        <span className="block truncate text-[var(--muted)] mt-0.5">
                          {t.url}
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>
          </form>

          {/* Links list */}
          {project.links.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
              <Link2 size={40} className="mb-3 opacity-50" />
              <p className="text-sm">No links yet.</p>
            </div>
          )}

          <div className="space-y-2">
            {project.links.map((link) => (
              <div
                key={link.id}
                className="group rounded-lg border border-[var(--border)] bg-[var(--panel)] p-4 hover:border-[var(--border)]/80 transition-colors hover:shadow-lg hover:shadow-black/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline truncate"
                      >
                        {link.title || link.url}
                        <ExternalLink
                          size={12}
                          className="flex-shrink-0 opacity-70"
                        />
                      </a>
                    </div>

                    {link.description && (
                      <p className="text-xs text-[var(--muted)] mt-1 truncate">
                        {link.description}
                      </p>
                    )}

                    {/* Transcription preview */}
                    {link.savedTranscription && (
                      <div className="mt-2 rounded border border-[var(--border)] bg-[var(--background)] p-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] mb-1">
                          <BookmarkCheck size={12} />
                          {link.savedTranscription.title}
                        </div>
                        <p className="text-xs text-[var(--muted)] line-clamp-2">
                          {link.savedTranscription.text}
                        </p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteLink(link.id)}
                    className="flex-shrink-0 p-1 rounded text-[var(--muted)] opacity-0 group-hover:opacity-100 hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-all"
                    title="Delete link"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
