'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, Loader2, X, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';

interface Persona {
  id: string;
  name: string;
  description: string | null;
  colorTag: string;
  active: boolean;
  createdAt: string;
  _count: {
    examples: number;
    lessons: number;
    scripts: number;
  };
}

const COLOR_PRESETS = [
  { label: 'Green', value: '#7fd858' },
  { label: 'Blue', value: '#60a5fa' },
  { label: 'Purple', value: '#a78bfa' },
  { label: 'Amber', value: '#f59e0b' },
  { label: 'Pink', value: '#f472b6' },
  { label: 'Red', value: '#ef4444' },
];

export default function PersonasPage() {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('#7fd858');
  const [formActive, setFormActive] = useState(true);

  const fetchPersonas = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/personas');
      if (!res.ok) throw new Error('Failed to fetch personas');
      const data = await res.json();
      setPersonas(data);
    } catch {
      toast.error('Failed to load personas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormColor('#7fd858');
    setFormActive(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Persona name is required');
      return;
    }

    try {
      setCreating(true);
      const res = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          colorTag: formColor,
          active: formActive,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create persona');
      }

      toast.success('Persona created');
      setDialogOpen(false);
      resetForm();
      await fetchPersonas();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create persona');
    } finally {
      setCreating(false);
    }
  };

  const openDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Creator Personas</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Voice profiles for AI script generation
            {!loading && ` \u00b7 ${personas.length} persona${personas.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={openDialog}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all"
        >
          <Plus size={16} />
          New Persona
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
          <Loader2 size={32} className="animate-spin mb-3" />
          <p className="text-sm">Loading personas...</p>
        </div>
      )}

      {/* Empty state */}
      {!loading && personas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
          <Users size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium text-[var(--foreground)] mb-1">
            No personas yet
          </p>
          <p className="text-sm mb-6">
            Create your first creator persona to get started.
          </p>
          <button
            onClick={openDialog}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all"
          >
            <Plus size={16} />
            Create Persona
          </button>
        </div>
      )}

      {/* Personas grid */}
      {!loading && personas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personas.map((persona) => (
            <button
              key={persona.id}
              onClick={() => router.push(`/personas/${persona.id}`)}
              className="text-left rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 hover:border-[var(--accent)] hover:shadow-[0_0_12px_-2px_var(--accent)] transition-all duration-200 cursor-pointer group"
            >
              {/* Colored left border indicator */}
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-1 h-10 rounded-full"
                  style={{ backgroundColor: persona.colorTag }}
                />
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                    persona.active
                      ? 'text-[var(--accent)] border-[var(--accent)]/40'
                      : 'text-[var(--muted)] border-[var(--border)]'
                  }`}
                >
                  {persona.active ? 'Active' : 'Inactive'}
                </span>
              </div>

              {/* Name */}
              <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors mb-1">
                {persona.name}
              </h3>

              {/* Description preview */}
              {persona.description && (
                <p className="text-sm text-[var(--muted)] line-clamp-2 mb-4">
                  {persona.description}
                </p>
              )}
              {!persona.description && (
                <p className="text-sm text-[var(--muted)] italic mb-4">
                  No description
                </p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
                <span className="flex items-center gap-1">
                  <Circle size={12} />
                  {persona._count.examples} example{persona._count.examples !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  {persona._count.lessons} lesson{persona._count.lessons !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={12} />
                  {persona._count.scripts} script{persona._count.scripts !== 1 ? 's' : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* New Persona Dialog */}
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
                New Persona
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
                  htmlFor="persona-name"
                  className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                >
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="persona-name"
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Energetic Host"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="persona-description"
                  className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
                >
                  Description
                </label>
                <textarea
                  id="persona-description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="What makes this persona unique?"
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all resize-none"
                />
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Color Tag
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

              {/* Active toggle */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setFormActive(!formActive)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${
                      formActive ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                        formActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-[var(--foreground)]">Active</span>
                </label>
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
                  {creating ? 'Creating...' : 'Create Persona'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
