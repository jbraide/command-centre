'use client';

import { createContext, useContext, useState, useRef, useEffect, useCallback, type ReactNode } from 'react';

interface FocusState {
  isRunning: boolean;
  isBreak: boolean;
  isPaused: boolean;
  timeRemaining: number;
  totalDuration: number;
  sessionId: string | null;
  taskId: string | null;
  taskTitle: string | null;
  completedPomodoros: number;
  lastTick: number | null;
  breakDuration: number;
  /** Absolute epoch ms when the current running phase ends; null when idle/paused. */
  endAt: number | null;
}

interface FocusContextValue {
  focus: FocusState;
  startFocus: (duration: number, breakDuration?: number, taskId?: string, taskTitle?: string) => Promise<void>;
  pauseFocus: () => void;
  resumeFocus: () => void;
  stopFocus: () => Promise<void>;
  skipBreak: () => void;
  setOnStopHandler: (handler: (() => void) | null) => void;
  setAutoStartBreakPref: (value: boolean) => void;
}

const defaultFocus: FocusState = {
  isRunning: false,
  isBreak: false,
  isPaused: false,
  timeRemaining: 0,
  totalDuration: 0,
  sessionId: null,
  taskId: null,
  taskTitle: null,
  completedPomodoros: 0,
  lastTick: null,
  breakDuration: 5,
  endAt: null,
};

const STORAGE_KEY = 'focus-timer-state';

function saveToStorage(state: FocusState) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) { console.error('[Focus]', error); }
}

function loadFromStorage(): FocusState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as FocusState;
    if (saved.isRunning && typeof saved.endAt === 'number') {
      // Absolute deadline: every tab derives the same remaining time from it.
      saved.timeRemaining = Math.max(0, Math.round((saved.endAt - Date.now()) / 1000));
    } else if (saved.isRunning && saved.lastTick) {
      // Legacy fallback for states persisted before endAt existed.
      const elapsed = Math.floor((Date.now() - saved.lastTick) / 1000);
      if (elapsed > 0) {
        saved.timeRemaining = Math.max(0, saved.timeRemaining - elapsed);
      }
    }
    saved.lastTick = null;
    if (!saved.isRunning) {
      // Paused/idle states must not carry a stale deadline.
      saved.endAt = null;
    }
    if (saved.isRunning && saved.timeRemaining <= 0) {
      // Persisted as running but the deadline has already passed → expired.
      clearStorage();
      return null;
    }
    return saved;
  } catch (error) { console.error('[Focus]', error); return null; }
}

function clearStorage() {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch (error) { console.error('[Focus]', error); }
}

const FocusContext = createContext<FocusContextValue | null>(null);

export function FocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<FocusState>(() => {
    const saved = loadFromStorage();
    return saved || defaultFocus;
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const focusRef = useRef(focus);
  const onStopRef = useRef<(() => void) | null>(null);
  const autoStartBreakRef = useRef(true);
  focusRef.current = focus;

  // Save to localStorage on every meaningful state change
  useEffect(() => {
    if (focus.isRunning || focus.isBreak || focus.isPaused) {
      saveToStorage(focus);
    } else {
      clearStorage();
    }
  }, [focus]);

  // Cross-tab sync: mirror writes/clears from other tabs, but only when the
  // reloaded state actually differs, otherwise we'd write straight back and
  // ping-pong with the other tab forever.
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY && e.key !== null) return;
      const reloaded = loadFromStorage();
      const cur = focusRef.current;
      if (!reloaded) {
        // Storage was cleared (another tab went idle) — mirror it unless we
        // are already idle.
        if (cur.isRunning || cur.isBreak || cur.isPaused) {
          setFocus({ ...defaultFocus });
        }
        return;
      }
      const changed =
        cur.endAt !== reloaded.endAt ||
        cur.isRunning !== reloaded.isRunning ||
        cur.isBreak !== reloaded.isBreak ||
        cur.isPaused !== reloaded.isPaused ||
        cur.timeRemaining !== reloaded.timeRemaining;
      if (changed) setFocus(reloaded);
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Tick function — derives remaining time from the absolute end deadline so
  // every tab (and any throttled background tab) computes the same value.
  const startTicking = useCallback(() => {
    clearTimer();
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const current = focusRef.current;
      if ((!current.isRunning && !current.isBreak) || current.isPaused) {
        clearTimer();
        return;
      }

      // Compute from the current endAt; fall back to delta tracking if the
      // deadline is missing (defensive / legacy state).
      const next =
        typeof current.endAt === 'number'
          ? Math.max(0, Math.round((current.endAt - Date.now()) / 1000))
          : current.totalDuration - Math.floor((Date.now() - startTime) / 1000);

      if (next > 0) {
        setFocus((prev) => ({ ...prev, timeRemaining: next }));
      } else {
        // Timer hit zero
        clearTimer();
        const bd = current.breakDuration;

        if (current.isBreak) {
          // Break ended → back to idle
          setFocus({ ...defaultFocus });
        } else if (autoStartBreakRef.current === false) {
          // Focus ended and auto-start breaks is off → session is done, stop.
          setFocus({ ...defaultFocus });
        } else {
          // Focus ended → auto-start break, with its own deadline, and keep
          // ticking so the break actually counts down.
          const breakSec = bd * 60;
          setFocus((prev) => ({
            ...prev,
            isRunning: true,
            isBreak: true,
            timeRemaining: breakSec,
            totalDuration: breakSec,
            endAt: Date.now() + breakSec * 1000,
            completedPomodoros: prev.completedPomodoros + 1,
          }));
          startTicking();
        }
      }
    }, 1000);
  }, []);

  // Actual cleanup that sets ref to null
  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Restore timer on mount if it was running (survives refresh)
  useEffect(() => {
    const current = focusRef.current;
    if (current.isRunning && !current.isPaused && current.timeRemaining > 0 && !intervalRef.current) {
      // Recompute from the absolute deadline: a throttled background tab
      // corrects its remaining time before the tick loop starts.
      if (typeof current.endAt === 'number') {
        const remaining = Math.max(0, Math.round((current.endAt - Date.now()) / 1000));
        if (remaining <= 0) {
          // Expired while we were away → end the session cleanly.
          clearTimer();
          setFocus({ ...defaultFocus });
          clearStorage();
          return;
        }
        setFocus((prev) => ({ ...prev, timeRemaining: remaining }));
      }
      startTicking();
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startFocus = useCallback(async (duration: number, breakDuration?: number, taskId?: string, taskTitle?: string) => {
    clearTimer();
    const bd = breakDuration ?? 5;
    try {
      const res = await fetch('/api/focus/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, duration, breakDuration: bd }),
      });
      if (!res.ok) throw new Error();
      const session = await res.json();
      const totalSec = duration * 60;
      setFocus({
        isRunning: true, isBreak: false, isPaused: false,
        timeRemaining: totalSec, totalDuration: totalSec,
        sessionId: session.id, taskId: taskId || null, taskTitle: taskTitle || null,
        completedPomodoros: 0, lastTick: null, breakDuration: bd,
        endAt: Date.now() + totalSec * 1000,
      });
      startTicking();
    } catch (error) { console.error('[Focus]', error); }
  }, [clearTimer, startTicking]);

  const pauseFocus = useCallback(() => {
    clearTimer();
    // Keep the session mode flag (isRunning) intact — only flag the pause and
    // drop the deadline so a paused timer isn't tied to a stale endAt.
    setFocus((prev) => ({ ...prev, isPaused: true, endAt: null }));
  }, [clearTimer]);

  const resumeFocus = useCallback(() => {
    clearTimer();
    const current = focusRef.current;
    if (current.timeRemaining <= 0) return;
    // Re-establish the absolute deadline from the remaining time.
    const endAt = Date.now() + current.timeRemaining * 1000;
    setFocus((prev) => ({ ...prev, isPaused: false, endAt }));
    startTicking();
  }, [clearTimer, startTicking]);

  const stopFocus = useCallback(async () => {
    clearTimer();
    onStopRef.current?.();
    const sid = focusRef.current.sessionId;
    if (sid) {
      try {
        await fetch(`/api/focus/sessions/${sid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endedAt: new Date().toISOString() }),
        });
      } catch (error) { console.error('[Focus]', error); }
    }
    setFocus({ ...defaultFocus });
  }, [clearTimer]);

  const skipBreak = useCallback(() => {
    clearTimer();
    setFocus({ ...defaultFocus });
  }, [clearTimer]);

  const setOnStopHandler = useCallback((handler: (() => void) | null) => {
    onStopRef.current = handler;
  }, []);

  const setAutoStartBreakPref = useCallback((value: boolean) => {
    autoStartBreakRef.current = value;
  }, []);

  // Expose isRunning as a computed value (excludes paused)
  const computedFocus = { ...focus, isRunning: focus.isRunning && !focus.isPaused };

  return (
    <FocusContext.Provider value={{ focus: computedFocus, startFocus, pauseFocus, resumeFocus, stopFocus, skipBreak, setOnStopHandler, setAutoStartBreakPref }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error('useFocus must be used within FocusProvider');
  return ctx;
}
