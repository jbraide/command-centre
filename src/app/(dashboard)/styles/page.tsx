'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Palette,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  ChevronDown,
  Layers,
} from 'lucide-react';

/* ── Types ────────────────────────────────────── */

interface ScriptStyle {
  id: string;
  name: string;
  description: string | null;
  guidelines: string | null;
  createdAt: string;
  _count?: { scripts: number };
}

/* ── Helpers ──────────────────────────────────── */

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function truncate(text: string | null, max: number) {
  if (!text) return '';
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

/* ── Page ─────────────────────────────────────── */

export default function StylesPage() {
  const [styles, setStyles] = useState<ScriptStyle[]>([]);
  const [loading, setLoading] = useState(true);

  /* Expanded / editing state */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGuidelines, setEditGuidelines] = useState('');

  /* New inline form */
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newGuidelines, setNewGuidelines] = useState('');
  const [creating, setCreating] = useState(false);

  /* Delete */
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Fetch ──────────────────────────────────── */

  const fetchStyles = useCallback(async () => {
    try {
      const res = await fetch('/api/styles');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setStyles(data);
    } catch {
      toast.error('Failed to load styles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStyles();
  }, [fetchStyles]);

  /* ── Expand / collapse ──────────────────────── */

  const handleExpand = (style: ScriptStyle) => {
    if (expandedId === style.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(style.id);
    setEditName(style.name);
    setEditDescription(style.description ?? '');
    setEditGuidelines(style.guidelines ?? '');
    setDeleteConfirmId(null);
  };

  const handleCancelEdit = () => {
    if (expandedId) {
      const style = styles.find((s) => s.id === expandedId);
      if (style) {
        setEditName(style.name);
        setEditDescription(style.description ?? '');
        setEditGuidelines(style.guidelines ?? '');
      }
    }
    setExpandedId(null);
  };

  /* ── Save edit ──────────────────────────────── */

  const handleSaveEdit = async () => {
    if (!expandedId) return;
    if (!editName.trim()) {
      toast.error('Name is required');
      return;
    }

    try {
      const res = await fetch(`/api/styles/${expandedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          guidelines: editGuidelines.trim() || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to update');

      const updated = await res.json();
      setStyles((prev) =>
        prev.map((s) => (s.id === expandedId ? { ...s, ...updated } : s)),
      );
      setExpandedId(null);
      toast.success('Style updated');
    } catch {
      toast.error('Failed to update style');
    }
  };

  /* ── Create ─────────────────────────────────── */

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error('Name is required');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
          guidelines: newGuidelines.trim() || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to create');

      const created = await res.json();
      setStyles((prev) => [created, ...prev]);
      setNewName('');
      setNewDescription('');
      setNewGuidelines('');
      setShowNewForm(false);
      toast.success('Style created');
    } catch {
      toast.error('Failed to create style');
    } finally {
      setCreating(false);
    }
  };

  /* ── Delete ─────────────────────────────────── */

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/styles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setStyles((prev) => prev.filter((s) => s.id !== id));
      setDeleteConfirmId(null);
      if (expandedId === id) setExpandedId(null);
      toast.success('Style deleted');
    } catch {
      toast.error('Failed to delete style');
    } finally {
      setDeleting(false);
    }
  };

  /* ── Loading ────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-2 text-[var(--muted)]">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Loading styles…</span>
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────── */

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* ─── Header ──────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Palette size={20} className="text-[var(--accent)]" />
            Script Styles
          </h1>
          <button
            onClick={() => {
              setShowNewForm(!showNewForm);
              setNewName('');
              setNewDescription('');
              setNewGuidelines('');
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] border border-[var(--border)] px-3 py-1.5 hover:border-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
          >
            {showNewForm ? <X size={14} /> : <Plus size={14} />}
            {showNewForm ? 'Cancel' : 'New Style'}
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Define reusable script structures and formats. AI will use these as
          templates.
        </p>
      </div>

      {/* ─── New Style Inline Form ───────────────── */}
      {showNewForm && (
        <div className="border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Style name…"
            className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <input
            type="text"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Short description (optional)…"
            className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <textarea
            value={newGuidelines}
            onChange={(e) => setNewGuidelines(e.target.value)}
            placeholder="Guidelines for this style (optional)…"
            rows={4}
            className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
          />
          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] border border-[var(--border)] px-3 py-1.5 hover:border-[var(--accent)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Save Style
            </button>
          </div>
        </div>
      )}

      {/* ─── List ────────────────────────────────── */}
      {styles.length === 0 && !showNewForm ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <Palette size={40} className="text-[var(--muted)] mb-3 opacity-40" />
          <p className="text-sm text-[var(--muted)]">
            No styles yet. Create your first one!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {styles.map((style) => {
            const isExpanded = expandedId === style.id;
            const scriptCount = style._count?.scripts ?? 0;

            return (
              <div
                key={style.id}
                className="border border-[var(--border)] bg-[var(--panel)]"
              >
                {/* Card header (collapsed view) */}
                {!isExpanded && (
                  <button
                    onClick={() => handleExpand(style)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-[var(--background)] transition-colors group"
                  >
                    <ChevronDown
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--muted)] -rotate-90 group-hover:text-[var(--foreground)] transition-colors"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--foreground)]">
                          {style.name}
                        </p>
                        {scriptCount > 0 && (
                          <span
                            className="flex items-center gap-1 text-[10px] font-medium text-[var(--accent)] border border-[var(--accent)]/30 px-1.5 py-0.5 leading-none"
                            title={`${scriptCount} script${scriptCount !== 1 ? 's' : ''} use this style`}
                          >
                            <Layers size={10} />
                            {scriptCount}
                          </span>
                        )}
                      </div>
                      {style.description && (
                        <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                          {truncate(style.description, 100)}
                        </p>
                      )}
                      {style.guidelines && !style.description && (
                        <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed italic">
                          {truncate(style.guidelines, 100)}
                        </p>
                      )}
                      <p className="text-[10px] text-[var(--muted)] mt-1.5">
                        {formatDate(style.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(style.id);
                      }}
                      className="shrink-0 text-[var(--muted)] hover:text-[var(--danger)] transition-colors p-1 opacity-0 group-hover:opacity-100"
                      title="Delete style"
                    >
                      <Trash2 size={14} />
                    </button>
                  </button>
                )}

                {/* Expanded / editing view */}
                {isExpanded && (
                  <div className="p-4 space-y-3">
                    {/* Delete confirmation or inline actions */}
                    <div className="flex items-center justify-between">
                      {deleteConfirmId === style.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--muted)]">
                            Delete this style?
                          </span>
                          <button
                            onClick={() => handleDelete(style.id)}
                            disabled={deleting}
                            className="text-[10px] font-semibold text-[var(--danger)] border border-[var(--danger)] px-2 py-1 hover:bg-[var(--danger)]/10 transition-colors disabled:opacity-50"
                          >
                            {deleting ? '…' : 'Delete'}
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-[10px] text-[var(--muted)] px-2 py-1 hover:text-[var(--foreground)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[var(--muted)]">
                            {formatDate(style.createdAt)}
                          </span>
                          {scriptCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--accent)] border border-[var(--accent)]/30 px-1.5 py-0.5 leading-none">
                              <Layers size={10} />
                              {scriptCount} script{scriptCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                    />
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Short description…"
                      className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
                    />
                    <textarea
                      value={editGuidelines}
                      onChange={(e) => setEditGuidelines(e.target.value)}
                      placeholder="Guidelines for this style…"
                      rows={6}
                      className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                    />

                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="flex items-center gap-1.5 text-xs text-[var(--muted)] border border-[var(--border)] px-3 py-1.5 hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
                      >
                        <X size={14} />
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] border border-[var(--border)] px-3 py-1.5 hover:border-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
                      >
                        <Save size={14} />
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
