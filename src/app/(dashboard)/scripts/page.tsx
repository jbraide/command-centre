'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import MarkdownRenderer from '@/components/markdown-renderer';
import {
  FileText,
  Plus,
  Trash2,
  Save,
  Loader2,
  ChevronDown,
  SquarePen,
  Sparkles,
  Lightbulb,
  Type,
  Eye,
  EyeOff,
  LayoutGrid,
  StickyNote,
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

interface Persona {
  id: string;
  name: string;
  colorTag: string;
  description?: string | null;
  active: boolean;
}

interface IdeaItem {
  id: string;
  title: string;
  rawNotes?: string | null;
  tags?: string | null;
}

interface Script {
  id: string;
  title: string;
  content: string;
  styleId: string | null;
  projectId: string | null;
  personaId: string | null;
  ideaId: string | null;
  createdAt: string;
  updatedAt: string;
  style?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  persona?: { id: string; name: string; colorTag: string } | null;
  idea?: { id: string; title: string } | null;
  format?: string;
  scriptText?: string | null;
  creativeDirection?: string | null;
  productionNotes?: string | null;
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

function parseTags(tagsStr: string | null | undefined): string[] {
  if (!tagsStr) return [];
  try {
    const parsed = JSON.parse(tagsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
  }
}

/* ── Page ─────────────────────────────────────── */

export default function ScriptsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-2 text-[var(--muted)]">
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    }>
      <ScriptsPageInner />
    </Suspense>
  );
}

function ScriptsPageInner() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

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
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);

  /* ── Generation panel state ──────────────────── */
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [topicSource, setTopicSource] = useState<'text' | 'idea'>('text');
  const [genTopic, setGenTopic] = useState('');
  const [genIdeaId, setGenIdeaId] = useState('');
  const [genPersonaId, setGenPersonaId] = useState('');
  const [genConstraints, setGenConstraints] = useState('');
  const [genThinking, setGenThinking] = useState(false);
  const [genFormat, setGenFormat] = useState<'table' | 'structured'>('table');
  const [showPreview, setShowPreview] = useState(false);

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
      const [stylesRes, projectsRes, personasRes, ideasRes] = await Promise.all([
        fetch('/api/styles'),
        fetch('/api/projects'),
        fetch('/api/personas'),
        fetch('/api/ideas?status=raw'),
      ]);
      if (stylesRes.ok) {
        setStyles(await stylesRes.json());
      }
      if (projectsRes.ok) {
        setProjects(await projectsRes.json());
      }
      if (personasRes.ok) {
        const data = await personasRes.json();
        setPersonas(data.filter?.((p: Persona) => p.active) ?? data);
      }
      if (ideasRes.ok) {
        setIdeas(await ideasRes.json());
      }
    } catch {
      // Silently fail – dropdowns will just be empty
    }
  }, []);

  useEffect(() => {
    fetchScripts();
    fetchOptions();
  }, [fetchScripts, fetchOptions]);

  /* ── Handle query params from Idea Hub "Send to Script" ── */

  useEffect(() => {
    const newParam = searchParams.get('new');
    const titleParam = searchParams.get('title');
    const contentParam = searchParams.get('content');
    const tagsParam = searchParams.get('tags');

    if (newParam === 'true' || titleParam) {
      // Create a new empty / pre-filled script
      handleNewEmpty();

      if (titleParam) {
        setEditorTitle(titleParam);
        // Pre-fill the topic in the generation panel too
        setGenTopic(contentParam || titleParam);
      }

      // Show generate panel
      setShowGenerate(true);

      // Clean URL without refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('new');
      url.searchParams.delete('title');
      url.searchParams.delete('content');
      url.searchParams.delete('tags');
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setShowGenerate(false);
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

  /* ── AI Generate ────────────────────────────── */

  const handleGenerate = async () => {
    const effectiveTopic = topicSource === 'idea' && genIdeaId
      ? undefined  // will be resolved server-side from ideaId
      : topicSource === 'text' && genTopic.trim()
        ? genTopic.trim()
        : null;

    if (topicSource === 'text' && !genTopic.trim()) {
      toast.error('Please enter a topic to generate from');
      return;
    }

    if (topicSource === 'idea' && !genIdeaId) {
      toast.error('Please select an idea to generate from');
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: effectiveTopic,
          ideaId: topicSource === 'idea' ? genIdeaId : null,
          personaId: genPersonaId || null,
          scriptStyle: editorStyleId || null,
          constraints: genConstraints.trim() || null,
          thinking: genThinking,
          format: genFormat,
          title: editorTitle.trim() || null,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Generation failed');
      }

      const data = await res.json();

      // Set editor content from generation
      setEditorContent(data.content);
      if (data.script?.title) {
        setEditorTitle(data.script.title);
      }

      // Add the created script to the list and select it
      if (data.script) {
        setScripts((prev) => [data.script, ...prev]);
        setSelectedId(data.script.id);
        setEditorStyleId(data.script.styleId ?? '');
        setSaveStatus('saved');
      }

      setShowGenerate(false);
      toast.success('Script generated!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate script');
    } finally {
      setGenerating(false);
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
                      setDeleteConfirmId(null);
                      setShowGenerate(false);
                    }}
                  >
                    {/* Persona color dot */}
                    {script.persona && (
                      <div
                        className="shrink-0 w-2.5 h-2.5 rounded-full mt-1.5"
                        style={{ backgroundColor: script.persona.colorTag }}
                        title={`Persona: ${script.persona.name}`}
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-medium text-[var(--foreground)] truncate">
                          {script.title || 'Untitled'}
                        </p>
                        {script.format === 'structured' && (
                          <span className="shrink-0 text-[10px] font-medium text-[var(--accent)] border border-[var(--accent)]/30 px-1.5 py-0.5 leading-none">
                            Structured
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-[10px] text-[var(--muted)]">
                          {formatDateShort(script.createdAt)}
                        </span>
                        {script.persona && (
                          <span className="text-[10px] font-medium" style={{ color: script.persona.colorTag }}>
                            {script.persona.name}
                          </span>
                        )}
                        {script.style && (
                          <span className="text-[10px] font-medium text-[var(--accent)] border border-[var(--accent)]/30 px-1.5 py-0.5 leading-none">
                            {script.style.name}
                          </span>
                        )}
                        {script.idea && (
                          <span className="text-[10px] text-[var(--muted)] flex items-center gap-1">
                            <Lightbulb size={10} />
                            {script.idea.title}
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
        {selectedId === null && !showGenerate ? (
          /* ── Placeholder / Empty State ──────────── */
          <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-4">
            <SquarePen size={48} className="text-[var(--muted)] mb-2 opacity-30" />
            <p className="text-sm text-[var(--muted)]">
              Select a script or create a new one
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleNewEmpty}
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] border border-[var(--border)] px-4 py-2 hover:border-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
              >
                <Plus size={14} />
                Blank Script
              </button>
              <button
                onClick={() => {
                  handleNewEmpty();
                  setShowGenerate(true);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--accent)] border border-[var(--accent)]/40 px-4 py-2 hover:border-[var(--accent)] hover:text-[var(--foreground)] transition-colors"
              >
                <Sparkles size={14} />
                Generate with AI
              </button>
            </div>
          </div>
        ) : selectedId === null && showGenerate ? (
          /* ── Generation Panel (no script selected) ── */
          <GenerationPanel
            topicSource={topicSource}
            setTopicSource={setTopicSource}
            genTopic={genTopic}
            setGenTopic={setGenTopic}
            genIdeaId={genIdeaId}
            setGenIdeaId={setGenIdeaId}
            genPersonaId={genPersonaId}
            setGenPersonaId={setGenPersonaId}
            genConstraints={genConstraints}
            setGenConstraints={setGenConstraints}
            genThinking={genThinking}
            setGenThinking={setGenThinking}
            genFormat={genFormat}
            setGenFormat={setGenFormat}
            generating={generating}
            onGenerate={handleGenerate}
            onCancel={() => {
              setShowGenerate(false);
              handleNewEmpty();
            }}
            ideas={ideas}
            personas={personas}
            styles={styles}
            editorStyleId={editorStyleId}
            setEditorStyleId={setEditorStyleId}
          />
        ) : (
          /* ── Editor ─────────────────────────────── */
          <div className="flex flex-col h-full">
            {/* Editor toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                {showGenerate && (
                  <button
                    onClick={() => setShowGenerate(false)}
                    className="text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                  >
                    ← Back to editor
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--muted)]">
                    {saveStatus === 'saving' && 'Saving…'}
                    {saveStatus === 'saved' && 'Saved'}
                    {saveStatus === 'unsaved' && 'Unsaved changes'}
                    {saveStatus === 'idle' && ''}
                  </span>
                  {selectedScript?.format === 'structured' && (
                    <span className="text-[10px] font-medium text-[var(--accent)] border border-[var(--accent)]/30 px-1.5 py-0.5 leading-none">
                      Structured
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGenerate(!showGenerate)}
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 transition-colors ${
                    showGenerate
                      ? 'text-[var(--foreground)] bg-[var(--accent)]/10 border border-[var(--accent)]'
                      : 'text-[var(--accent)] border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--foreground)]'
                  }`}
                >
                  <Sparkles size={14} />
                  Generate
                </button>
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
            </div>

            {/* Generation panel (collapsible inside editor) */}
            {showGenerate && (
              <div className="border-b border-[var(--border)] bg-[var(--panel)]">
                <GenerationPanel
                  topicSource={topicSource}
                  setTopicSource={setTopicSource}
                  genTopic={genTopic}
                  setGenTopic={setGenTopic}
                  genIdeaId={genIdeaId}
                  setGenIdeaId={setGenIdeaId}
                  genPersonaId={genPersonaId}
                  setGenPersonaId={setGenPersonaId}
                  genConstraints={genConstraints}
                  setGenConstraints={setGenConstraints}
                  genThinking={genThinking}
                  setGenThinking={setGenThinking}
                  genFormat={genFormat}
                  setGenFormat={setGenFormat}
                  generating={generating}
                  onGenerate={handleGenerate}
                  onCancel={() => setShowGenerate(false)}
                  ideas={ideas}
                  personas={personas}
                  styles={styles}
                  editorStyleId={editorStyleId}
                  setEditorStyleId={setEditorStyleId}
                  compact
                />
              </div>
            )}

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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[var(--muted)]">
                    Script Content
                  </label>
                  {(editorContent || selectedScript?.format === 'structured') && (
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                    >
                      {showPreview ? (
                        <><EyeOff size={14} /> Edit</>
                      ) : (
                        <><Eye size={14} /> Preview</>
                      )}
                    </button>
                  )}
                </div>
                {showPreview ? (
                  selectedScript?.format === 'structured' ? (
                    <StructuredScriptView
                      scriptText={selectedScript?.scriptText}
                      creativeDirection={selectedScript?.creativeDirection}
                      productionNotes={selectedScript?.productionNotes}
                      fallbackContent={editorContent}
                    />
                  ) : (
                    <div className="w-full bg-[var(--panel)] border border-[var(--border)] px-4 py-3 text-sm min-h-[400px] overflow-y-auto">
                      <MarkdownRenderer content={editorContent} />
                    </div>
                  )
                ) : (
                  <textarea
                    ref={contentRef}
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    placeholder="Write your script here…"
                    className="w-full bg-[var(--panel)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
                    style={{ minHeight: '400px' }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Generation Panel Component ──────────────── */

function GenerationPanel({
  topicSource,
  setTopicSource,
  genTopic,
  setGenTopic,
  genIdeaId,
  setGenIdeaId,
  genPersonaId,
  setGenPersonaId,
  genConstraints,
  setGenConstraints,
  genThinking,
  setGenThinking,
  genFormat,
  setGenFormat,
  generating,
  onGenerate,
  onCancel,
  ideas,
  personas,
  styles,
  editorStyleId,
  setEditorStyleId,
  compact,
}: {
  topicSource: 'text' | 'idea';
  setTopicSource: (v: 'text' | 'idea') => void;
  genTopic: string;
  setGenTopic: (v: string) => void;
  genIdeaId: string;
  setGenIdeaId: (v: string) => void;
  genPersonaId: string;
  setGenPersonaId: (v: string) => void;
  genConstraints: string;
  setGenConstraints: (v: string) => void;
  genThinking: boolean;
  setGenThinking: (v: boolean) => void;
  genFormat: 'table' | 'structured';
  setGenFormat: (v: 'table' | 'structured') => void;
  generating: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  ideas: IdeaItem[];
  personas: Persona[];
  styles: ScriptStyle[];
  editorStyleId: string;
  setEditorStyleId: (v: string) => void;
  compact?: boolean;
}) {
  const selectedIdea = ideas.find((i) => i.id === genIdeaId);
  const topicTags = selectedIdea
    ? parseTags(selectedIdea.tags)
    : [];

  return (
    <div className={compact ? 'p-4 space-y-3' : 'p-6 space-y-4 h-full overflow-y-auto'}>
      <h2 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
        <Sparkles size={16} className="text-[var(--accent)]" />
        Generate Script with AI
      </h2>

      {/* ── Topic Source Tabs ──────────────────────── */}
      <div>
        <label className="block text-xs font-medium text-[var(--muted)] mb-2">
          Topic Source
        </label>
        <div className="flex gap-1">
          <button
            onClick={() => setTopicSource('text')}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border transition-all ${
              topicSource === 'text'
                ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]'
                : 'text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)] hover:bg-[var(--panel)]'
            }`}
          >
            <Type size={13} />
            Paste Text
          </button>
          <button
            onClick={() => setTopicSource('idea')}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border transition-all ${
              topicSource === 'idea'
                ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]'
                : 'text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)] hover:bg-[var(--panel)]'
            }`}
          >
            <Lightbulb size={13} />
            From Idea Hub
          </button>
        </div>
      </div>

      {/* ── Topic Input ───────────────────────────── */}
      {topicSource === 'text' ? (
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">
            Topic / Prompt
          </label>
          <textarea
            value={genTopic}
            onChange={(e) => setGenTopic(e.target.value)}
            placeholder="Describe what the script should be about…"
            className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
            rows={compact ? 2 : 4}
          />
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-[var(--muted)] mb-1">
            Select an Idea
          </label>
          <div className="relative">
            <select
              value={genIdeaId}
              onChange={(e) => {
                setGenIdeaId(e.target.value);
                const idea = ideas.find((i) => i.id === e.target.value);
                if (idea) {
                  setGenTopic(idea.title + (idea.rawNotes ? '\n\n' + idea.rawNotes : ''));
                }
              }}
              className="w-full appearance-none bg-[var(--background)] border border-[var(--border)] px-3 py-2 pr-8 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            >
              <option value="">Select an idea…</option>
              {ideas.map((idea) => (
                <option key={idea.id} value={idea.id}>
                  {idea.title}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            />
          </div>

          {/* Show selected idea details */}
          {selectedIdea && (
            <div className="mt-2 p-2 bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--muted)]">
              {selectedIdea.rawNotes && (
                <p className="mb-1 line-clamp-2">{selectedIdea.rawNotes}</p>
              )}
              {topicTags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {topicTags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] px-1.5 py-0.5 bg-[var(--accent)]/10 border border-[var(--accent)]/20 text-[var(--accent)]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {ideas.length === 0 && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              No raw ideas available. Add some in the Idea Hub first.
            </p>
          )}
        </div>
      )}

      {/* ── Style Selector ────────────────────────── */}
      <div>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1">
          Script Style
        </label>
        <div className="relative">
          <select
            value={editorStyleId}
            onChange={(e) => setEditorStyleId(e.target.value)}
            className="w-full appearance-none bg-[var(--background)] border border-[var(--border)] px-3 py-2 pr-8 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
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

      {/* ── Output Format ───────────────────────── */}
      <div>
        <label className="block text-xs font-medium text-[var(--muted)] mb-2">
          Output Format
        </label>
        <div className="flex gap-1">
          <button
            onClick={() => setGenFormat('table')}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border transition-all ${
              genFormat === 'table'
                ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]'
                : 'text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)] hover:bg-[var(--panel)]'
            }`}
          >
            <LayoutGrid size={13} />
            Table
          </button>
          <button
            onClick={() => setGenFormat('structured')}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 border transition-all ${
              genFormat === 'structured'
                ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]'
                : 'text-[var(--muted)] border-[var(--border)] hover:text-[var(--foreground)] hover:bg-[var(--panel)]'
            }`}
          >
            <StickyNote size={13} />
            Structured
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-[var(--muted)]">
          {genFormat === 'table'
            ? 'Table — time, visual & voiceover in columns'
            : 'Structured — script, creative direction & production notes'}
        </p>
      </div>

      {/* ── Persona Selector ──────────────────────── */}
      <div>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1">
          Creator Persona (voice)
        </label>
        <div className="relative">
          <select
            value={genPersonaId}
            onChange={(e) => setGenPersonaId(e.target.value)}
            className="w-full appearance-none bg-[var(--background)] border border-[var(--border)] px-3 py-2 pr-8 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          >
            <option value="">None — my own voice</option>
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
          />
        </div>

        {/* Show selected persona indicator */}
        {genPersonaId && personas.find((p) => p.id === genPersonaId) && (
          <div className="mt-1.5 flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{
                backgroundColor: personas.find((p) => p.id === genPersonaId)?.colorTag,
              }}
            />
            <span className="text-xs text-[var(--muted)]">
              {personas.find((p) => p.id === genPersonaId)?.description || 'Using this persona\'s voice'}
            </span>
          </div>
        )}

        {personas.length === 0 && (
          <p className="mt-1 text-xs text-[var(--muted)]">
            No creator personas yet. Create one in the Personas section.
          </p>
        )}
      </div>

      {/* ── Constraints ──────────────────────────── */}
      <div>
        <label className="block text-xs font-medium text-[var(--muted)] mb-1">
          Constraints <span className="font-normal text-[var(--muted)]/60">(optional)</span>
        </label>
        <input
          type="text"
          value={genConstraints}
          onChange={(e) => setGenConstraints(e.target.value)}
          placeholder="E.g. max 60 seconds, target audience is beginners, include a CTA…"
          className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
        />
      </div>

      {/* ── Advanced: Thinking mode ──────────────── */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={genThinking}
          onChange={(e) => setGenThinking(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        <span className="text-xs text-[var(--muted)]">
          Deep reasoning mode (slower but higher quality)
        </span>
      </label>

      {/* ── Action buttons ───────────────────────── */}
      <div className="flex items-center gap-2 pt-2">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="flex items-center gap-1.5 text-xs font-semibold bg-[var(--accent)] text-[var(--background)] px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Generate Script
            </>
          )}
        </button>
        <button
          onClick={onCancel}
          disabled={generating}
          className="text-xs text-[var(--muted)] px-3 py-2 hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Structured Script Preview ────────────────── */

function StructuredScriptView({
  scriptText,
  creativeDirection,
  productionNotes,
  fallbackContent,
}: {
  scriptText?: string | null;
  creativeDirection?: string | null;
  productionNotes?: string | null;
  fallbackContent: string;
}) {
  const script = scriptText?.trim() || fallbackContent?.trim();
  const direction = creativeDirection?.trim();
  const notes = productionNotes?.trim();

  // No structured fields at all → fall back to the raw markdown content
  if (!script && !direction && !notes) {
    return (
      <div className="w-full bg-[var(--panel)] border border-[var(--border)] px-4 py-3 text-sm min-h-[400px] overflow-y-auto">
        <MarkdownRenderer content={fallbackContent} />
      </div>
    );
  }

  return (
    <div className="w-full bg-[var(--panel)] border border-[var(--border)] px-4 py-3 text-sm min-h-[400px] overflow-y-auto space-y-5">
      {script && (
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)] pb-1.5 mb-2">
            Script
          </h3>
          <MarkdownRenderer content={script} />
        </section>
      )}
      {direction && (
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)] pb-1.5 mb-2">
            Creative Direction
          </h3>
          <MarkdownRenderer content={direction} />
        </section>
      )}
      {notes && (
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)] pb-1.5 mb-2">
            Production Notes
          </h3>
          <MarkdownRenderer content={notes} />
        </section>
      )}
    </div>
  );
}
