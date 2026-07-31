'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Plus,
  X,
  BookOpen,
  FileText,
  SquarePen,
  ExternalLink,
  Users,
  MessageSquare,
  List,
  Search,
  Pencil,
  Check,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PersonaExample {
  id: string;
  personaId: string;
  sourceType: string;
  transcriptionId: string | null;
  content: string;
  note: string | null;
  createdAt: string;
  transcription?: { id: string; title: string } | null;
}

interface PersonaLesson {
  id: string;
  personaId: string;
  title: string;
  content: string;
  url?: string | null;
  createdAt: string;
}

interface Script {
  id: string;
  title: string;
  createdAt: string;
}

interface Persona {
  id: string;
  name: string;
  description: string | null;
  colorTag: string;
  active: boolean;
  examples: PersonaExample[];
  lessons: PersonaLesson[];
  _count: { scripts: number };
}

interface SavedTranscription {
  id: string;
  title: string;
  text: string;
  language: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PersonaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [persona, setPersona] = useState<Persona | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'examples' | 'lessons' | 'scripts'>('examples');

  // Example form
  const [showExampleForm, setShowExampleForm] = useState(false);
  const [exampleContent, setExampleContent] = useState('');
  const [exampleNote, setExampleNote] = useState('');
  const [exampleSourceType, setExampleSourceType] = useState<'manual' | 'transcription'>('manual');
  const [creatingExample, setCreatingExample] = useState(false);

  // Transcription picker
  const [showTranscriptionPicker, setShowTranscriptionPicker] = useState(false);
  const [transcriptions, setTranscriptions] = useState<SavedTranscription[]>([]);
  const [loadingTranscriptions, setLoadingTranscriptions] = useState(false);
  const [transcriptionSearch, setTranscriptionSearch] = useState('');

  // Lesson form
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonContent, setLessonContent] = useState('');
  const [lessonUrl, setLessonUrl] = useState('');
  const [creatingLesson, setCreatingLesson] = useState(false);

  // Lesson edit state
  const [editLessonId, setEditLessonId] = useState<string | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [editLessonContent, setEditLessonContent] = useState('');
  const [editLessonUrl, setEditLessonUrl] = useState('');
  const [savingLesson, setSavingLesson] = useState(false);

  // Scripts
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(false);

  // Delete confirmations
  const [deleteExampleId, setDeleteExampleId] = useState<string | null>(null);
  const [deletingExample, setDeletingExample] = useState(false);
  const [deleteLessonId, setDeleteLessonId] = useState<string | null>(null);
  const [deletingLesson, setDeletingLesson] = useState(false);

  // ── Fetch persona ──────────────────────────────────────

  const fetchPersona = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/personas/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/personas');
          return;
        }
        throw new Error('Failed to fetch persona');
      }
      const data = await res.json();
      setPersona(data);
    } catch {
      toast.error('Failed to load persona');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersona();
  }, [id]);

  // ── Fetch scripts linked to this persona ──────────────

  const fetchScripts = async () => {
    try {
      setLoadingScripts(true);
      const res = await fetch(`/api/scripts?personaId=${id}`);
      if (!res.ok) throw new Error('Failed to fetch scripts');
      const data = await res.json();
      setScripts(data);
    } catch {
      // Silently fail — scripts tab is secondary
    } finally {
      setLoadingScripts(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'scripts') {
      fetchScripts();
    }
  }, [activeTab, id]);

  // ── Fetch transcriptions for picker ───────────────────

  const fetchTranscriptions = async () => {
    try {
      setLoadingTranscriptions(true);
      const res = await fetch('/api/transcriptions');
      if (!res.ok) throw new Error('Failed to fetch transcriptions');
      const data = await res.json();
      setTranscriptions(data);
    } catch {
      toast.error('Failed to load transcriptions');
    } finally {
      setLoadingTranscriptions(false);
    }
  };

  const openTranscriptionPicker = () => {
    setShowTranscriptionPicker(true);
    setTranscriptionSearch('');
    fetchTranscriptions();
  };

  // ── Create example ────────────────────────────────────

  const handleCreateExample = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exampleContent.trim()) {
      toast.error('Content is required');
      return;
    }

    try {
      setCreatingExample(true);
      const res = await fetch(`/api/personas/${id}/examples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: exampleSourceType,
          content: exampleContent.trim(),
          note: exampleNote.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create example');
      }

      toast.success('Example added');
      setShowExampleForm(false);
      setExampleContent('');
      setExampleNote('');
      setExampleSourceType('manual');
      await fetchPersona();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create example');
    } finally {
      setCreatingExample(false);
    }
  };

  const handlePickTranscription = async (t: SavedTranscription) => {
    try {
      setCreatingExample(true);
      const res = await fetch(`/api/personas/${id}/examples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType: 'transcription',
          transcriptionId: t.id,
          content: t.text.substring(0, 5000),
          note: t.title,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create example');
      }

      toast.success('Example added from transcription');
      setShowTranscriptionPicker(false);
      await fetchPersona();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create example');
    } finally {
      setCreatingExample(false);
    }
  };

  // ── Delete example ────────────────────────────────────

  const handleDeleteExample = async (exampleId: string) => {
    try {
      setDeletingExample(true);
      const res = await fetch(`/api/personas/examples/${exampleId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete example');

      toast.success('Example deleted');
      setDeleteExampleId(null);
      await fetchPersona();
    } catch {
      toast.error('Failed to delete example');
    } finally {
      setDeletingExample(false);
    }
  };

  // ── Create lesson ─────────────────────────────────────

  const handleCreateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonTitle.trim() || !lessonContent.trim()) {
      toast.error('Title and content are required');
      return;
    }

    try {
      setCreatingLesson(true);
      const res = await fetch(`/api/personas/${id}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: lessonTitle.trim(),
          content: lessonContent.trim(),
          url: lessonUrl.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create lesson');
      }

      toast.success('Lesson added');
      setShowLessonForm(false);
      setLessonTitle('');
      setLessonContent('');
      setLessonUrl('');
      await fetchPersona();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create lesson');
    } finally {
      setCreatingLesson(false);
    }
  };

  // ── Update lesson ─────────────────────────────────────

  const handleUpdateLesson = async (lessonId: string) => {
    if (!editLessonTitle.trim()) {
      toast.error('Title is required');
      return;
    }
    try {
      setSavingLesson(true);
      const res = await fetch(`/api/personas/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editLessonTitle.trim(),
          content: editLessonContent,
          url: editLessonUrl.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to update lesson');
      toast.success('Lesson updated');
      setEditLessonId(null);
      await fetchPersona();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update lesson');
    } finally {
      setSavingLesson(false);
    }
  };

  // ── Delete lesson ─────────────────────────────────────

  const handleDeleteLesson = async (lessonId: string) => {
    try {
      setDeletingLesson(true);
      const res = await fetch(`/api/personas/lessons/${lessonId}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete lesson');

      toast.success('Lesson deleted');
      setDeleteLessonId(null);
      await fetchPersona();
    } catch {
      toast.error('Failed to delete lesson');
    } finally {
      setDeletingLesson(false);
    }
  };

  // ── Loading state ─────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
        <Loader2 size={32} className="animate-spin mb-3" />
        <p className="text-sm">Loading persona...</p>
      </div>
    );
  }

  if (!persona) return null;

  // ── Filtered transcriptions ────────────────────────────

  const filteredTranscriptions = transcriptions.filter(
    (t) =>
      !transcriptionSearch ||
      t.title.toLowerCase().includes(transcriptionSearch.toLowerCase())
  );

  // ── Render ─────────────────────────────────────────────

  const tabs = [
    { key: 'examples' as const, label: 'Examples', icon: MessageSquare, count: persona.examples.length },
    { key: 'lessons' as const, label: 'Lessons', icon: BookOpen, count: persona.lessons.length },
    { key: 'scripts' as const, label: 'Generated Scripts', icon: SquarePen, count: persona._count.scripts },
  ];

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Back button */}
      <button
        onClick={() => router.push('/personas')}
        className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Personas
      </button>

      {/* Persona header */}
      <div className="flex items-start gap-4 mb-8">
        <div
          className="w-2 h-16 rounded-full shrink-0"
          style={{ backgroundColor: persona.colorTag }}
        />
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {persona.name}
            </h1>
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
          {persona.description && (
            <p className="text-sm text-[var(--muted)]">{persona.description}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
                isActive
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-[var(--muted)] hover:text-[var(--foreground)]'
              }`}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              <span
                className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    : 'bg-[var(--border)] text-[var(--muted)]'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Examples Tab ─────────────────────────────── */}

      {activeTab === 'examples' && (
        <div className="space-y-4">
          {/* Add example button */}
          {!showExampleForm && (
            <button
              onClick={() => setShowExampleForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all"
            >
              <Plus size={16} />
              Add Example
            </button>
          )}

          {/* Example form */}
          {showExampleForm && (
            <form
              onSubmit={handleCreateExample}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  New Example
                </h3>
                <button
                  type="button"
                  onClick={() => setShowExampleForm(false)}
                  className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Source type toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setExampleSourceType('manual')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    exampleSourceType === 'manual'
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Manual Entry
                </button>
                <button
                  type="button"
                  onClick={openTranscriptionPicker}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                    exampleSourceType === 'transcription'
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                      : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]'
                  }`}
                >
                  Pick from Saved Transcriptions
                </button>
              </div>

              {/* Manual entry fields */}
              {exampleSourceType === 'manual' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      Content <span className="text-red-400">*</span>
                    </label>
                    <textarea
                      value={exampleContent}
                      onChange={(e) => setExampleContent(e.target.value)}
                      placeholder="Paste or type the example speech content..."
                      rows={5}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                      Note (optional)
                    </label>
                    <input
                      type="text"
                      value={exampleNote}
                      onChange={(e) => setExampleNote(e.target.value)}
                      placeholder="What to note about this example?"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                    />
                  </div>
                </>
              )}

              {exampleSourceType === 'transcription' && (
                <p className="text-sm text-[var(--muted)] italic">
                  Click the button above to pick from your saved transcriptions.
                </p>
              )}

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowExampleForm(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingExample || !exampleContent.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingExample && <Loader2 size={14} className="animate-spin" />}
                  {creatingExample ? 'Saving...' : 'Save Example'}
                </button>
              </div>
            </form>
          )}

          {/* Examples list */}
          {persona.examples.length === 0 && !showExampleForm && (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
              <MessageSquare size={36} className="mb-3 opacity-50" />
              <p className="text-sm">No examples yet. Add speech examples to define this persona's voice.</p>
            </div>
          )}

          {persona.examples.map((example) => (
            <div
              key={example.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      example.sourceType === 'manual'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-400/30'
                        : 'bg-purple-500/10 text-purple-400 border border-purple-400/30'
                    }`}
                  >
                    {example.sourceType === 'manual' ? 'Manual' : 'Transcription'}
                  </span>
                  {example.transcription && (
                    <span className="text-[11px] text-[var(--muted)]">
                      from: {example.transcription.title}
                    </span>
                  )}
                  <span className="text-[11px] text-[var(--muted)]">
                    {formatDate(example.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {deleteExampleId === example.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDeleteExample(example.id)}
                        disabled={deletingExample}
                        className="p-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        {deletingExample ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          'Confirm'
                        )}
                      </button>
                      <button
                        onClick={() => setDeleteExampleId(null)}
                        className="p-1 rounded text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteExampleId(example.id)}
                      className="p-1 rounded text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete example"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="text-sm text-[var(--foreground)] whitespace-pre-wrap mb-2">
                {example.content.length > 500
                  ? example.content.substring(0, 500) + '...'
                  : example.content}
              </div>
              {example.note && (
                <p className="text-xs text-[var(--muted)] italic border-t border-[var(--border)] pt-2 mt-2">
                  {example.note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Lessons Tab ─────────────────────────────── */}

      {activeTab === 'lessons' && (
        <div className="space-y-4">
          {/* Add lesson button */}
          {!showLessonForm && (
            <button
              onClick={() => setShowLessonForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all"
            >
              <Plus size={16} />
              Add Lesson
            </button>
          )}

          {/* Lesson form */}
          {showLessonForm && (
            <form
              onSubmit={handleCreateLesson}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  New Lesson
                </h3>
                <button
                  type="button"
                  onClick={() => setShowLessonForm(false)}
                  className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  placeholder="e.g. Use short sentences"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  Content <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  placeholder="Describe the lesson or guideline..."
                  rows={4}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--muted)] mb-1.5">
                  Source URL <span className="text-[var(--muted)] font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={lessonUrl}
                  onChange={(e) => setLessonUrl(e.target.value)}
                  placeholder="e.g. https://youtube.com/watch?v=..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLessonForm(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingLesson || !lessonTitle.trim() || !lessonContent.trim()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingLesson && <Loader2 size={14} className="animate-spin" />}
                  {creatingLesson ? 'Saving...' : 'Save Lesson'}
                </button>
              </div>
            </form>
          )}

          {/* Lessons list */}
          {persona.lessons.length === 0 && !showLessonForm && (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
              <BookOpen size={36} className="mb-3 opacity-50" />
              <p className="text-sm">No lessons yet. Add guidelines for the AI to follow.</p>
            </div>
          )}

          {persona.lessons.map((lesson) => {
            const isEditing = editLessonId === lesson.id;
            return (
              <div
                key={lesson.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--panel)] overflow-hidden"
              >
                {!isEditing ? (
                  <>
                    {/* Collapsed view */}
                    <div
                      onClick={() => {
                        setEditLessonId(lesson.id);
                        setEditLessonTitle(lesson.title);
                        setEditLessonContent(lesson.content);
                        setEditLessonUrl(lesson.url || '');
                      }}
                      className="p-5 cursor-pointer hover:bg-[var(--background)]/30 transition-colors group"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-[var(--foreground)]">
                            {lesson.title}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] text-[var(--muted)]">
                              {formatDate(lesson.createdAt)}
                            </span>
                            {lesson.url && (
                              <a
                                href={lesson.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] text-[var(--accent)] hover:underline inline-flex items-center gap-0.5"
                              >
                                <ExternalLink size={10} />
                                Source
                              </a>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-3">
                          <span className="p-1 rounded text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity">
                            <Pencil size={13} />
                          </span>
                          {deleteLessonId === lesson.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteLesson(lesson.id); }}
                                disabled={deletingLesson}
                                className="p-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                              >
                                {deletingLesson ? <Loader2 size={14} className="animate-spin" /> : 'Confirm'}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); setDeleteLessonId(null); }}
                                className="p-1 rounded text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteLessonId(lesson.id); }}
                              className="p-1 rounded text-[var(--muted)] hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                              title="Delete lesson"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap line-clamp-2">
                        {lesson.content}
                      </p>
                    </div>
                  </>
                ) : (
                  /* Expanded edit view */
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[var(--foreground)]">Edit Lesson</h3>
                      <button
                        onClick={() => setEditLessonId(null)}
                        className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--muted)] mb-1">Title</label>
                      <input
                        type="text"
                        value={editLessonTitle}
                        onChange={(e) => setEditLessonTitle(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--muted)] mb-1">Content</label>
                      <textarea
                        value={editLessonContent}
                        onChange={(e) => setEditLessonContent(e.target.value)}
                        rows={8}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all resize-y font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--muted)] mb-1">Source URL (optional)</label>
                      <input
                        type="url"
                        value={editLessonUrl}
                        onChange={(e) => setEditLessonUrl(e.target.value)}
                        placeholder="https://..."
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setEditLessonId(null)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUpdateLesson(lesson.id)}
                        disabled={savingLesson || !editLessonTitle.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50"
                      >
                        {savingLesson ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
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

      {/* ── Scripts Tab ─────────────────────────────── */}

      {activeTab === 'scripts' && (
        <div className="space-y-4">
          {loadingScripts && (
            <div className="flex items-center justify-center py-16 text-[var(--muted)]">
              <Loader2 size={24} className="animate-spin" />
            </div>
          )}

          {!loadingScripts && scripts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-[var(--muted)]">
              <SquarePen size={36} className="mb-3 opacity-50" />
              <p className="text-sm">No scripts have been generated using this persona yet.</p>
            </div>
          )}

          {!loadingScripts &&
            scripts.map((script) => (
              <button
                key={script.id}
                onClick={() => router.push(`/scripts`)}
                className="w-full text-left rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5 hover:border-[var(--accent)] transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[var(--foreground)] group-hover:text-[var(--accent)] transition-colors">
                      {script.title}
                    </h3>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      {formatDate(script.createdAt)}
                    </p>
                  </div>
                  <ExternalLink size={16} className="text-[var(--muted)] group-hover:text-[var(--accent)] transition-colors" />
                </div>
              </button>
            ))}
        </div>
      )}

      {/* ── Transcription Picker Modal ──────────────── */}

      {showTranscriptionPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTranscriptionPicker(false);
          }}
        >
          <div className="w-full max-w-lg max-h-[80vh] rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-3">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Pick a Transcription
              </h2>
              <button
                onClick={() => setShowTranscriptionPicker(false)}
                className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 pb-3">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  type="text"
                  value={transcriptionSearch}
                  onChange={(e) => setTranscriptionSearch(e.target.value)}
                  placeholder="Search transcriptions..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
              {loadingTranscriptions && (
                <div className="flex items-center justify-center py-8 text-[var(--muted)]">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              )}

              {!loadingTranscriptions && filteredTranscriptions.length === 0 && (
                <p className="text-sm text-[var(--muted)] text-center py-8">
                  {transcriptionSearch
                    ? 'No matching transcriptions'
                    : 'No saved transcriptions yet'}
                </p>
              )}

              {!loadingTranscriptions &&
                filteredTranscriptions.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handlePickTranscription(t)}
                    disabled={creatingExample}
                    className="w-full text-left p-3 rounded-lg border border-[var(--border)] hover:border-[var(--accent)] bg-[var(--background)] hover:bg-[var(--panel)] transition-all cursor-pointer disabled:opacity-50"
                  >
                    <p className="text-sm font-medium text-[var(--foreground)]">
                      {t.title || 'Untitled'}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-0.5 line-clamp-1">
                      {t.text?.substring(0, 120)}...
                    </p>
                    <p className="text-[10px] text-[var(--muted)] mt-1">
                      {t.language} &middot; {formatDate(t.createdAt)}
                    </p>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
