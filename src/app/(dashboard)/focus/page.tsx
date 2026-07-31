'use client';

import { useState, useEffect, useRef } from 'react';
import { useFocus } from '@/lib/focus-context';
import {
  Play,
  Pause,
  Square,
  Settings,
  Volume2,
  VolumeX,
  ChevronDown,
  ChevronUp,
  Timer,
  Coffee,
} from 'lucide-react';

/* ─── Types ───────────────────────────────────── */

interface Task {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
}

interface FocusSession {
  id: string;
  taskId: string | null;
  duration: number;
  breakDuration: number;
  completedPomodoros: number;
  startedAt: string;
  endedAt: string | null;
}

type TimerMode = 'focus' | 'break';

/* ─── Web Audio API Sounds ────────────────────── */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private activeNodes: AudioNode[] = [];
  private _intervals: ReturnType<typeof setInterval>[] = [];
  private _volume = 0.5;
  private _currentSound: string | null = null;
  private _playing = false;

  get volume() { return this._volume; }
  set volume(v: number) { this._volume = v; this.updateVolume(); }
  get currentSound() { return this._currentSound; }
  get playing() { return this._playing; }

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  private updateVolume() {
    // Volume is applied per-source via gain nodes
  }

  private createGain(): GainNode {
    const ctx = this.getContext();
    const gain = ctx.createGain();
    gain.gain.value = this._volume * 0.3;
    gain.connect(ctx.destination);
    return gain;
  }

  stop() {
    this._playing = false;
    this._currentSound = null;
    this._intervals.forEach(clearInterval);
    this._intervals = [];
    this.activeNodes.forEach((n) => {
      try { (n as AudioScheduledSourceNode).stop?.(); } catch {}
    });
    this.activeNodes = [];
  }

  play(type: string) {
    this.stop();
    this._playing = true;
    this._currentSound = type;

    const ctx = this.getContext();
    if (ctx.state === 'suspended') ctx.resume();

    switch (type) {
      case 'rain': this.playRain(); break;
      case 'ocean': this.playOcean(); break;
      case 'forest': this.playForest(); break;
      case 'whitenoise': this.playWhiteNoise(); break;
      case 'coffeeshop': this.playCoffeeShop(); break;
      default: this._playing = false; this._currentSound = null; break;
    }
  }

  private createNoiseBuffer(): AudioBuffer {
    const ctx = this.getContext();
    const sr = ctx.sampleRate;
    const len = sr * 4;
    const buf = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private playNoiseSource(filterFreq?: number, modSpeed = 0): AudioNode[] {
    const ctx = this.getContext();
    const buf = this.createNoiseBuffer();
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    let lastNode: AudioNode = src;

    if (filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      if (modSpeed > 0) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = modSpeed;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = filterFreq * 0.3;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();
        this.activeNodes.push(lfo, lfoGain);
      }
      src.connect(filter);
      lastNode = filter;
    }

    const gain = ctx.createGain();
    gain.gain.value = this._volume * 0.25;
    lastNode.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this.activeNodes.push(src, lastNode, gain);
    if (filterFreq && modSpeed === 0) this.activeNodes.push(lastNode);
    return [src, gain];
  }

  private playRain() {
    this.playNoiseSource(800, 0);
  }

  private playOcean() {
    this.playNoiseSource(400, 0.05);
  }

  private playWhiteNoise() {
    this.playNoiseSource(undefined);
  }

  private playForest() {
    const ctx = this.getContext();
    // Background noise layer
    this.playNoiseSource(1500, 0.1);

    // Birdsong-like high-frequency tones
    const birdInterval = setInterval(() => {
      if (!this._playing) { clearInterval(birdInterval); return; }
      this.playBirdChirp();
    }, 2000 + Math.random() * 3000);
    this._intervals.push(birdInterval);
  }

  private playBirdChirp() {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 2000 + Math.random() * 3000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(this._volume * 0.15, ctx.currentTime + 0.02);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1 + Math.random() * 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    this.activeNodes.push(osc, gain);
  }

  private playCoffeeShop() {
    const ctx = this.getContext();
    // Background murmur
    this.playNoiseSource(600, 0);

    // Random low thumps (like mugs on tables)
    const thumpInterval = setInterval(() => {
      if (!this._playing) { clearInterval(thumpInterval); return; }
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 80 + Math.random() * 40;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(this._volume * 0.2, ctx.currentTime + 0.02);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);
      this.activeNodes.push(osc, gain);
    }, 800 + Math.random() * 2000);
    this._intervals.push(thumpInterval);
  }
}

/* ─── Timer Beep ───────────────────────────────── */

function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 880;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

function playAlarm() {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 880 + i * 100;
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.3;
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    }
  } catch {}
}

/* ─── Main Component ──────────────────────────── */

export default function FocusPage() {
  /* Timer state — global context (persists across pages) */
  const { focus, startFocus, pauseFocus, resumeFocus, stopFocus, skipBreak, setOnStopHandler } = useFocus();

  /* Local settings */
  const [focusDuration, setFocusDuration] = useState(25); // minutes
  const [breakDuration, setBreakDuration] = useState(5); // minutes
  const [longBreakAfter, setLongBreakAfter] = useState(4);
  const [autoStartBreak, setAutoStartBreak] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  /* UI state */
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundPanelOpen, setSoundPanelOpen] = useState(false);

  /* Sound engine */
  const soundEngineRef = useRef<SoundEngine>(new SoundEngine());
  const [selectedSound, setSelectedSound] = useState<string | null>(null);
  const [soundVolume, setSoundVolume] = useState(0.5);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);

  /* Timer display values from context */
  const timeLeft = focus.timeRemaining;
  const totalTime = focus.totalDuration || focusDuration * 60;
  const progress = totalTime > 0 ? 1 - timeLeft / totalTime : 0;
  const isRunning = focus.isRunning;
  const isBreak = focus.isBreak;
  const pomodoroCount = focus.completedPomodoros;

  /* ── Fetch tasks ─────────────────────────────── */
  useEffect(() => {
    fetch('/api/focus/tasks')
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Task[]) => setTasks(data))
      .catch(() => {});
  }, []);

  /* ── SoundEngine cleanup on unmount ──────────── */
  useEffect(() => {
    return () => {
      soundEngineRef.current.stop();
    };
  }, []);

  /* ── Wire onStop handler ─────────────────────── */
  useEffect(() => {
    setOnStopHandler(() => {
      soundEngineRef.current.stop();
      setIsSoundPlaying(false);
      setSelectedSound(null);
    });
    return () => setOnStopHandler(null);
  }, [setOnStopHandler]);

  /* ── Handlers using global context ────────────── */

  const handleStart = async () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const task = tasks.find((t) => t.id === selectedTaskId);
    await startFocus(focusDuration, breakDuration, selectedTaskId || undefined, task?.title);
  };

  const handlePause = () => pauseFocus();
  const handleResume = () => resumeFocus();
  const handleStop = async () => {
    await stopFocus();
    setSelectedTaskId(null);
  };

  /* ── Settings handlers ───────────────────────── */
  const handleFocusDurationChange = (mins: number) => {
    setFocusDuration(mins);
  };

  const handleBreakDurationChange = (mins: number) => {
    setBreakDuration(mins);
  };

  /* ── Sound panel handlers ────────────────────── */
  const handleSoundSelect = (type: string | null) => {
    const engine = soundEngineRef.current;
    if (type === null || type === selectedSound) {
      engine.stop();
      setSelectedSound(null);
      setIsSoundPlaying(false);
      return;
    }
    engine.volume = soundVolume;
    engine.play(type);
    setSelectedSound(type);
    setIsSoundPlaying(true);
  };

  const handleVolumeChange = (v: number) => {
    setSoundVolume(v);
    soundEngineRef.current.volume = v;
  };

  const handleSoundToggle = () => {
    const engine = soundEngineRef.current;
    if (isSoundPlaying) {
      engine.stop();
      setIsSoundPlaying(false);
      setSelectedSound(null);
    } else if (selectedSound) {
      engine.volume = soundVolume;
      engine.play(selectedSound);
      setIsSoundPlaying(true);
    }
  };

  /* ── Format time ─────────────────────────────── */
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  /* ── SVG ring parameters ─────────────────────── */
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  /* ── Render ──────────────────────────────────── */
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Timer size={20} className="text-[var(--accent)]" />
        <h1 className="text-xl font-bold text-[var(--foreground)]">Focus Timer</h1>
      </div>

      {/* ── Timer Display ─────────────────────────── */}
      <div className="flex flex-col items-center py-6">
        <div className="relative w-64 h-64 flex items-center justify-center">
          {/* SVG progress ring */}
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 256 256">
            <circle
              cx="128" cy="128" r={radius}
              fill="none"
              stroke="var(--border)"
              strokeWidth="6"
            />
            <circle
              cx="128" cy="128" r={radius}
              fill="none"
              stroke={isBreak ? 'var(--warning)' : 'var(--accent)'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>

          {/* Time display */}
          <div className="text-center z-10">
            <div className={`text-6xl font-bold tabular-nums tracking-tight ${isBreak ? 'text-[var(--warning)]' : 'text-[var(--foreground)]'}`}>
              {formatTime(timeLeft)}
            </div>
            <div className="mt-2 text-sm text-[var(--muted)]">
              {isBreak ? 'Break time' : 'Focus time'}
            </div>
          </div>
        </div>

        {/* Session counter */}
        <div className="mt-4 text-sm text-[var(--muted)]">
          {isBreak ? (
            <span className="flex items-center gap-1.5">
              <Coffee size={14} />
              Break — {formatTime(timeLeft)} remaining
            </span>
          ) : (
            <span>Pomodoro {pomodoroCount + 1}/{longBreakAfter}</span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 mt-6">
          {!isRunning && timeLeft > 0 && timeLeft < totalTime ? (
            <button
              onClick={handleResume}
              className="flex items-center gap-2 border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] px-5 py-2 text-sm font-semibold hover:bg-[var(--accent)]/20 transition-colors"
            >
              <Play size={16} />
              Resume
            </button>
          ) : !isRunning ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-2 border border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] px-5 py-2 text-sm font-semibold hover:bg-[var(--accent)]/20 transition-colors"
            >
              <Play size={16} />
              Start
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 border border-[var(--warning)] bg-[var(--warning)]/10 text-[var(--warning)] px-5 py-2 text-sm font-semibold hover:bg-[var(--warning)]/20 transition-colors"
            >
              <Pause size={16} />
              Pause
            </button>
          )}

          <button
            onClick={handleStop}
            disabled={!focus.sessionId && !isRunning}
            className="flex items-center gap-2 border border-[var(--danger)]/50 text-[var(--danger)] px-5 py-2 text-sm font-semibold hover:bg-[var(--danger)]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Square size={16} />
            Stop
          </button>
        </div>
      </div>

      {/* ── Task Selector ─────────────────────────── */}
      <div className="border border-[var(--border)] bg-[var(--panel)] p-4">
        <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-2">
          Linked Task
        </label>
        <select
          value={selectedTaskId ?? ''}
          onChange={(e) => setSelectedTaskId(e.target.value || null)}
          className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
        >
          <option value="">No task selected</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title} — {task.projectName}
            </option>
          ))}
        </select>
      </div>

      {/* ── Settings Panel ────────────────────────── */}
      <div className="border border-[var(--border)] bg-[var(--panel)]">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full flex items-center justify-between p-4 text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
        >
          <span className="flex items-center gap-2">
            <Settings size={16} />
            Settings
          </span>
          {settingsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {settingsOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-[var(--border)] pt-4">
            {/* Focus duration */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-2">
                Focus Duration
              </label>
              <div className="flex flex-wrap gap-2">
                {[15, 25, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => handleFocusDurationChange(mins)}
                    className={`px-4 py-1.5 text-sm border transition-colors ${
                      focusDuration === mins
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </div>

            {/* Break duration */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-2">
                Break Duration
              </label>
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => handleBreakDurationChange(mins)}
                    className={`px-4 py-1.5 text-sm border transition-colors ${
                      breakDuration === mins
                        ? 'border-[var(--warning)] bg-[var(--warning)]/10 text-[var(--warning)]'
                        : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
            </div>

            {/* Long break after */}
            <div>
              <label className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider block mb-2">
                Long Break After
              </label>
              <div className="flex flex-wrap gap-2">
                {[2, 4, 6].map((n) => (
                  <button
                    key={n}
                    onClick={() => setLongBreakAfter(n)}
                    className={`px-4 py-1.5 text-sm border transition-colors ${
                      longBreakAfter === n
                        ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                        : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {n} pomodoros
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-start breaks */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--foreground)]">Auto-start breaks</span>
              <button
                onClick={() => setAutoStartBreak(!autoStartBreak)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  autoStartBreak ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-[var(--background)] transition-transform ${
                    autoStartBreak ? 'translate-x-5' : 'translate-x-0.5'
                  } mt-0.5`}
                />
              </button>
            </div>

            {/* Sound toggle */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--foreground)]">Sound</span>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`w-10 h-5 rounded-full transition-colors ${
                  soundEnabled ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-[var(--background)] transition-transform ${
                    soundEnabled ? 'translate-x-5' : 'translate-x-0.5'
                  } mt-0.5`}
                />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Sound Panel ───────────────────────────── */}
      <div className="border border-[var(--border)] bg-[var(--panel)]">
        <button
          onClick={() => setSoundPanelOpen(!soundPanelOpen)}
          className="w-full flex items-center justify-between p-4 text-sm font-semibold text-[var(--foreground)] hover:text-[var(--accent)] transition-colors"
        >
          <span className="flex items-center gap-2">
            {isSoundPlaying ? <Volume2 size={16} /> : <VolumeX size={16} />}
            Focus Sounds
          </span>
          {soundPanelOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {soundPanelOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-[var(--border)] pt-4">
            {/* Sound presets */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'rain', label: 'Rain' },
                { id: 'forest', label: 'Forest' },
                { id: 'ocean', label: 'Ocean' },
                { id: 'whitenoise', label: 'White Noise' },
                { id: 'coffeeshop', label: 'Coffee Shop' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleSoundSelect(selectedSound === s.id ? null : s.id)}
                  className={`px-4 py-2 text-sm border transition-colors ${
                    selectedSound === s.id
                      ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                      : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--foreground)]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
              <button
                onClick={() => handleSoundSelect(null)}
                className={`px-4 py-2 text-sm border transition-colors ${
                  selectedSound === null && !isSoundPlaying
                    ? 'border-[var(--danger)] bg-[var(--danger)]/10 text-[var(--danger)]'
                    : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]'
                }`}
              >
                None
              </button>
            </div>

            {/* Volume slider */}
            <div className="flex items-center gap-3">
              <VolumeX size={14} className="text-[var(--muted)]" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={soundVolume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="flex-1 accent-[var(--accent)]"
              />
              <Volume2 size={14} className="text-[var(--muted)]" />
            </div>

            {/* Play/Stop button */}
            <button
              onClick={handleSoundToggle}
              className={`w-full py-2 text-sm font-semibold border transition-colors ${
                isSoundPlaying
                  ? 'border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)]/10'
                  : 'border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10'
              }`}
            >
              {isSoundPlaying ? 'Stop Sound' : selectedSound ? 'Play Sound' : 'Select a sound above'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
