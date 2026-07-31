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
}

interface FocusContextValue {
  focus: FocusState;
  startFocus: (duration: number, breakDuration?: number, taskId?: string, taskTitle?: string) => Promise<void>;
  pauseFocus: () => void;
  resumeFocus: () => void;
  stopFocus: () => Promise<void>;
  skipBreak: () => void;
  setOnStopHandler: (handler: (() => void) | null) => void;
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
};

const STORAGE_KEY = 'focus-timer-state';

function saveToStorage(state: FocusState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, lastTick: Date.now() }));
  } catch (error) { console.error('[Focus]', error); }
}

function loadFromStorage(): FocusState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as FocusState;
    if (saved.isRunning && saved.lastTick) {
      const elapsed = Math.floor((Date.now() - saved.lastTick) / 1000);
      if (elapsed > 0) {
        saved.timeRemaining = Math.max(0, saved.timeRemaining - elapsed);
      }
    }
    saved.lastTick = null;
    return saved;
  } catch (error) { console.error('[Focus]', error); return null; }
}

function clearStorage() {
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
  focusRef.current = focus;

  // Save to localStorage on every meaningful state change
  useEffect(() => {
    if (focus.isRunning || focus.isBreak || focus.isPaused) {
      saveToStorage(focus);
    } else {
      clearStorage();
    }
  }, [focus]);

  // Tick function — uses delta tracking for accurate timing
  const startTicking = useCallback(() => {
    clearTimer();
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const current = focusRef.current;
      if (!current.isRunning && !current.isBreak) {
        clearTimer();
        return;
      }

      // Use delta tracking for accurate timing
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const next = current.totalDuration - elapsed;

      if (next > 0) {
        setFocus((prev) => ({ ...prev, timeRemaining: next }));
      } else {
        // Timer hit zero
        clearTimer();
        const bd = current.breakDuration;

        if (current.isBreak) {
          // Break ended → back to idle
          setFocus({ ...defaultFocus });
        } else {
          // Focus ended → auto-start break
          const breakSec = bd * 60;
          setFocus((prev) => ({
            ...prev,
            isRunning: true,
            isBreak: true,
            timeRemaining: breakSec,
            totalDuration: breakSec,
            completedPomodoros: prev.completedPomodoros + 1,
          }));
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
    if (focus.isRunning && focus.timeRemaining > 0 && !intervalRef.current) {
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
      });
      startTicking();
    } catch (error) { console.error('[Focus]', error); }
  }, [clearTimer, startTicking]);

  const pauseFocus = useCallback(() => {
    clearTimer();
    setFocus((prev) => ({ ...prev, isRunning: false, isPaused: true }));
  }, [clearTimer]);

  const resumeFocus = useCallback(() => {
    clearTimer();
    const current = focusRef.current;
    if (current.timeRemaining <= 0 || (!current.isRunning && !current.isBreak)) return;
    setFocus((prev) => ({ ...prev, isPaused: false }));
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

  // Expose isRunning as a computed value (excludes paused)
  const computedFocus = { ...focus, isRunning: focus.isRunning && !focus.isPaused };

  return (
    <FocusContext.Provider value={{ focus: computedFocus, startFocus, pauseFocus, resumeFocus, stopFocus, skipBreak, setOnStopHandler }}>
      {children}
    </FocusContext.Provider>
  );
}

export function useFocus() {
  const ctx = useContext(FocusContext);
  if (!ctx) throw new Error('useFocus must be used within FocusProvider');
  return ctx;
}
