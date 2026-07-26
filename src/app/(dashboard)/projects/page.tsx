'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FolderKanban, Circle, CheckCircle2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  createdAt: string;
  _count: { tasks: number };
  completedTasks: number;
}

const COLOR_PRESETS = [
  { label: 'Green', value: '#7fd858' },
  { label: 'Blue', value: '#60a5fa' },
  { label: 'Purple', value: '#a78bfa' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Pink', value: '#f472b6' },
  { label: 'Red', value: '#ef4444' },
];

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  ARCHIVED: 'Archived',
  COMPLETED: 'Completed',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'text-[var(--accent)] border-[var(--accent)]',
  ARCHIVED: 'text-[var(--muted)] border-[var(--border)]',
  COMPLETED: 'text-blue-400 border-blue-400/40',
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('#7fd858');

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data);
    } catch {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormColor('#7fd858');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Project name is required');
      return;
    }

    try {
      setCreating(true);
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          color: formColor,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create project');
      }

      toast.success('Project created');
      setDialogOpen(false);
      resetForm();
      await fetchProjects();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const openDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const taskProgress = (project: Project) => {
    const total = project._count.tasks;
    const done = project.completedTasks;
    return `${done} / ${total}`;
  };

  const statusColor = (status: string) => STATUS_COLORS[status] || STATUS_COLORS.ACTIVE;
  const statusLabel = (status: string) => STATUS_LABELS[status] || status;

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Projects</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Manage your projects and track progress
          </p>
        </div>
        <button
          onClick={openDialog}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all"
        >
          <Plus size={16} />
          New Project
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
          <Loader2 size={32} className="animate-spin mb-3" />
          <p className="text-sm">Loading projects...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
          <FolderKanban size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium text-[var(--foreground)] mb-1">
            No projects yet
          </p>
          <p className="text-sm mb-6">
            Create your first project to get started.
          </p>
          <button
            onClick={openDialog}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all"
          >
            <Plus size={16} />
            Create Project
          </button>
        </div>
      )}

      {/* Projects grid */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => router.push(`/projects/${project.id}`)}
              className="text-left rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 hover:border-[var(--accent)] hover:shadow-[0_0_12px_-2px_var(--accent)] transition-all duration-200 cursor-pointer group"
            >
              {/* Color bar + status */}
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: project.color + '20' }}
                >
                  <FolderKanban size={20} style={{ color: project.color }} />
                </div>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusColor(project.status)}`}
                >
                  {statusLabel(project.status)}
                </span>
              </div>

              {/* Name */}
              <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors mb-1">
                {project.name}
              </h3>

              {/* Description preview */}
              {project.description && (
                <p className="text-sm text-[var(--muted)] line-clamp-2 mb-4">
                  {project.description}
                </p>
              )}
              {!project.description && (
                <p className="text-sm text-[var(--muted)] italic mb-4">
                  No description
                </p>
              )}

              {/* Task progress */}
              {project._count.tasks > 0 && (
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <CheckCircle2 size={14} className="text-[var(--accent)]" />
                  <span>
                    {project.completedTasks} / {project._count.tasks} tasks
                  </span>
                </div>
              )}
              {project._count.tasks === 0 && (
                <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <Circle size={14} />
                  <span>No tasks yet</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* New Project Dialog */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialogOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl">
            <div className="flex items-center justify-between px-6 pt-6 pb-3">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                New Project
              </h2>
              <button
                onClick={() => setDialogOpen(false)}
                className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="px-6 pb-6 space-y-5">
              {/* Name */}
              <div>
                <label
                  htmlFor="project-name"
                  className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                >
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="project-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="My Project"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="project-description"
                  className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                >
                  Description
                </label>
                <textarea
                  id="project-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What is this project about?"
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all resize-none"
                />
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Color
                </label>
                <div className="flex gap-2.5">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setFormColor(preset.value)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        formColor === preset.value
                          ? 'ring-2 ring-offset-2 ring-offset-[var(--panel)] ring-[var(--accent)] scale-110'
                          : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: preset.value }}
                      title={preset.label}
                    >
                      {formColor === preset.value && (
                        <CheckCircle2 size={14} className="text-white drop-shadow" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
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
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
