'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lightbulb,
  Plus,
  Loader2,
  Sparkles,
  Send,
  Archive,
  Trash2,
  X,
  CheckCircle2,
  FolderKanban,
  SquarePen,
  Hash,
  Calendar,
  ChevronDown,
  MoreHorizontal,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

/* ── Types ────────────────────────────────────── */

interface Project {
  id: string;
  name: string;
}

interface Script {
  id: string;
  title: string;
}

interface Idea {
  id: string;
  title: string;
  rawNotes: string | null;
  tags: string | null; // JSON string array
  status: string;
  linkedProjectId: string | null;
  linkedScriptId: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string } | null;
  script: { id: string; title: string } | null;
}

/* ── Helpers ──────────────────────────────────── */

function parseTags(tagsStr: string | null): string[] {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  raw: { label: 'Raw', classes: 'text-green-400 border-green-400/30 bg-green-400/10' },
  promoted: { label: 'Promoted', classes: 'text-blue-400 border-blue-400/30 bg-blue-400/10' },
  archived: { label: 'Archived', classes: 'text-[var(--muted)] border-[var(--border)] bg-[var(--border)]/20' },
};

/* ── Skeleton Component ───────────────────────── */

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-[var(--border)] ${className}`}
      style={{ opacity: 0.3 }}
    />
  );
}

function CardSkeleton() {
  return (
    <div className="border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
      <div className="flex items-start justify-between">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="flex items-center justify-between pt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-28" />
      </div>
    </div>
  );
}

/* ── Confirm Dialog ───────────────────────────── */

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  confirmDanger = false,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmDanger?: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-full bg-red-400/10">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--foreground)]">
            {title}
          </h3>
        </div>
        <p className="text-sm text-[var(--muted)] mb-6">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              confirmDanger
                ? 'bg-red-500 text-white hover:brightness-110'
                : 'bg-[var(--accent)] text-[var(--background)] hover:brightness-110'
            }`}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Promote Dialog ───────────────────────────── */

function PromoteDialog({
  open,
  loading,
  projects,
  selectedProjectId,
  newProjectName,
  onSelectProject,
  onNewProjectNameChange,
  onCreateNew,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  loading: boolean;
  projects: Project[];
  selectedProjectId: string;
  newProjectName: string;
  onSelectProject: (id: string) => void;
  onNewProjectNameChange: (name: string) => void;
  onCreateNew: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  const isNewProject = selectedProjectId === '__new__';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl">
        <div className="flex items-center justify-between px-6 pt-6 pb-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Promote to Project
          </h2>
          <button
            onClick={onCancel}
            className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Existing projects list */}
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
              Link to existing project
            </label>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-all ${
                    selectedProjectId === p.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FolderKanban size={14} className="shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-[var(--border)]" />
            <span className="text-xs text-[var(--muted)] font-medium">OR</span>
            <div className="flex-1 h-px bg-[var(--border)]" />
          </div>

          {/* New project option */}
          <div>
            <button
              onClick={onCreateNew}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border transition-all ${
                isNewProject
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--foreground)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]'
              }`}
            >
              <Plus size={14} />
              <span>New Project</span>
            </button>
            {isNewProject && (
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => onNewProjectNameChange(e.target.value)}
                placeholder="Enter project name..."
                className="mt-2 w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                autoFocus
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || (isNewProject && !newProjectName.trim())}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {isNewProject ? 'Create & Promote' : 'Promote'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Idea Card ────────────────────────────────── */

function IdeaCard({
  idea,
  onPromote,
  onSendToScript,
  onArchive,
  onDelete,
}: {
  idea: Idea;
  onPromote: (idea: Idea) => void;
  onSendToScript: (idea: Idea) => void;
  onArchive: (idea: Idea) => void;
  onDelete: (idea: Idea) => void;
}) {
  const tags = parseTags(idea.tags);
  const statusCfg = STATUS_CONFIG[idea.status] || STATUS_CONFIG.raw;

  return (
    <div className="border border-[var(--border)] bg-[var(--background)] p-4 hover:border-[var(--accent)]/50 transition-colors group">
      {/* Title + Status badge */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-[var(--foreground)] leading-snug">
          {idea.title}
        </h3>
        <span
          className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusCfg.classes}`}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* Raw notes preview */}
      {idea.rawNotes && (
        <p className="text-xs text-[var(--muted)] leading-relaxed line-clamp-2 mb-2">
          {idea.rawNotes}
        </p>
      )}

      {/* Linked project/script indicator */}
      {(idea.project || idea.script) && (
        <div className="flex items-center gap-3 mb-2">
          {idea.project && (
            <span className="inline-flex items-center gap-1 text-[10px] text-blue-400/70">
              <FolderKanban size={10} />
              {idea.project.name}
            </span>
          )}
          {idea.script && (
            <span className="inline-flex items-center gap-1 text-[10px] text-purple-400/70">
              <SquarePen size={10} />
              {idea.script.title}
            </span>
          )}
        </div>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full"
            >
              <Hash size={8} />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Bottom row: date + actions */}
      <div className="flex items-center justify-between pt-1">
        <span className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)]">
          <Calendar size={10} />
          {formatDate(idea.createdAt)}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {idea.status === 'raw' && (
            <>
              <button
                onClick={() => onPromote(idea)}
                className="p-1.5 rounded-md text-[var(--muted)] hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                title="Promote to Project"
              >
                <FolderKanban size={14} />
              </button>
              <button
                onClick={() => onSendToScript(idea)}
                className="p-1.5 rounded-md text-[var(--muted)] hover:text-purple-400 hover:bg-purple-400/10 transition-colors"
                title="Send to Script Writer"
              >
                <Send size={14} />
              </button>
              <button
                onClick={() => onArchive(idea)}
                className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
                title="Archive"
              >
                <Archive size={14} />
              </button>
            </>
          )}
          <button
            onClick={() => onDelete(idea)}
            className="p-1.5 rounded-md text-[var(--muted)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────── */

export default function IdeasPage() {
  const router = useRouter();
  const quickAddRef = useRef<HTMLInputElement>(null);

  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');

  // Quick-add
  const [quickTitle, setQuickTitle] = useState('');
  const [quickTags, setQuickTags] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);

  // Promote dialog
  const [promoteIdea, setPromoteIdea] = useState<Idea | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [promoting, setPromoting] = useState(false);

  // Delete confirm
  const [deleteIdea, setDeleteIdea] = useState<Idea | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Derived data ──────────────────────────────

  const allTags = Array.from(
    new Set(ideas.flatMap((idea) => parseTags(idea.tags)))
  ).sort();

  const filteredIdeas = ideas.filter((idea) => {
    if (statusFilter !== 'all' && idea.status !== statusFilter) return false;
    if (tagFilter !== 'all') {
      const ideaTags = parseTags(idea.tags);
      if (!ideaTags.includes(tagFilter)) return false;
    }
    return true;
  });

  const rawCount = ideas.filter((i) => i.status === 'raw').length;

  // ── Data fetching ─────────────────────────────

  const fetchIdeas = useCallback(async () => {
    try {
      const res = await fetch('/api/ideas');
      if (!res.ok) throw new Error('Failed to fetch ideas');
      const data = await res.json();
      setIdeas(data);
    } catch {
      toast.error('Failed to load ideas');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) return;
      const data = await res.json();
      setProjects(data);
    } catch {
      // Silently fail — projects are secondary
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchIdeas(), fetchProjects()]);
  }, [fetchIdeas, fetchProjects]);

  // ── Quick-add handler ─────────────────────────

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      setQuickAdding(true);
      const res = await fetch('/api/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: quickTitle.trim(),
          tags: quickTags.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create idea');
      }

      toast.success('Idea captured');
      setQuickTitle('');
      setQuickTags('');
      await fetchIdeas();
      quickAddRef.current?.focus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create idea');
    } finally {
      setQuickAdding(false);
    }
  };

  // ── Promote handler ───────────────────────────

  const handlePromoteOpen = (idea: Idea) => {
    setPromoteIdea(idea);
    setSelectedProjectId('');
    setNewProjectName('');
  };

  const handlePromoteConfirm = async () => {
    if (!promoteIdea) return;

    const isNewProject = selectedProjectId === '__new__';
    let projectId = selectedProjectId;

    try {
      setPromoting(true);

      // Create project if new
      if (isNewProject) {
        if (!newProjectName.trim()) {
          toast.error('Project name is required');
          return;
        }
        const createRes = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newProjectName.trim() }),
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          throw new Error(err.error || 'Failed to create project');
        }
        const newProject = await createRes.json();
        projectId = newProject.id;
      }

      if (!projectId) {
        toast.error('Please select or create a project');
        return;
      }

      // Update idea: link to project and mark as promoted
      const res = await fetch(`/api/ideas/${promoteIdea.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'promoted',
          linkedProjectId: projectId,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to promote idea');
      }

      toast.success('Idea promoted to project');
      setPromoteIdea(null);
      await Promise.all([fetchIdeas(), fetchProjects()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to promote idea');
    } finally {
      setPromoting(false);
    }
  };

  // ── Send to Script handler ────────────────────

  const handleSendToScript = (idea: Idea) => {
    // Navigate to /scripts with idea content pre-filled via query params
    const params = new URLSearchParams();
    params.set('new', 'true');
    params.set('title', idea.title);
    if (idea.rawNotes) params.set('content', idea.rawNotes);
    const tags = parseTags(idea.tags);
    if (tags.length > 0) params.set('tags', tags.join(', '));
    router.push(`/scripts?${params.toString()}`);
  };

  // ── Archive handler ───────────────────────────

  const handleArchive = async (idea: Idea) => {
    // Optimistic update
    setIdeas((prev) =>
      prev.map((i) => (i.id === idea.id ? { ...i, status: 'archived' } : i))
    );

    try {
      const res = await fetch(`/api/ideas/${idea.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to archive idea');
      }

      toast.success('Idea archived');
    } catch (err) {
      // Revert optimistic update
      setIdeas((prev) =>
        prev.map((i) => (i.id === idea.id ? { ...i, status: idea.status } : i))
      );
      toast.error(err instanceof Error ? err.message : 'Failed to archive');
    }
  };

  // ── Delete handler ────────────────────────────

  const handleDeleteConfirm = async () => {
    if (!deleteIdea) return;

    // Optimistic removal
    setIdeas((prev) => prev.filter((i) => i.id !== deleteIdea.id));

    try {
      setDeleting(true);
      const res = await fetch(`/api/ideas/${deleteIdea.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete idea');
      }

      toast.success('Idea deleted');
      setDeleteIdea(null);
    } catch (err) {
      // Revert — refetch to be safe
      await fetchIdeas();
      toast.error(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  // ── Loading state ─────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          {/* Quick-add skeleton */}
          <Skeleton className="h-12 w-full" />
          {/* Filter skeleton */}
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-28" />
          </div>
          {/* Cards */}
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-3xl mx-auto">
        {/* ── Header ──────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb size={22} className="text-[var(--accent)]" />
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              Idea Hub
            </h1>
          </div>
          <p className="text-sm text-[var(--muted)]">
            {rawCount} raw idea{rawCount !== 1 ? 's' : ''} · {ideas.length} total
          </p>
        </div>

        {/* ── Quick-add bar ───────────────────────── */}
        <form
          onSubmit={handleQuickAdd}
          className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-[var(--background)] border-b border-[var(--border)] mb-6"
        >
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 border border-[var(--border)] bg-[var(--panel)] px-3 py-2 focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)] transition-all">
              <Sparkles size={16} className="text-[var(--accent)] shrink-0" />
              <input
                ref={quickAddRef}
                type="text"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="What's your idea?"
                className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none"
              />
            </div>
            <input
              type="text"
              value={quickTags}
              onChange={(e) => setQuickTags(e.target.value)}
              placeholder="Tags (comma-separated)"
              className="w-48 px-3 py-2 text-sm border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition-all hidden sm:block"
            />
            <button
              type="submit"
              disabled={quickAdding || !quickTitle.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {quickAdding ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              <span className="hidden sm:inline">Add</span>
            </button>
          </div>
        </form>

        {/* ── Filter bar ──────────────────────────── */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {/* Status filter */}
          <div className="flex items-center gap-1">
            {['all', 'raw', 'promoted', 'archived'].map((s) => {
              const label =
                s === 'all'
                  ? 'All'
                  : s.charAt(0).toUpperCase() + s.slice(1);
              const isActive = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                    isActive
                      ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]'
                      : 'text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)] hover:bg-[var(--panel)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <div className="flex items-center gap-1 ml-2 pl-2 border-l border-[var(--border)]">
              <button
                onClick={() => setTagFilter('all')}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  tagFilter === 'all'
                    ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]'
                    : 'text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)] hover:bg-[var(--panel)]'
                }`}
              >
                All Tags
              </button>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tag)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                    tagFilter === tag
                      ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]'
                      : 'text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)] hover:bg-[var(--panel)]'
                  }`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Empty state ─────────────────────────── */}
        {filteredIdeas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
            <Lightbulb size={48} className="mb-4 opacity-30" />
            <p className="text-lg font-medium text-[var(--foreground)] mb-1">
              {ideas.length === 0
                ? 'No ideas yet'
                : 'No ideas match your filters'}
            </p>
            <p className="text-sm mb-6">
              {ideas.length === 0
                ? 'Capture your first idea above.'
                : 'Try adjusting your filters.'}
            </p>
            {ideas.length === 0 && (
              <button
                onClick={() => quickAddRef.current?.focus()}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all"
              >
                <Plus size={16} />
                Capture Idea
              </button>
            )}
          </div>
        )}

        {/* ── Idea feed ───────────────────────────── */}
        {filteredIdeas.length > 0 && (
          <div className="space-y-2">
            {filteredIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                onPromote={handlePromoteOpen}
                onSendToScript={handleSendToScript}
                onArchive={handleArchive}
                onDelete={setDeleteIdea}
              />
            ))}
          </div>
        )}

        {/* ── Promote Dialog ──────────────────────── */}
        <PromoteDialog
          open={!!promoteIdea}
          loading={promoting}
          projects={projects}
          selectedProjectId={selectedProjectId}
          newProjectName={newProjectName}
          onSelectProject={setSelectedProjectId}
          onNewProjectNameChange={setNewProjectName}
          onCreateNew={() => setSelectedProjectId('__new__')}
          onConfirm={handlePromoteConfirm}
          onCancel={() => setPromoteIdea(null)}
        />

        {/* ── Delete Confirm Dialog ───────────────── */}
        <ConfirmDialog
          open={!!deleteIdea}
          title="Delete Idea"
          message={
            deleteIdea
              ? `Are you sure you want to delete "${deleteIdea.title}"? This cannot be undone.`
              : ''
          }
          confirmLabel="Delete"
          confirmDanger
          loading={deleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteIdea(null)}
        />
      </div>
    </div>
  );
}
