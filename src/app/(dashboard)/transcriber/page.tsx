'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Film,
  Copy,
  CheckCircle,
  Loader2,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Clock,
  Trash2,
  ExternalLink,
  History,
} from 'lucide-react';
import { toast } from 'sonner';

interface TranscriptResult {
  title: string;
  duration: number | null;
  language: string;
  text: string;
  segments: { start: number; end: number; text: string }[];
}

interface SavedTranscription {
  id: string;
  url: string;
  title: string;
  text: string;
  segments: string | null;
  language: string;
  duration: number | null;
  createdAt: string;
}

export default function TranscriberPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<TranscriptResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<SavedTranscription[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/transcriptions');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch {
      // silent fail
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setSaved(false);
    setShowHistory(false);

    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Transcription failed');
      }

      setResult(data);
      toast.success('Transcription complete');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!result || !url.trim()) return;
    setSaving(true);

    try {
      const res = await fetch('/api/transcriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          title: result.title,
          text: result.text,
          segments: result.segments,
          language: result.language,
          duration: result.duration,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSaved(true);
      toast.success('Transcription saved!');
      loadHistory();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to save';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/transcriptions/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete');

      setHistory((prev) => prev.filter((h) => h.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }

  function formatDuration(seconds: number | null): string {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Film className="text-[var(--accent)]" size={24} />
          <h1 className="text-2xl font-bold">Reel Transcriber</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Paste an Instagram reel URL. Get the transcript. Runs locally — no
          API key needed.
        </p>
      </div>

      {/* URL Input */}
      <div className="border border-[var(--border)] bg-[var(--panel)] p-6 mb-6">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.instagram.com/reel/..."
            className="flex-1 bg-[var(--background)] border border-[var(--border)] px-4 py-3 text-sm text-[var(--foreground)] focus:outline-none focus:border-[var(--accent)]"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="bg-[var(--accent)] text-[var(--background)] font-bold px-6 py-3 text-sm tracking-wider hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                WORKING...
              </>
            ) : (
              'TRANSCRIBE'
            )}
          </button>
        </form>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="border border-[var(--border)] bg-[var(--panel)] p-8 text-center mb-6">
          <Loader2
            size={32}
            className="animate-spin mx-auto text-[var(--accent)] mb-3"
          />
          <p className="text-sm text-[var(--muted)]">
            Downloading reel and running transcription...
          </p>
          <p className="text-xs text-[var(--muted)] mt-2">
            This can take 10-60 seconds depending on the reel length
          </p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="border border-[var(--danger)] bg-[var(--panel)] p-6 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-[var(--danger)] mt-0.5" size={18} />
            <div>
              <h3 className="font-semibold text-sm text-[var(--danger)] mb-1">
                Error
              </h3>
              <p className="text-sm text-[var(--muted)]">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div className="border border-[var(--border)] bg-[var(--panel)] mb-6">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm truncate">
                {result.title}
              </h2>
              <div className="flex gap-4 text-xs text-[var(--muted)] mt-1">
                {result.duration && (
                  <span>duration: {formatDuration(result.duration)}</span>
                )}
                <span>language: {result.language}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <button
                onClick={handleSave}
                disabled={saving || saved}
                className="flex items-center gap-2 text-xs border px-3 py-1.5 transition-colors
                  disabled:opacity-50 disabled:cursor-not-allowed
                  text-[var(--accent)] border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)]"
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : saved ? (
                  <BookmarkCheck size={14} />
                ) : (
                  <Bookmark size={14} />
                )}
                {saving ? 'SAVING...' : saved ? 'SAVED' : 'SAVE'}
              </button>
              <button
                onClick={() => handleCopy(result.text)}
                className="flex items-center gap-2 text-xs border px-3 py-1.5 transition-colors
                  text-[var(--accent)] border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)]"
              >
                {copied ? <CheckCircle size={14} /> : <Copy size={14} />}
                {copied ? 'COPIED' : 'COPY'}
              </button>
            </div>
          </div>

          {/* Transcript body */}
          <div className="p-4">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {result.text || '(no speech detected)'}
            </p>
          </div>

          {/* Segments */}
          {result.segments.length > 0 && (
            <div className="border-t border-[var(--border)]">
              <div className="p-4">
                <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                  Segments
                </h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {result.segments.map((seg, i) => (
                    <div
                      key={i}
                      className="flex gap-3 text-xs text-[var(--muted)]"
                    >
                      <span className="text-[var(--accent)] font-mono shrink-0 w-16">
                        {formatDuration(seg.start)} - {formatDuration(seg.end)}
                      </span>
                      <span className="text-[var(--foreground)]">
                        {seg.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="p-3 border-t border-[var(--border)] text-center text-xs text-[var(--muted)]">
            ran locally · yt-dlp + faster-whisper · no upload to cloud
          </div>
        </div>
      )}

      {/* Saved History */}
      <div className="border border-[var(--border)] bg-[var(--panel)]">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-4 border-b border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors"
        >
          <div className="flex items-center gap-2">
            <History size={16} className="text-[var(--muted)]" />
            <span className="font-semibold">Saved Transcriptions</span>
            {history.length > 0 && (
              <span className="text-xs text-[var(--muted)]">
                ({history.length})
              </span>
            )}
          </div>
          <span className="text-[var(--muted)] text-xs">
            {showHistory ? '▲' : '▼'}
          </span>
        </button>

        {showHistory && (
          <div className="divide-y divide-[var(--border)]">
            {history.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--muted)]">
                No saved transcriptions yet. Transcribe a reel and save it!
              </div>
            ) : (
              history.map((item) => {
                const parsedSegments: { start: number; end: number; text: string }[] | null = item.segments
                  ? (() => {
                      try { return JSON.parse(item.segments); }
                      catch { return null; }
                    })()
                  : null;
                const isExpanded = expandedId === item.id;

                return (
                  <div
                    key={item.id}
                    className="transition-colors"
                  >
                    <div className="p-4 hover:bg-[var(--background)] transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold truncate">
                              {item.title}
                            </h3>
                            <span className="text-[10px] uppercase text-[var(--muted)] bg-[var(--background)] px-1.5 py-0.5">
                              {item.language}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
                            <span className="flex items-center gap-1">
                              <Clock size={11} />
                              {formatDate(item.createdAt)}
                            </span>
                            {item.duration && (
                              <span>{formatDuration(item.duration)}</span>
                            )}
                          </div>
                          <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">
                            {item.text}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {parsedSegments && parsedSegments.length > 0 && (
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : item.id)}
                              className="flex items-center gap-1 text-xs border px-2 py-1 transition-colors
                                text-[var(--accent)] border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--background)]"
                              title={isExpanded ? 'Collapse segments' : 'View segments'}
                            >
                              {isExpanded ? '▲ SEGMENTS' : '▼ VIEW'}
                            </button>
                          )}
                          <button
                            onClick={() => handleCopy(item.text)}
                            className="p-1.5 text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                            title="Copy text"
                          >
                            <Copy size={14} />
                          </button>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                            title="Open reel"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded segments */}
                    {isExpanded && parsedSegments && parsedSegments.length > 0 && (
                      <div className="border-t border-[var(--border)] bg-[var(--background)]">
                        <div className="p-4">
                          <h4 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
                            Segments
                          </h4>
                          <div className="space-y-1 max-h-64 overflow-y-auto">
                            {parsedSegments.map((seg, i) => (
                              <div
                                key={i}
                                className="flex gap-3 text-xs"
                              >
                                <span className="text-[var(--accent)] font-mono shrink-0 w-16">
                                  {formatDuration(seg.start)} - {formatDuration(seg.end)}
                                </span>
                                <span className="text-[var(--foreground)]">
                                  {seg.text}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
