'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import {
  Settings,
  User,
  Mic,
  Palette,
  AlertTriangle,
  ChevronRight,
  Database,
  Download,
  Send,
  Upload,
  FileJson,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

type ModelSize = 'tiny' | 'base' | 'small' | 'medium';

const MODEL_INFO: Record<ModelSize, { speed: string; quality: string; ram: string }> = {
  tiny: { speed: 'Fastest', quality: 'Lowest accuracy', ram: '~1 GB' },
  base: { speed: 'Fast', quality: 'Moderate accuracy', ram: '~1.5 GB' },
  small: { speed: 'Balanced', quality: 'Good accuracy', ram: '~2 GB' },
  medium: { speed: 'Slower', quality: 'Best accuracy', ram: '~5 GB' },
};

const MODEL_LABELS: Record<ModelSize, string> = {
  tiny: 'Tiny',
  base: 'Base',
  small: 'Small',
  medium: 'Medium',
};

const STORAGE_KEY = 'whisper-model-size';

interface BrevoInfo {
  configured: boolean;
  enabled: boolean;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [modelSize, setModelSize] = useState<ModelSize>('small');
  const [brevo, setBrevo] = useState<BrevoInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [exportEmail, setExportEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ModelSize | null;
    if (saved && saved in MODEL_INFO) {
      setModelSize(saved);
    }
  }, []);

  useEffect(() => {
    fetch('/api/services')
      .then((res) => res.json())
      .then((services: { service: string; enabled: boolean }[]) => {
        const brevoService = services.find((s) => s.service === 'brevo');
        setBrevo({
          configured: !!brevoService,
          enabled: brevoService?.enabled ?? false,
        });
      })
      .catch(() => setBrevo({ configured: false, enabled: false }));
  }, []);

  function handleModelChange(size: ModelSize) {
    setModelSize(size);
    localStorage.setItem(STORAGE_KEY, size);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const res = await fetch('/api/export');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to download export');
      }
      const blob = await res.blob();
      const date = new Date().toISOString().split('T')[0];
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `command-center-export-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    } finally {
      setDownloading(false);
    }
  }

  async function handleEmailExport(e?: React.FormEvent) {
    e?.preventDefault();
    const email = exportEmail.trim() || undefined;

    if (!email) {
      setShowEmailInput(true);
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/export/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to send export');
      }
      toast.success(`Export sent to ${email}`);
      setExportEmail('');
      setShowEmailInput(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to send export');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="text-[var(--accent)]" size={24} />
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">
          Manage your preferences and account settings.
        </p>
      </div>

      <div className="space-y-6">
        {/* Section 1: Profile */}
        <section className="border border-[var(--border)] bg-[var(--panel)]">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
            <User className="text-[var(--accent)]" size={18} />
            <h2 className="font-semibold text-sm">Profile</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                Email
              </label>
              <div className="text-sm text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] px-4 py-2.5">
                {session?.user?.email || (
                  <span className="text-[var(--muted)]">Not signed in</span>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">
                Name
              </label>
              <div className="text-sm text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] px-4 py-2.5">
                {session?.user?.name || (
                  <span className="text-[var(--muted)]">Not set</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--muted)] border-t border-[var(--border)] pt-4">
              <ChevronRight size={14} className="text-[var(--warning)]" />
              <span>Profile editing coming soon</span>
            </div>
          </div>
        </section>

        {/* Section 2: Export & Import Data */}
        <section className="border border-[var(--border)] bg-[var(--panel)]">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
            <Database className="text-[var(--accent)]" size={18} />
            <h2 className="font-semibold text-sm">Export &amp; Import Data</h2>
          </div>
          <div className="p-6 space-y-6">
            {/* ── Export ── */}
            <div>
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">
                Export to JSON
              </h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Download all your Command Center data as JSON, or email it to
                yourself using your configured Brevo integration.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                {/* Download JSON */}
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)] transition-colors disabled:opacity-50"
                >
                  {downloading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  {downloading ? 'Downloading...' : 'Download JSON'}
                </button>

                {/* Email Export */}
                {brevo?.configured && brevo.enabled ? (
                  <>
                    {showEmailInput ? (
                      <form onSubmit={handleEmailExport} className="flex items-center gap-2">
                        <input
                          type="email"
                          value={exportEmail}
                          onChange={(e) => setExportEmail(e.target.value)}
                          placeholder="email@example.com"
                          required
                          className="px-3 py-2.5 text-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={sending}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-[var(--accent)] text-[var(--background)] hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                          {sending ? 'Sending...' : 'Send'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowEmailInput(false); setExportEmail(''); }}
                          className="p-2.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        onClick={() => setShowEmailInput(true)}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
                      >
                        <Send size={16} />
                        Email to...
                      </button>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2.5 text-sm border border-dashed border-[var(--border)] text-[var(--muted)]">
                    <AlertCircle size={16} />
                    <span>
                      Configure Brevo first{' '}
                      <a
                        href="/integrations/brevo"
                        className="text-[var(--accent)] hover:underline inline-flex items-center gap-0.5"
                      >
                        here
                        <ExternalLink size={12} />
                      </a>
                    </span>
                  </div>
                )}
              </div>

              {brevo && (
                <div
                  className={`flex items-center gap-1.5 text-xs mt-3 ${
                    brevo.configured && brevo.enabled
                      ? 'text-green-400'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  {brevo.configured && brevo.enabled ? (
                    <>
                      <CheckCircle size={12} />
                      <span>Brevo is configured and enabled — send to any email</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle size={12} />
                      <span>Brevo not configured — email export unavailable</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* ── Import ── */}
            <div className="border-t border-[var(--border)] pt-6">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">
                Import from JSON
              </h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Import data from a previously exported JSON file. This will add
                the records to your existing data.
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)] transition-colors cursor-pointer">
                  <FileJson size={16} />
                  <span>{importing ? 'Importing...' : 'Choose JSON File'}</span>
                  <input
                    type="file"
                    accept=".json"
                    disabled={importing}
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      setImporting(true);
                      setImportResult(null);

                      try {
                        const text = await file.text();
                        const data = JSON.parse(text);

                        const res = await fetch('/api/import', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(data),
                        });

                        if (!res.ok) {
                          const body = await res.json().catch(() => null);
                          throw new Error(
                            body?.error ?? 'Failed to import data'
                          );
                        }

                        const result = await res.json();
                        const counts = result.imported || {};
                        const total = Object.values(counts).reduce((a: number, b: any) => a + (typeof b === 'number' ? b : 0), 0);
                        setImportResult({
                          success: total,
                          errors: result.errors ?? 0,
                          details: counts,
                        });
                        toast.success('Data imported successfully');
                      } catch (e) {
                        toast.error(
                          e instanceof Error
                            ? e.message
                            : 'Failed to import data'
                        );
                      } finally {
                        setImporting(false);
                        // Reset file input so the same file can be re-selected
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>

              {/* Import result */}
              {importResult && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle size={12} className="text-green-400" />
                    <span className="text-green-400">
                      {importResult.success} item{importResult.success !== 1 ? 's' : ''} imported
                    </span>
                    {importResult.errors > 0 && (
                      <span className="text-[var(--danger)]">
                        {' '}• {importResult.errors} error{importResult.errors !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {importResult.details && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                      {Object.entries(importResult.details).map(([key, val]: any) =>
                        val > 0 ? <span key={key}>{key}: {val}</span> : null
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 3: Transcriber */}
        <section className="border border-[var(--border)] bg-[var(--panel)]">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
            <Mic className="text-[var(--accent)]" size={18} />
            <h2 className="font-semibold text-sm">Transcriber</h2>
          </div>
          <div className="p-6">
            <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-3">
              Default Model Size
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {(Object.keys(MODEL_INFO) as ModelSize[]).map((size) => (
                <button
                  key={size}
                  onClick={() => handleModelChange(size)}
                  className={`
                    px-4 py-3 text-sm font-medium border transition-colors text-left
                    ${
                      modelSize === size
                        ? 'bg-[var(--accent)] text-[var(--background)] border-[var(--accent)]'
                        : 'bg-[var(--background)] text-[var(--foreground)] border-[var(--border)] hover:border-[var(--accent)]'
                    }
                  `}
                >
                  {MODEL_LABELS[size]}
                </button>
              ))}
            </div>
            <div className="border border-[var(--border)] bg-[var(--background)] p-4 text-sm space-y-2">
              <div className="flex items-start gap-3">
                <span className="text-[var(--accent)] font-semibold shrink-0 w-16">
                  Speed:
                </span>
                <span className="text-[var(--foreground)]">
                  {MODEL_INFO[modelSize].speed}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[var(--accent)] font-semibold shrink-0 w-16">
                  Quality:
                </span>
                <span className="text-[var(--foreground)]">
                  {MODEL_INFO[modelSize].quality}
                </span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-[var(--accent)] font-semibold shrink-0 w-16">
                  RAM:
                </span>
                <span className="text-[var(--foreground)]">
                  {MODEL_INFO[modelSize].ram}
                </span>
              </div>
            </div>
            <p className="text-xs text-[var(--muted)] mt-3">
              Saved locally. Affects transcription speed and accuracy.
            </p>
          </div>
        </section>

        {/* Section 4: Appearance */}
        <section className="border border-[var(--border)] bg-[var(--panel)]">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
            <Palette className="text-[var(--accent)]" size={18} />
            <h2 className="font-semibold text-sm">Appearance</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm text-[var(--foreground)]">
                  Theme
                </label>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Dark theme is the only option available
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-not-allowed">
                <input
                  type="checkbox"
                  checked
                  disabled
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-[var(--accent)] opacity-50 rounded-sm peer-disabled:cursor-not-allowed" />
                <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-[var(--background)] transition-transform peer-checked:translate-x-5" />
              </label>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--muted)] border-t border-[var(--border)] pt-4">
              <ChevronRight size={14} className="text-[var(--warning)]" />
              <span>Light mode and theme customization coming soon</span>
            </div>
          </div>
        </section>

        {/* Section 5: Danger Zone */}
        <section className="border border-[var(--danger)] bg-[var(--panel)]">
          <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--danger)]">
            <AlertTriangle className="text-[var(--danger)]" size={18} />
            <h2 className="font-semibold text-sm text-[var(--danger)]">
              Danger Zone
            </h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-[var(--muted)]">
              Coming soon — account deletion and data export
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
