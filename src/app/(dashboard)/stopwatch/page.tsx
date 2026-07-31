'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Timer, Play, Square, RotateCcw, Flag, Copy, Check } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Lap {
  number: number;
  lapTime: number;   // ms
  totalTime: number; // ms
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(ms: number): string {
  const totalCentiseconds = Math.floor(ms / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function formatLapTime(ms: number): string {
  // Same format but without hours if 0
  const totalCentiseconds = Math.floor(ms / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(totalCentiseconds / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function getBestAndWorst(laps: Lap[]): { bestIndex: number; worstIndex: number } {
  if (laps.length < 2) return { bestIndex: -1, worstIndex: -1 };
  let bestIndex = 0;
  let worstIndex = 0;
  for (let i = 1; i < laps.length; i++) {
    if (laps[i].lapTime < laps[bestIndex].lapTime) bestIndex = i;
    if (laps[i].lapTime > laps[worstIndex].lapTime) worstIndex = i;
  }
  return { bestIndex, worstIndex };
}

function exportLapsAsText(laps: Lap[]): string {
  return laps
    .map((lap) => `Lap ${lap.number}: ${formatLapTime(lap.lapTime)}`)
    .join('\n');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StopwatchPage() {
  const [time, setTime] = useState(0);       // ms elapsed
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [copied, setCopied] = useState(false);

  const startTimeRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // ── Timer logic ──────────────────────────────────────────────────────────

  const tick = useCallback((timestamp: number) => {
    if (startTimeRef.current === null) return;
    const elapsed = elapsedRef.current + (timestamp - startTimeRef.current);
    setTime(elapsed);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const start = useCallback(() => {
    if (running) return;
    startTimeRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    setRunning(true);
  }, [running, tick]);

  const stop = useCallback(() => {
    if (!running) return;
    if (startTimeRef.current !== null) {
      elapsedRef.current += performance.now() - startTimeRef.current;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startTimeRef.current = null;
    setRunning(false);
  }, [running]);

  const reset = useCallback(() => {
    stop();
    setTime(0);
    setLaps([]);
    elapsedRef.current = 0;
    startTimeRef.current = null;
  }, [stop]);

  const lap = useCallback(() => {
    const totalTime = elapsedRef.current + (startTimeRef.current !== null ? performance.now() - startTimeRef.current : 0);
    const lastLapTime = laps.length > 0 ? laps[laps.length - 1].totalTime : 0;
    const lapTime = totalTime - lastLapTime;

    setLaps((prev) => [
      ...prev,
      { number: prev.length + 1, lapTime, totalTime },
    ]);
  }, [laps]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (running) stop();
          else start();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          if (running) lap();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          reset();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [running, start, stop, lap, reset]);

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // ── Copy export ──────────────────────────────────────────────────────────

  const handleCopyLaps = async () => {
    if (laps.length === 0) return;
    const text = exportLapsAsText(laps);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Derivatives ──────────────────────────────────────────────────────────

  const { bestIndex, worstIndex } = getBestAndWorst(laps);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-12 md:py-20">
      {/* Title */}
      <div className="flex items-center gap-2 mb-8">
        <Timer size={22} className="text-[var(--accent)]" />
        <h1 className="text-xl font-bold text-[var(--foreground)]">Stopwatch</h1>
      </div>

      {/* Time display */}
      <div className="font-mono text-[4rem] md:text-[6rem] lg:text-[7rem] font-bold leading-none tracking-wider text-[var(--foreground)] select-none tabular-nums">
        {formatTime(time)}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 mt-10">
        {/* Reset */}
        <button
          onClick={reset}
          className="w-14 h-14 rounded-full flex items-center justify-center border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-all"
          title="Reset (R)"
        >
          <RotateCcw size={20} />
        </button>

        {/* Start / Stop */}
        <button
          onClick={running ? stop : start}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
            running
              ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/30'
              : 'bg-[var(--accent)] text-[var(--background)] hover:brightness-110 shadow-[var(--accent)]/30'
          }`}
          title={running ? 'Stop (Space)' : 'Start (Space)'}
        >
          {running ? <Square size={28} /> : <Play size={28} className="ml-1" />}
        </button>

        {/* Lap */}
        <button
          onClick={lap}
          disabled={!running}
          className="w-14 h-14 rounded-full flex items-center justify-center border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title="Lap (L)"
        >
          <Flag size={20} />
        </button>
      </div>

      {/* Keyboard hints */}
      <div className="flex items-center gap-4 mt-4 text-[11px] text-[var(--muted)]">
        <span>
          <kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] text-[10px] font-mono">
            Space
          </kbd>{' '}
          Start/Stop
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] text-[10px] font-mono">
            L
          </kbd>{' '}
          Lap
        </span>
        <span>
          <kbd className="px-1.5 py-0.5 rounded border border-[var(--border)] text-[10px] font-mono">
            R
          </kbd>{' '}
          Reset
        </span>
      </div>

      {/* Laps section */}
      {laps.length > 0 && (
        <div className="w-full max-w-md mt-12">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              Laps
            </h2>
            <button
              onClick={handleCopyLaps}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)] transition-all"
            >
              {copied ? (
                <>
                  <Check size={13} className="text-[var(--accent)]" />
                  <span className="text-[var(--accent)]">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Export</span>
                </>
              )}
            </button>
          </div>

          {/* Lap table */}
          <div className="rounded-lg border border-[var(--border)] overflow-hidden">
            <div className="max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--panel)]">
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left px-4 py-2 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Lap
                    </th>
                    <th className="text-right px-4 py-2 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Lap Time
                    </th>
                    <th className="text-right px-4 py-2 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">
                      Total Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...laps].reverse().map((lap) => {
                    const isBest = bestIndex >= 0 && lap.number === laps[bestIndex].number;
                    const isWorst = worstIndex >= 0 && lap.number === laps[worstIndex].number;
                    return (
                      <tr
                        key={lap.number}
                        className={`border-b border-[var(--border)] last:border-b-0 transition-colors ${
                          isBest
                            ? 'bg-green-500/5'
                            : isWorst
                            ? 'bg-red-500/5'
                            : 'hover:bg-[var(--background)]'
                        }`}
                      >
                        <td className="px-4 py-2.5 text-[var(--muted)] font-medium">
                          <div className="flex items-center gap-2">
                            Lap {lap.number}
                            {isBest && (
                              <span className="text-[10px] font-medium text-green-400">Best</span>
                            )}
                            {isWorst && (
                              <span className="text-[10px] font-medium text-red-400">Worst</span>
                            )}
                          </div>
                        </td>
                        <td
                          className={`px-4 py-2.5 font-mono text-right tabular-nums ${
                            isBest
                              ? 'text-green-400'
                              : isWorst
                              ? 'text-red-400'
                              : 'text-[var(--foreground)]'
                          }`}
                        >
                          {formatLapTime(lap.lapTime)}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-right tabular-nums text-[var(--muted)]">
                          {formatLapTime(lap.totalTime)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
