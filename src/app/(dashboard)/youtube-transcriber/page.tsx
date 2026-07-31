'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useTranscriptionQueue } from '@/lib/transcription-queue';
import {
  Youtube,
  Copy,
  CheckCircle,
  Bookmark,
  History,
  Trash2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Clock,
  Languages,
  Loader2,
  AlertCircle,
  Plus,
  X,
  List,
  Brain,
} from 'lucide-react';

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

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
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

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function isValidVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace('www.', '');
    // Supported platforms (yt-dlp handles many more)
    const supported = [
      'youtube.com', 'youtu.be', 'instagram.com', 'instagr.am',
      'facebook.com', 'fb.com', 'fb.watch', 'tiktok.com',
      'twitter.com', 'x.com', 'vimeo.com', 'dailymotion.com',
      'twitch.tv',
    ];
    return supported.some(s => host === s || host.endsWith('.' + s));
  } catch {
    return false;
  }
}

export default function VideoTranscriberPage() {
  const { queue, addToQueue, removeFromQueue, isProcessing } = useTranscriptionQueue();
  const [urlInput, setUrlInput] = useState('');
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedTranscription[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedQueueId, setExpandedQueueId] = useState<string | null>(null);

  /* Extract lessons state */
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [personas, setPersonas] = useState<{ id: string; name: string }[]>([]);
  const [showPersonaPicker, setShowPersonaPicker] = useState<string | null>(null);

  const youtubeId = extractYoutubeId(urlInput);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/transcriptions');
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  function handleAddToQueue() {
    const url = urlInput.trim();
    if (!url) return;
    if (!isValidVideoUrl(url)) {
      toast.error('Not a valid video URL. Supported: YouTube, Instagram, TikTok, Facebook, and more.');
      return;
    }
    addToQueue(url);
    setUrlInput('');
  }

  async function handleSave(result: TranscriptResult, url: string) {
    try {
      const res = await fetch('/api/transcriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title: result.title,
          text: result.text,
          segments: result.segments,
          language: result.language,
          duration: result.duration,
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json();
      setSavedIds((prev) => new Set(prev).add(data.id));
      toast.success('Transcription saved!');
      loadHistory();
    } catch {
      toast.error('Failed to save');
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/transcriptions/${id}`, { method: 'DELETE' });
      setHistory((prev) => prev.filter((h) => h.id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  /* ── Extract lessons ─────────────────────────── */

  const openExtract = async (item: SavedTranscription) => {
    try {
      const res = await fetch('/api/personas');
      if (res.ok) {
        const data = await res.json();
        setPersonas(data);
        setShowPersonaPicker(item.id);
      } else {
        toast.error('Create a persona first');
      }
    } catch {
      toast.error('Failed to load personas');
    }
  };

  const handleExtract = async (item: SavedTranscription, personaId: string) => {
    setExtractingId(item.id);
    setShowPersonaPicker(null);
    try {
      const res = await fetch('/api/ai/extract-lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: item.text,
          title: item.title,
          personaId,
          url: item.url,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Extraction failed');
      toast.success(`${data.lessons} lessons extracted from "${item.title}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Extraction failed');
    } finally {
      setExtractingId(null);
    }
  };

  function handleCopy(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  }

  const numQueued = queue.filter((q) => q.status === 'queued').length;
  const numDownloading = queue.filter((q) => q.status === 'downloading' || q.status === 'transcribing').length;
  const numDone = queue.filter((q) => q.status === 'done').length;
  const numError = queue.filter((q) => q.status === 'error').length;
  const currentItem = queue.find((q) => q.status === 'downloading' || q.status === 'transcribing');

  return (
    <div className="min-h-screen max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-red-500/20">
          <Youtube size={24} className="text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Video Transcriber</h1>
          <p className="text-sm text-[var(--muted)]">Get transcripts from YouTube, Instagram, TikTok, and more</p>
        </div>
      </div>

      {/* URL Input + Add to Queue */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Youtube size={16} className="text-red-400" />
          </div>
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddToQueue(); } }}
            placeholder="Paste a video URL (YouTube, Instagram, TikTok...)"
            className="w-full pl-10 pr-3 py-2.5 text-sm rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
          />
        </div>
        <button
          onClick={handleAddToQueue}
          disabled={!urlInput.trim() || !isValidVideoUrl(urlInput.trim())}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus size={16} />
          Add to Queue
        </button>
      </div>
      {urlInput && !isValidVideoUrl(urlInput) && (
        <p className="text-xs text-red-400 mt-1.5 ml-1 mb-4">
          Not a valid video URL. Try YouTube, Instagram, TikTok, etc.
        </p>
      )}

      {/* Video Preview — show when queue is empty and nothing is processing */}
      {urlInput && youtubeId && queue.length === 0 && !isProcessing && (
        <div className="mb-6 rounded-lg overflow-hidden border border-[var(--border)]">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            className="w-full aspect-video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {/* Queue */}
      {queue.length > 0 && (
        <div className="mb-6 border border-[var(--border)] bg-[var(--panel)] rounded-lg overflow-hidden">
          {/* Queue header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <List size={16} className="text-[var(--muted)]" />
              <span className="text-sm font-semibold">Queue</span>
              <span className="text-xs text-[var(--muted)]">
                {numDone + numError}/{queue.length}
              </span>
            </div>
            {/* Progress bar */}
            <div className="flex-1 max-w-[200px] h-1.5 bg-[var(--background)] rounded-full overflow-hidden ml-4">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                style={{ width: `${queue.length > 0 ? ((numDone + numError) / queue.length) * 100 : 0}%` }}
              />
            </div>
          </div>

          {/* Current item progress */}
          {currentItem && (
            <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--background)]/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Loader2 size={14} className="animate-spin text-red-400 shrink-0" />
                  <span className="text-sm truncate text-[var(--foreground)]">
                    {currentItem.url.split('v=')[1]?.slice(0, 11) || 'Processing...'}
                  </span>
                </div>
                <span className="text-xs text-[var(--muted)] shrink-0 ml-2">
                  {currentItem.status === 'downloading' ? 'Downloading audio...' : 'Transcribing...'}
                </span>
              </div>
              {/* Animated phase bar */}
              <div className="h-1 bg-[var(--background)] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full animate-pulse ${
                    currentItem.status === 'downloading'
                      ? 'bg-yellow-500 w-3/4'
                      : 'bg-blue-500 w-1/2'
                  }`}
                />
              </div>
            </div>
          )}

          {/* Queue items */}
          <div className="divide-y divide-[var(--border)] max-h-[400px] overflow-y-auto">
            {queue.map((item) => {
              const vid = extractYoutubeId(item.url);
              return (
                <div key={item.id} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Status icon */}
                      {item.status === 'queued' && (
                        <span className="w-2 h-2 rounded-full bg-[var(--muted)] shrink-0" />
                      )}
                      {(item.status === 'downloading' || item.status === 'transcribing') && (
                        <Loader2 size={14} className="animate-spin text-red-400 shrink-0" />
                      )}
                      {item.status === 'done' && (
                        <CheckCircle size={14} className="text-green-400 shrink-0" />
                      )}
                      {item.status === 'error' && (
                        <AlertCircle size={14} className="text-red-400 shrink-0" />
                      )}

                      {/* URL or title */}
                      <span className={`text-sm truncate ${
                        item.status === 'done'
                          ? 'text-[var(--foreground)]'
                          : item.status === 'error'
                          ? 'text-red-400'
                          : 'text-[var(--muted)]'
                      }`}>
                        {item.status === 'done' && item.result
                          ? item.result.title
                          : item.url}
                      </span>

                      {/* Status badge */}
                      {item.status === 'queued' && (
                        <span className="text-[10px] uppercase text-[var(--muted)] bg-[var(--background)] px-1.5 py-0.5 rounded shrink-0">
                          Queued
                        </span>
                      )}
                      {item.status === 'done' && item.result?.duration && (
                        <span className="text-[10px] text-[var(--muted)] shrink-0">
                          {formatDuration(item.result.duration)}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {item.status === 'done' && item.result && (
                        <>
                          <button
                            onClick={() => handleCopy(item.result!.text, item.id)}
                            className="p-1 rounded text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--background)] transition-all"
                            title="Copy transcript"
                          >
                            {copiedId === item.id ? (
                              <CheckCircle size={14} className="text-green-400" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                          <button
                            onClick={() => handleSave(item.result!, item.url)}
                            className="p-1 rounded text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--background)] transition-all"
                            title="Save transcription"
                          >
                            <Bookmark size={14} />
                          </button>
                        </>
                      )}
                      {item.status === 'error' && (
                        <span className="text-[10px] text-red-400 truncate max-w-[150px]">
                          {item.error}
                        </span>
                      )}
                      {(item.status === 'queued' || item.status === 'error') && (
                        <button
                          onClick={() => removeFromQueue(item.id)}
                          className="p-1 rounded text-[var(--muted)] hover:text-red-400 hover:bg-red-400/10 transition-all"
                          title="Remove"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expand done items */}
                  {item.status === 'done' && item.result && (
                    <div className="mt-2">
                      <button
                        onClick={() => setExpandedQueueId(expandedQueueId === item.id ? null : item.id)}
                        className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--accent)] transition-colors"
                      >
                        {expandedQueueId === item.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        {expandedQueueId === item.id ? 'Hide transcript' : 'Show transcript'}
                        <span className="text-[10px] ml-1">
                          ({item.result.segments.length} segments)
                        </span>
                      </button>

                      {expandedQueueId === item.id && (
                        <div className="mt-2 border-t border-[var(--border)] pt-2">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap text-[var(--foreground)] max-h-60 overflow-y-auto">
                            {item.result.text || '(no speech detected)'}
                          </p>
                          {item.result.segments.length > 0 && (
                            <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                              {item.result.segments.map((seg, i) => (
                                <div key={i} className="flex gap-3 text-xs text-[var(--muted)]">
                                  <span className="text-[var(--accent)] font-mono shrink-0 w-16">
                                    {formatDuration(seg.start)} - {formatDuration(seg.end)}
                                  </span>
                                  <span className="text-[var(--foreground)]">{seg.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Video link */}
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--accent)] hover:underline"
                          >
                            <ExternalLink size={12} />
                            Open video
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved History */}
      <div className="border border-[var(--border)] bg-[var(--panel)] rounded-lg">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-4 border-b border-[var(--border)] text-sm hover:bg-[var(--background)] transition-colors rounded-t-lg"
        >
          <div className="flex items-center gap-2">
            <History size={16} className="text-[var(--muted)]" />
            <span className="font-semibold">Saved Transcriptions</span>
            {history.length > 0 && (
              <span className="text-xs text-[var(--muted)]">({history.length})</span>
            )}
          </div>
          <span className="text-[var(--muted)] text-xs">
            {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>

        {showHistory && (
          <div className="divide-y divide-[var(--border)]">
            {history.length === 0 ? (
              <div className="p-6 text-center text-sm text-[var(--muted)]">
                No transcriptions saved yet. Transcribe a video and save it!
              </div>
            ) : (
              history.map((item) => {
                const parsedSegments = item.segments
                  ? (() => { try { return JSON.parse(item.segments); } catch { return null; } })()
                  : null;
                const isExpanded = expandedId === item.id;

                return (
                  <div key={item.id} className="transition-colors">
                    <div
                      className="p-4 hover:bg-[var(--background)] transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Youtube size={14} className="text-red-400 shrink-0" />
                            <h3 className="text-sm font-semibold truncate">{item.title}</h3>
                            <span className="text-[10px] uppercase text-[var(--muted)] bg-[var(--background)] px-1.5 py-0.5 rounded">
                              {item.language}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                            <span>{formatDate(item.createdAt)}</span>
                            {item.duration && <span>&middot; {formatDuration(item.duration)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 rounded text-[var(--muted)] hover:text-[var(--accent)] hover:bg-[var(--background)] transition-all"
                            title="Open video"
                          >
                            <ExternalLink size={14} />
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); openExtract(item); }}
                            className="p-1.5 rounded text-[var(--muted)] hover:text-purple-400 hover:bg-purple-400/10 transition-all"
                            title="Extract lessons from this transcript"
                          >
                            <Brain size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                            className="p-1.5 rounded text-[var(--muted)] hover:text-red-400 hover:bg-red-400/10 transition-all"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4">
                        <div className="border-t border-[var(--border)] pt-3">
                          <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">
                            {item.text}
                          </p>
                          {parsedSegments && parsedSegments.length > 0 && (
                            <div className="mt-3 space-y-1 max-h-32 overflow-y-auto">
                              {parsedSegments.map((seg: any, i: number) => (
                                <div key={i} className="flex gap-3 text-xs text-[var(--muted)]">
                                  <span className="text-[var(--accent)] font-mono shrink-0 w-16">
                                    {formatDuration(seg.start)} - {formatDuration(seg.end)}
                                  </span>
                                  <span className="text-[var(--foreground)]">{seg.text}</span>
                                </div>
                              ))}
                            </div>
                          )}
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
      {/* ── Persona Picker Overlay ── */}
      {showPersonaPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowPersonaPicker(null)}
        >
          <div
            className="bg-[var(--panel)] border border-[var(--border)] p-5 w-full max-w-sm mx-4 rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-3">
              Extract Lessons to Persona
            </h3>
            <p className="text-xs text-[var(--muted)] mb-4">
              Select a persona to extract lessons into. The transcript will also be saved as an example.
            </p>
            {personas.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">No personas yet. Create one first.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {personas.map((p) => {
                  const item = history.find((h) => h.id === showPersonaPicker);
                  return (
                    <button
                      key={p.id}
                      onClick={() => item && handleExtract(item, p.id)}
                      disabled={extractingId === showPersonaPicker}
                      className="w-full text-left px-3 py-2.5 text-sm rounded-lg border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-all disabled:opacity-50"
                    >
                      <span className="text-[var(--foreground)] font-medium">{p.name}</span>
                      {extractingId === showPersonaPicker && (
                        <Loader2 size={12} className="animate-spin ml-2 inline" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <button
              onClick={() => setShowPersonaPicker(null)}
              className="mt-3 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
