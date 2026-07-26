'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  BookOpen,
  Plus,
  Trash2,
  Save,
  X,
  Loader2,
  ChevronDown,
} from 'lucide-react';

/* ── Types ────────────────────────────────────── */

interface KeyPrinciple {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

/* ── Helpers ──────────────────────────────────── */

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
}

/* ── Page ─────────────────────────────────────── */

export default function PrinciplesPage() {
  const [principles, setPrinciples] = useState<KeyPrinciple[]>([]);
  const [loading, setLoading] = useState(true);

  /* Expanded / editing state */
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  /* New inline form */
  const [showNewForm, setShowNewForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [creating, setCreating] = useState(false);

  /* Delete */
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Fetch ──────────────────────────────────── */

  const fetchPrinciples = useCallback(async () => {
    try {
      const res = await fetch('/api/principles');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setPrinciples(data);
    } catch {
      toast.error('Failed to load principles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrinciples();
  }, [fetchPrinciples]);

  /* ── Expand / collapse ──────────────────────── */

  const handleExpand = (principle: KeyPrinciple) => {
    if (expandedId === principle.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(principle.id);
    setEditTitle(principle.title);
    setEditContent(principle.content);
    setDeleteConfirmId(null);
  };

  const handleCancelEdit = () => {
    if (expandedId) {
      const principle = principles.find((p) => p.id === expandedId);
      if (principle) {
        setEditTitle(principle.title);
        setEditContent(principle.content);
      }
    }
    setExpandedId(null);
  };

  /* ── Save edit ──────────────────────────────── */

  const handleSaveEdit = async () => {
    if (!expandedId) return;
    if (!editTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      const res = await fetch(`/api/principles/${expandedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent,
        }),
      });

      if (!res.ok) throw new Error('Failed to update');

      const updated = await res.json();
      setPrinciples((prev) =>
        prev.map((p) => (p.id === expandedId ? { ...p, ...updated } : p)),
      );
      setExpandedId(null);
      toast.success('Principle updated');
    } catch {
      toast.error('Failed to update principle');
    }
  };

  /* ── Create ─────────────────────────────────── */

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/principles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          content: newContent,
        }),
      });

      if (!res.ok) throw new Error('Failed to create');

      const created = await res.json();
      setPrinciples((prev) => [created, ...prev]);
      setNewTitle('');
      setNewContent('');
      setShowNewForm(false);
      toast.success('Principle created');
    } catch {
      toast.error('Failed to create principle');
    } finally {
      setCreating(false);
    }
  };

  /* ── Delete ─────────────────────────────────── */

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/principles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setPrinciples((prev) => prev.filter((p) => p.id !== id));
      setDeleteConfirmId(null);
      if (expandedId === id) setExpandedId(null);
      toast.success('Principle deleted');
    } catch {
      toast.error('Failed to delete principle');
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
          <span className="text-sm">Loading principles…</span>
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
            <BookOpen size={20} className="text-[var(--accent)]" />
            Key Principles
          </h1>
          <button
            onClick={() => {
              setShowNewForm(!showNewForm);
              setNewTitle('');
              setNewContent('');
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] border border-[var(--border)] px-3 py-1.5 hover:border-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
          >
            {showNewForm ? <X size={14} /> : <Plus size={14} />}
            {showNewForm ? 'Cancel' : 'New Principle'}
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Store your brand voice guidelines, script rules, and content principles
          that the AI can reference later.
        </p>
      </div>

      {/* ─── New Principle Inline Form ────────────── */}
      {showNewForm && (
        <div className="border border-[var(--border)] bg-[var(--panel)] p-4 space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Principle title…"
            className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Write your principle here…"
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
              Save Principle
            </button>
          </div>
        </div>
      )}

      {/* ─── List ────────────────────────────────── */}
      {principles.length === 0 && !showNewForm ? (
        <div className="flex flex-col items-center justify-center text-center py-16">
          <BookOpen size={40} className="text-[var(--muted)] mb-3 opacity-40" />
          <p className="text-sm text-[var(--muted)]">
            No principles yet. Add your first one!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {principles.map((principle) => {
            const isExpanded = expandedId === principle.id;
            return (
              <div
                key={principle.id}
                className="border border-[var(--border)] bg-[var(--panel)]"
              >
                {/* Card header (collapsed view) */}
                {!isExpanded && (
                  <button
                    onClick={() => handleExpand(principle)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-[var(--background)] transition-colors group"
                  >
                    <ChevronDown
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--muted)] -rotate-90 group-hover:text-[var(--foreground)] transition-colors"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)]">
                        {principle.title}
                      </p>
                      <p className="text-xs text-[var(--muted)] mt-1 leading-relaxed">
                        {truncate(principle.content, 120)}
                      </p>
                      <p className="text-[10px] text-[var(--muted)] mt-1.5">
                        {formatDate(principle.createdAt)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmId(principle.id);
                      }}
                      className="shrink-0 text-[var(--muted)] hover:text-[var(--danger)] transition-colors p-1 opacity-0 group-hover:opacity-100"
                      title="Delete principle"
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
                      {deleteConfirmId === principle.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--muted)]">
                            Delete this principle?
                          </span>
                          <button
                            onClick={() => handleDelete(principle.id)}
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
                        <span className="text-[10px] text-[var(--muted)]">
                          {formatDate(principle.createdAt)}
                        </span>
                      )}
                    </div>

                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                    />
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={6}
                      className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
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
