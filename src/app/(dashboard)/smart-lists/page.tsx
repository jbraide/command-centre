'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ListFilter,
  Plus,
  Trash2,
  X,
  Loader2,
  FolderKanban,
  Star,
  Filter,
  Eye,
  Clock,
  AlertCircle,
  CheckCircle2,
  List,
  Zap,
  Layers,
  Target,
  BarChart3,
  Bookmark,
  Heart,
  Bell,
  Settings,
  type LucideIcon,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SmartList {
  id: string;
  name: string;
  icon: string | null;
  filters: string; // JSON string
  createdAt: string;
}

interface FilterValues {
  status?: string;
  priority?: string;
  projectId?: string;
  dueDate?: string;
  tags?: string;
  search?: string;
}

// ---------------------------------------------------------------------------
// Icon presets
// ---------------------------------------------------------------------------

const ICON_PRESETS = [
  { label: 'Star', icon: Star as LucideIcon },
  { label: 'Filter', icon: Filter as LucideIcon },
  { label: 'Eye', icon: Eye as LucideIcon },
  { label: 'Clock', icon: Clock as LucideIcon },
  { label: 'Alert', icon: AlertCircle as LucideIcon },
  { label: 'Check', icon: CheckCircle2 as LucideIcon },
  { label: 'List', icon: List as LucideIcon },
  { label: 'Zap', icon: Zap as LucideIcon },
  { label: 'Layers', icon: Layers as LucideIcon },
  { label: 'Target', icon: Target as LucideIcon },
  { label: 'Chart', icon: BarChart3 as LucideIcon },
  { label: 'Bookmark', icon: Bookmark as LucideIcon },
  { label: 'Heart', icon: Heart as LucideIcon },
  { label: 'Bell', icon: Bell as LucideIcon },
  { label: 'Gear', icon: Settings as LucideIcon },
  { label: 'Folder', icon: FolderKanban as LucideIcon },
];

const EMOJI_PRESETS = ['🔥', '⭐', '🎯', '📋', '✅', '🚀', '💡', '📌', '🎨', '⚡', '🛠️', '📊', '🏷️', '📅', '🎬', '📝'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseFilters(filters: string): FilterValues {
  try {
    return JSON.parse(filters);
  } catch {
    return {};
  }
}

function filterSummary(filters: FilterValues): string {
  const parts: string[] = [];
  if (filters.priority) parts.push(filters.priority + ' priority');
  if (filters.status) parts.push(filters.status);
  if (filters.dueDate) {
    parts.push(
      filters.dueDate === 'today'
        ? 'Due today'
        : filters.dueDate === 'week'
        ? 'Due this week'
        : filters.dueDate === 'overdue'
        ? 'Overdue'
        : 'Due: ' + filters.dueDate
    );
  }
  if (filters.tags) parts.push('Tags: ' + filters.tags);
  if (filters.search) parts.push('Search: "' + filters.search + '"');
  if (filters.projectId) parts.push('Specific project');
  return parts.length > 0 ? parts.join(' · ') : 'No filters';
}

function getLucideIcon(name: string): LucideIcon | undefined {
  return ICON_PRESETS.find(
    (p) => p.label.toLowerCase() === name
  )?.icon;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SmartListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<SmartList[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // Form state
  const [formName, setFormName] = useState('');
  const [formIcon, setFormIcon] = useState('🔥');
  const [formIconType, setFormIconType] = useState<'emoji' | 'lucide'>('emoji');
  const [formFilterStatus, setFormFilterStatus] = useState('');
  const [formFilterPriority, setFormFilterPriority] = useState('');
  const [formFilterProjectId, setFormFilterProjectId] = useState('');
  const [formFilterDueDate, setFormFilterDueDate] = useState('');
  const [formFilterTags, setFormFilterTags] = useState('');
  const [formFilterSearch, setFormFilterSearch] = useState('');

  const fetchLists = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/smart-lists');
      if (!res.ok) throw new Error('Failed to fetch smart lists');
      const data = await res.json();
      setLists(data);
    } catch {
      toast.error('Failed to load smart lists');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })));
      }
    } catch {
      // Non-critical
    }
  };

  useEffect(() => {
    fetchLists();
    fetchProjects();
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormIcon('🔥');
    setFormIconType('emoji');
    setFormFilterStatus('');
    setFormFilterPriority('');
    setFormFilterProjectId('');
    setFormFilterDueDate('');
    setFormFilterTags('');
    setFormFilterSearch('');
  };

  const openDialog = (prefillFilters?: FilterValues) => {
    resetForm();
    if (prefillFilters) {
      if (prefillFilters.status) setFormFilterStatus(prefillFilters.status);
      if (prefillFilters.priority) setFormFilterPriority(prefillFilters.priority);
      if (prefillFilters.projectId) setFormFilterProjectId(prefillFilters.projectId);
      if (prefillFilters.dueDate) setFormFilterDueDate(prefillFilters.dueDate);
      if (prefillFilters.tags) setFormFilterTags(prefillFilters.tags);
      if (prefillFilters.search) setFormFilterSearch(prefillFilters.search);
    }
    setDialogOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }

    const iconValue = formIconType === 'emoji' ? formIcon : `lucide:${formIcon}`;

    const filters: FilterValues = {};
    if (formFilterStatus) filters.status = formFilterStatus;
    if (formFilterPriority) filters.priority = formFilterPriority;
    if (formFilterProjectId) filters.projectId = formFilterProjectId;
    if (formFilterDueDate) filters.dueDate = formFilterDueDate;
    if (formFilterTags.trim()) filters.tags = formFilterTags.trim();
    if (formFilterSearch.trim()) filters.search = formFilterSearch.trim();

    try {
      setCreating(true);
      const res = await fetch('/api/smart-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          icon: iconValue,
          filters,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create smart list');
      }

      toast.success('Smart list created');
      setDialogOpen(false);
      resetForm();
      await fetchLists();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create smart list');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/smart-lists/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Smart list deleted');
      setDeleteConfirmId(null);
      await fetchLists();
    } catch {
      toast.error('Failed to delete smart list');
    }
  };

  const applyFilters = (list: SmartList) => {
    const filters = parseFilters(list.filters);
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.projectId) params.set('projectId', filters.projectId);
    if (filters.dueDate) params.set('dueDate', filters.dueDate);
    if (filters.tags) params.set('tags', filters.tags);
    if (filters.search) params.set('search', filters.search);
    router.push(`/projects?${params.toString()}`);
  };

  const renderIcon = (list: SmartList) => {
    const iconStr = list.icon || '🔥';
    if (iconStr.startsWith('lucide:')) {
      const name = iconStr.replace('lucide:', '');
      const LucideIcon = getLucideIcon(name);
      if (LucideIcon) {
        return <LucideIcon size={20} className="text-[var(--accent)]" />;
      }
      return <Filter size={20} className="text-[var(--accent)]" />;
    }
    return <span className="text-lg">{iconStr}</span>;
  };

  const renderFormIconPicker = () => {
    const currentIsEmoji = formIconType === 'emoji';
    return (
      <div>
        <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
          Icon
        </label>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setFormIconType('emoji')}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              currentIsEmoji
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            Emoji
          </button>
          <button
            type="button"
            onClick={() => setFormIconType('lucide')}
            className={`px-3 py-1 text-xs rounded border transition-colors ${
              !currentIsEmoji
                ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
            }`}
          >
            Icon
          </button>
        </div>
        {currentIsEmoji ? (
          <div className="grid grid-cols-8 gap-1">
            {EMOJI_PRESETS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => setFormIcon(emoji)}
                className={`w-9 h-9 flex items-center justify-center rounded-md text-base transition-all ${
                  formIcon === emoji
                    ? 'bg-[var(--accent)]/20 ring-1 ring-[var(--accent)] scale-110'
                    : 'hover:bg-[var(--border)]'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-8 gap-1">
            {ICON_PRESETS.map((preset) => {
              const IconComp = preset.icon;
              const iconKey = preset.label.toLowerCase();
              const isSelected = formIcon === iconKey;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setFormIcon(iconKey)}
                  className={`w-9 h-9 flex items-center justify-center rounded-md transition-all ${
                    isSelected
                      ? 'bg-[var(--accent)]/20 ring-1 ring-[var(--accent)] scale-110'
                      : 'hover:bg-[var(--border)]'
                  }`}
                  title={preset.label}
                >
                  <IconComp
                    size={16}
                    className={isSelected ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Smart Lists</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Save your favorite filters for quick access
          </p>
        </div>
        <button
          onClick={() => openDialog()}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all"
        >
          <Plus size={16} />
          New Smart List
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
          <Loader2 size={32} className="animate-spin mb-3" />
          <p className="text-sm">Loading smart lists...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && lists.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
          <ListFilter size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium text-[var(--foreground)] mb-1">
            No smart lists yet
          </p>
          <p className="text-sm mb-6">Save your favorite filters!</p>
          <button
            onClick={() => openDialog()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all"
          >
            <Plus size={16} />
            Create Smart List
          </button>
        </div>
      )}

      {/* Smart lists grid */}
      {!loading && lists.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => {
            const filters = parseFilters(list.filters);
            return (
              <div
                key={list.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 hover:border-[var(--accent)] hover:shadow-[0_0_12px_-2px_var(--accent)] transition-all duration-200 group cursor-pointer"
                onClick={() => applyFilters(list)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
                    {renderIcon(list)}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDialog(filters);
                      }}
                      className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
                      title="Edit"
                    >
                      <Filter size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(list.id);
                      }}
                      className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-all"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors mb-1">
                  {list.name}
                </h3>
                <p className="text-xs text-[var(--muted)] line-clamp-2">
                  {filterSummary(filters)}
                </p>

                {/* Delete confirmation */}
                {deleteConfirmId === list.id && (
                  <div
                    className="mt-3 pt-3 border-t border-[var(--border)]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs text-[var(--muted)] mb-2">
                      Delete &quot;{list.name}&quot;?
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDelete(list.id)}
                        className="px-3 py-1 text-xs font-medium rounded bg-[var(--danger)] text-white hover:brightness-110 transition-all"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1 text-xs font-medium rounded border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create/Edit Dialog ── */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDialogOpen(false);
              setDeleteConfirmId(null);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 pt-6 pb-3 sticky top-0 bg-[var(--panel)] z-10">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                New Smart List
              </h2>
              <button
                onClick={() => {
                  setDialogOpen(false);
                  setDeleteConfirmId(null);
                }}
                className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 pb-6 space-y-5">
              {/* Name */}
              <div>
                <label
                  htmlFor="sl-name"
                  className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                >
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="sl-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="High Priority Tasks"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                  autoFocus
                />
              </div>

              {/* Icon picker */}
              {renderFormIconPicker()}

              {/* ── Filter fields ── */}
              <div className="border-t border-[var(--border)] pt-4">
                <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                  Filters
                </h3>

                <div className="space-y-4">
                  {/* Status */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--foreground)] mb-1">
                      Status
                    </label>
                    <select
                      value={formFilterStatus}
                      onChange={(e) => setFormFilterStatus(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                    >
                      <option value="">Any</option>
                      <option value="ACTIVE">Active</option>
                      <option value="ARCHIVED">Archived</option>
                      <option value="COMPLETED">Completed</option>
                    </select>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--foreground)] mb-1">
                      Priority
                    </label>
                    <div className="flex gap-2">
                      {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() =>
                            setFormFilterPriority(formFilterPriority === p ? '' : p)
                          }
                          className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-all ${
                            formFilterPriority === p
                              ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                              : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                          }`}
                        >
                          {p === 'HIGH' ? 'High' : p === 'MEDIUM' ? 'Medium' : 'Low'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Project */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--foreground)] mb-1">
                      Project
                    </label>
                    <select
                      value={formFilterProjectId}
                      onChange={(e) => setFormFilterProjectId(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                    >
                      <option value="">Any project</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Due date */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--foreground)] mb-1">
                      Due Date
                    </label>
                    <select
                      value={formFilterDueDate}
                      onChange={(e) => setFormFilterDueDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                    >
                      <option value="">Any</option>
                      <option value="overdue">Overdue</option>
                      <option value="today">Due today</option>
                      <option value="week">Due this week</option>
                    </select>
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--foreground)] mb-1">
                      Tags
                    </label>
                    <input
                      type="text"
                      value={formFilterTags}
                      onChange={(e) => setFormFilterTags(e.target.value)}
                      placeholder="tag1, tag2, tag3"
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                    />
                  </div>

                  {/* Search text */}
                  <div>
                    <label className="block text-xs font-medium text-[var(--foreground)] mb-1">
                      Search
                    </label>
                    <input
                      type="text"
                      value={formFilterSearch}
                      onChange={(e) => setFormFilterSearch(e.target.value)}
                      placeholder="Search text..."
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    setDialogOpen(false);
                    setDeleteConfirmId(null);
                  }}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating && <Loader2 size={14} className="animate-spin" />}
                  {creating ? 'Creating...' : 'Create Smart List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
