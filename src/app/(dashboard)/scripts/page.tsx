'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Loader2,
  ChevronDown,
  SquarePen,
} from 'lucide-react';

/* ── Types ────────────────────────────────────── */

interface ScriptStyle {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
}

interface Script {
  id: string;
  title: string;
  content: string;
  styleId: string | null;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  style?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
}

/* ── Helpers ──────────────────────────────────── */

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/* ── Page ─────────────────────────────────────── */

export default function ScriptsPage() {
  const { data: session } = useSession();

  /* Script list state */
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);

  /* Editor state */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');
  const [editorStyleId, setEditorStyleId] = useState('');
  const [editorProjectId, setEditorProjectId] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved'>('idle');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* Dropdown options */
  const [styles, setStyles] = useState<ScriptStyle[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  /* Refs */
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fetch scripts ──────────────────────────── */

  const fetchScripts = useCallback(async () => {
    try {
      const res = await fetch('/api/scripts');
      if (!res.ok) throw new Error('Failed to load scripts');
      const data = await res.json();
      setScripts(data);
    } catch {
      toast.error('Failed to load scripts');
    } finally {
      setLoading(false);
    }
  }, []);

  /* ── Fetch dropdown options ─────────────────── */

  const fetchOptions = useCallback(async () => {
    try {
      const [stylesRes, projectsRes] = await Promise.all([
        fetch('/api/styles'),
        fetch('/api/projects'),
      ]);
      if (stylesRes.ok) {
        setStyles(await stylesRes.json());
      }
      if (projectsRes.ok) {
        setProjects(await projectsRes.json());
      }
    } catch {
      // Silently fail – dropdowns will just be empty
    }
  }, []);

  useEffect(() => {
    fetchScripts();
    fetchOptions();
  }, [fetchScripts, fetchOptions]);

  /* ── Select script ──────────────────────────── */

  const selectedScript = scripts.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedScript) {
      setEditorTitle(selectedScript.title);
      setEditorContent(selectedScript.content);
      setEditorStyleId(selectedScript.styleId ?? '');
      setEditorProjectId(selectedScript.projectId ?? '');
      setSaveStatus('idle');
    }
  }, [selectedScript]);

  /* ── Dirty detection ────────────────────────── */

  function isDirty() {
    if (!selectedScript) return false;
    return (
      editorTitle !== selectedScript.title ||
      editorContent !== selectedScript.content ||
      editorStyleId !== (selectedScript.styleId ?? '') ||
      editorProjectId !== (selectedScript.projectId ?? '')
    );
  }

  useEffect(() => {
    if (selectedScript && isDirty()) {
      setSaveStatus('unsaved');
    } else if (selectedScript && !isDirty()) {
      setSaveStatus('saved');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorTitle, editorContent, editorStyleId, editorProjectId, selectedScript]);

  /* ── Save handler ───────────────────────────── */

  const handleSave = useCallback(async () => {
    if (!selectedId) return;
    if (!editorTitle.trim()) {
      toast.error('Please enter a title');
      return;
    }

    setSaveStatus('saving');
    try {
      const res = await fetch(`/api/scripts/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editorTitle.trim(),
          content: editorContent,
          styleId: editorStyleId || null,
          projectId: editorProjectId || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to save');
      const updated = await res.json();

      setScripts((prev) =>
        prev.map((s) => (s.id === selectedId ? { ...s, ...updated } : s)),
      );
      setSaveStatus('saved');
      toast.success('Script saved');
    } catch {
      setSaveStatus('unsaved');
      toast.error('Failed to save script');
    }
  }, [selectedId, editorTitle, editorContent, editorStyleId, editorProjectId]);

  /* ── Ctrl+S detection ───────────────────────── */

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  /* ── Create new script ──────────────────────── */

  const handleNewScript = async () => {
    if (!editorTitle.trim()) {
      toast.error('Please enter a title first');
      return;
    }

    try {
      const res = await fetch('/api/scripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editorTitle.trim(),
          content: editorContent,
          styleId: editorStyleId || null,
          projectId: editorProjectId || null,
        }),
      });

      if (!res.ok) throw new Error('Failed to create');
      const created = await res.json();

      setScripts((prev) => [created, ...prev]);
      setSelectedId(created.id);
      setSaveStatus('saved');
      toast.success('Script created');
    } catch {
      toast.error('Failed to create script');
    }
  };

  const handleNewEmpty = () => {
    setSelectedId(null);
    setEditorTitle('');
    setEditorContent('');
    setEditorStyleId('');
    setEditorProjectId('');
    setSaveStatus('idle');
  };

  /* ── Delete ─────────────────────────────────── */

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/scripts/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setScripts((prev) => prev.filter((s) => s.id !== id));
      setDeleteConfirmId(null);
      if (selectedId === id) {
        setSelectedId(null);
        setEditorTitle('');
        setEditorContent('');
        setEditorStyleId('');
        setEditorProjectId('');
        setSaveStatus('idle');
      }
      toast.success('Script deleted');
    } catch {
      toast.error('Failed to delete script');
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
          <span className="text-sm">Loading scripts…</span>
        </div>
      </div>
    );
  }

  /* ── Render ─────────────────────────────────── */

  return (
    <div className="h-[calc(100vh-8rem)] grid grid-cols-1 md:grid-cols-2 gap-0 border border-[var(--border)]">
      {/* ─── Left Panel: Script List ──────────────── */}
      <div className="flex flex-col border-r border-[var(--border)] bg-[var(--panel)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h1 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
            <FileText size={16} className="text-[var(--accent)]" />
            Scripts
          </h1>
          <button
            onClick={handleNewEmpty}
            className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] hover:text-[var(--foreground)] transition-colors border border-[var(--border)] px-3 py-1.5 hover:border-[var(--accent)]"
          >
            <Plus size={14} />
            New Script
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {scripts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <FileText size={40} className="text-[var(--muted)] mb-3 opacity-40" />
              <p className="text-sm text-[var(--muted)]">
                No scripts yet. Write your first one!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {scripts.map((script) => {
                const isSelected = script.id === selectedId;
                return (
                  <div
                    key={script.id}
                    className={`group relative flex items-start gap-3 p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[var(--background)] border-l-2 border-l-[var(--accent)]'
                        : 'hover:bg-[var(--background)] border-l-2 border-l-transparent'
                    }`}
                    onClick={() => {
                      setSelectedId(script.id);
                      // Reset delete confirm when switching selection
                      setDeleteConfirmId(null);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {script.title || 'Untitled'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-[var(--muted)]">
                          {formatDateShort(script.createdAt)}
                        </span>
                        {script.style && (
                          <span className="text-[10px] font-medium text-[var(--accent)] border border-[var(--accent)]/30 px-1.5 py-0.5 leading-none">
                            {script.style.name}
                          </span>
                        )}
                        {script.project && (
                          <span className="text-[10px] text-[var(--muted)]">
                            {script.project.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Delete button on hover */}
                    <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {deleteConfirmId === script.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(script.id);
                            }}
                            disabled={deleting}
                            className="text-[10px] font-semibold text-[var(--danger)] border border-[var(--danger)] px-1.5 py-0.5 hover:bg-[var(--danger)]/10 transition-colors disabled:opacity-50"
                          >
                            {deleting ? '…' : 'Delete'}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteConfirmId(null);
                            }}
                            className="text-[10px] text-[var(--muted)] px-1.5 py-0.5 hover:text-[var(--foreground)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteConfirmId(script.id);
                          }}
                          className="text-[var(--muted)] hover:text-[var(--danger)] transition-colors p-1"
                          title="Delete script"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Right Panel: Script Editor ───────────── */}
      <div className="flex flex-col bg-[var(--background)] overflow-hidden">
        {selectedId === null ? (
          /* Placeholder state */
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <SquarePen size={48} className="text-[var(--muted)] mb-4 opacity-30" />
            <p className="text-sm text-[var(--muted)]">
              Select a script or create a new one
            </p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Editor toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted)]">
                  {saveStatus === 'saving' && 'Saving…'}
                  {saveStatus === 'saved' && 'Saved'}
                  {saveStatus === 'unsaved' && 'Unsaved changes'}
                  {saveStatus === 'idle' && ''}
                </span>
              </div>
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving' || saveStatus === 'saved'}
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] border border-[var(--border)] px-3 py-1.5 hover:border-[var(--accent)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saveStatus === 'saving' ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Save
              </button>
            </div>

            {/* Editor body (scrolls independently) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  placeholder="Script title…"
                  className="w-full bg-[var(--panel)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
                />
              </div>

              {/* Style selector */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Style
                </label>
                <div className="relative">
                  <select
                    value={editorStyleId}
                    onChange={(e) => setEditorStyleId(e.target.value)}
                    className="w-full appearance-none bg-[var(--panel)] border border-[var(--border)] px-3 py-2 pr-8 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  >
                    <option value="">No style</option>
                    {styles.map((style) => (
                      <option key={style.id} value={style.id}>
                        {style.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
                  />
                </div>
              </div>

              {/* Project selector */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Project
                </label>
                <div className="relative">
                  <select
                    value={editorProjectId}
                    onChange={(e) => setEditorProjectId(e.target.value)}
                    className="w-full appearance-none bg-[var(--panel)] border border-[var(--border)] px-3 py-2 pr-8 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  >
                    <option value="">No project</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
                  />
                </div>
              </div>

              {/* Content textarea */}
              <div className="flex-1">
                <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                  Script Content
                </label>
                <textarea
                  ref={contentRef}
                  value={editorContent}
                  onChange={(e) => setEditorContent(e.target.value)}
                  placeholder="Write your script here…"
                  className="w-full bg-[var(--panel)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                  style={{ minHeight: '400px' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
