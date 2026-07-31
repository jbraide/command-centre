'use client';

import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';

export interface TranscriptResult {
  title: string;
  duration: number | null;
  language: string;
  text: string;
  segments: { start: number; end: number; text: string }[];
}

export interface QueueItem {
  id: string;
  url: string;
  status: 'queued' | 'downloading' | 'transcribing' | 'done' | 'error';
  result?: TranscriptResult;
  error?: string;
}

interface TranscriptionQueueContextValue {
  queue: QueueItem[];
  addToQueue: (url: string) => void;
  removeFromQueue: (id: string) => void;
  clearCompleted: () => void;
  isProcessing: boolean;
}

const TranscriptionQueueContext = createContext<TranscriptionQueueContextValue | null>(null);

let queueIdCounter = 100;
const STORAGE_KEY = 'yt-queue';

function saveQueue(queue: QueueItem[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue.filter((q) => q.status !== 'done' && q.status !== 'error')));
  }
}

function loadQueue(): QueueItem[] {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }
  }
  return [];
}

export function TranscriptionQueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);

  // Restore queue from localStorage on mount
  useEffect(() => {
    const saved = loadQueue();
    if (saved.length > 0) {
      setQueue(saved.map((q) => ({ ...q, status: 'queued' as const })));
    }
  }, []);

  // Persist queue to localStorage on changes
  useEffect(() => {
    saveQueue(queue);
  }, [queue]);

  const addToQueue = useCallback((url: string) => {
    if (queue.some((q) => q.url === url && (q.status === 'queued' || q.status === 'downloading' || q.status === 'transcribing'))) {
      toast.error('Already in queue');
      return;
    }
    setQueue((prev) => [...prev, { id: `q-${++queueIdCounter}`, url, status: 'queued' }]);
  }, [queue]);

  const removeFromQueue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setQueue((prev) => prev.filter((q) => q.status === 'queued' || q.status === 'downloading' || q.status === 'transcribing'));
  }, []);

  // Process one item per effect trigger
  useEffect(() => {
    if (processingRef.current) return;
    const next = queue.find((i) => i.status === 'queued');
    if (!next) {
      setIsProcessing(false);
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);

    // Extract local copies to avoid stale closure issues in Strict Mode
    const nextId = next.id;
    const nextUrl = next.url;

    setQueue((prev) =>
      prev.map((i) => (i.id === nextId ? { ...i, status: 'downloading' as const } : i))
    );

    (async () => {
      let result: TranscriptResult | null = null;
      let error: string | null = null;

      try {
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: nextUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Transcription failed');
        result = data;
        toast.success(`Transcribed: ${result!.title}`);
      } catch (err) {
        error = err instanceof Error ? err.message : 'Something went wrong';
        toast.error(`Failed: ${nextUrl.slice(0, 40)}...`);
      }

      setQueue((prev) =>
        prev.map((i) =>
          i.id === nextId
            ? { ...i, status: result ? 'done' as const : 'error' as const, result: result || undefined, error: error || undefined }
            : i
        )
      );

      processingRef.current = false;
    })();
  }, [queue]);

  return (
    <TranscriptionQueueContext.Provider value={{ queue, addToQueue, removeFromQueue, clearCompleted, isProcessing }}>
      {children}
    </TranscriptionQueueContext.Provider>
  );
}

export function useTranscriptionQueue() {
  const ctx = useContext(TranscriptionQueueContext);
  if (!ctx) throw new Error('useTranscriptionQueue must be used within TranscriptionQueueProvider');
  return ctx;
}
