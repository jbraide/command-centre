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
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Key,
  Trash2,
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

type SettingsTab = 'profile' | 'export' | 'transcriber' | 'appearance' | 'vault' | 'danger';

const TABS: { id: SettingsTab; label: string; icon: any }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'export', label: 'Export & Import', icon: Database },
  { id: 'transcriber', label: 'Transcriber', icon: Mic },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'vault', label: 'Password Vault', icon: Lock },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
];

// ──────── Self-contained Account Password Change Component ────────

function AccountPasswordChange() {
  const [showForm, setShowForm] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!oldPw.trim() || !newPw.trim() || !confirmPw.trim()) {
      toast.error('All fields are required'); return;
    }
    if (newPw !== confirmPw) { toast.error('New passwords do not match'); return; }
    if (newPw.length < 8) { toast.error('Password must be at least 8 characters'); return; }

    try {
      setLoading(true);
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: oldPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      setShowForm(false);
      setOldPw(''); setNewPw(''); setConfirmPw('');
      toast.success('Account password changed successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-t border-[var(--border)] pt-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Key size={16} className="text-[var(--accent)]" />
        <h3 className="text-sm font-semibold text-[var(--foreground)]">Change Account Password</h3>
      </div>
      <p className="text-xs text-[var(--muted)] mb-3">
        Update the password used to sign in to Command Center.
      </p>

      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all">
          <RefreshCw size={14} /> Change Password
        </button>
      ) : (
        <div className="space-y-3 p-4 rounded-lg border border-[var(--border)] bg-[var(--background)]">
          <div className="relative">
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">Current password</label>
            <input type={showOld ? 'text' : 'password'} value={oldPw} onChange={(e) => setOldPw(e.target.value)}
              placeholder="Enter current password" autoFocus
              className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50" />
            <button type="button" onClick={() => setShowOld(!showOld)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--foreground)]">
              {showOld ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="relative">
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">New password</label>
            <input type={showNew ? 'text' : 'password'} value={newPw} onChange={(e) => setNewPw(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50" />
            <button type="button" onClick={() => setShowNew(!showNew)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--foreground)]">
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="relative">
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">Confirm new password</label>
            <input type={showConfirm ? 'text' : 'password'} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50" />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--foreground)]">
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSubmit} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {loading ? 'Updating...' : 'Update Password'}
            </button>
            <button onClick={() => { setShowForm(false); setOldPw(''); setNewPw(''); setConfirmPw(''); }}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [modelSize, setModelSize] = useState<ModelSize>('small');
  const [brevo, setBrevo] = useState<BrevoInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);
  const [exportEmail, setExportEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  // Password vault state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPw, setShowOldPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Reset vault
  const [showResetVault, setShowResetVault] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resettingVault, setResettingVault] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ModelSize | null;
    if (saved && saved in MODEL_INFO) setModelSize(saved);
  }, []);

  useEffect(() => {
    fetch('/api/services')
      .then((r) => r.json())
      .then((services: { service: string; enabled: boolean }[]) => {
        const bs = services.find((s) => s.service === 'brevo');
        setBrevo({ configured: !!bs, enabled: bs?.enabled ?? false });
      })
      .catch(() => setBrevo({ configured: false, enabled: false }));
  }, []);

  const handleModelChange = (size: ModelSize) => {
    setModelSize(size);
    localStorage.setItem(STORAGE_KEY, size);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `command-center-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported');
    } catch {
      toast.error('Export failed');
    }
    setDownloading(false);
  };

  const handleEmailExport = async (email: string) => {
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
    }
    setSending(false);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: text }),
      });
      const result = await res.json();
      setImportResult(result);
      if (res.ok) toast.success(`Imported ${result.imported} items`);
      else toast.error(result.error || 'Import failed');
    } catch {
      toast.error('Import failed');
    }
    setImporting(false);
    e.target.value = '';
  };

  // ──────── Change Master Password ────────

  const handleChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast.error('All fields are required'); return;
    }
    if (newPassword !== confirmPassword) { toast.error('New passwords do not match'); return; }
    if (newPassword.length < 6) { toast.error('New password must be at least 6 characters'); return; }

    try {
      setChangingPassword(true);
      const crypto = await import('@/lib/crypto');
      const saltB64 = localStorage.getItem('vault-salt');
      const verifyIvB64 = localStorage.getItem('vault-verify-iv');
      const verifyToken = localStorage.getItem('vault-verify-token');
      if (!saltB64 || !verifyIvB64 || !verifyToken) {
        toast.error('No vault found. Set up a vault first in Password Vault.');
        setChangingPassword(false); return;
      }
      const salt = crypto.base64ToUint8Array(saltB64);
      const oldKey = await crypto.deriveKey(oldPassword, salt);
      try {
        const verifyIv = crypto.base64ToUint8Array(verifyIvB64);
        await crypto.decrypt(oldKey, verifyToken, verifyIv);
      } catch {
        toast.error('Current master password is incorrect');
        setChangingPassword(false); return;
      }

      const res = await fetch('/api/passwords?includeEncrypted=true');
      if (!res.ok) throw new Error('Failed to fetch vault entries');
      const entries: any[] = await res.json();
      const newSalt = crypto.generateSalt();
      const newKey = await crypto.deriveKey(newPassword, newSalt);

      const rekeyedEntries = await Promise.all(entries.map(async (entry) => {
        const oldIv = crypto.base64ToUint8Array(entry.iv);
        const decryptedPassword = await crypto.decrypt(oldKey, entry.encryptedPassword, oldIv);
        let decryptedNotes = '';
        if (entry.encryptedNotes) {
          const dotIdx = entry.encryptedNotes.indexOf('.');
          if (dotIdx !== -1) {
            const notesIv = crypto.base64ToUint8Array(entry.encryptedNotes.slice(0, dotIdx));
            const notesCiphertext = entry.encryptedNotes.slice(dotIdx + 1);
            decryptedNotes = await crypto.decrypt(oldKey, notesCiphertext, notesIv);
          } else {
            decryptedNotes = await crypto.decrypt(oldKey, entry.encryptedNotes, oldIv);
          }
        }
        const newIv = crypto.generateIV();
        const newEncryptedPassword = await crypto.encrypt(newKey, decryptedPassword, newIv);
        const newEncryptedNotes = decryptedNotes ? await crypto.encrypt(newKey, decryptedNotes, newIv) : null;
        return { id: entry.id, encryptedPassword: newEncryptedPassword, iv: crypto.uint8ArrayToBase64(newIv), encryptedNotes: newEncryptedNotes };
      }));

      if (rekeyedEntries.length > 0) {
        const updateRes = await fetch('/api/passwords/rekey', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: rekeyedEntries }),
        });
        if (!updateRes.ok) throw new Error('Failed to update encrypted entries');
      }

      const newVerifyIv = crypto.generateIV();
      const newVerifyToken = await crypto.encrypt(newKey, 'VAULT_OK', newVerifyIv);
      localStorage.setItem('vault-salt', crypto.uint8ArrayToBase64(newSalt));
      localStorage.setItem('vault-verify-iv', crypto.uint8ArrayToBase64(newVerifyIv));
      localStorage.setItem('vault-verify-token', newVerifyToken);

      setShowChangePassword(false);
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      toast.success(`Master password changed. ${rekeyedEntries.length} credentials re-encrypted.`);
    } catch { toast.error('Failed to change master password'); }
    finally { setChangingPassword(false); }
  };

  // ──────── Reset Vault ────────

  const handleResetVault = async () => {
    if (resetConfirmText !== 'RESET') { toast.error('Type RESET to confirm'); return; }
    try {
      setResettingVault(true);
      const pwRes = await fetch('/api/passwords', { method: 'DELETE' });
      if (!pwRes.ok) throw new Error('Failed to clear passwords');
      const akRes = await fetch('/api/api-keys', { method: 'DELETE' });
      if (!akRes.ok) throw new Error('Failed to clear API keys');
      ['vault-salt', 'vault-verify-iv', 'vault-verify-token', 'api-key-vault-salt', 'api-key-vault-verify-iv', 'api-key-vault-verify-token']
        .forEach(k => localStorage.removeItem(k));
      setShowResetVault(false); setResetConfirmText('');
      toast.success('Vault reset. Passwords and API keys cleared.');
    } catch { toast.error('Failed to reset vault'); }
    finally { setResettingVault(false); }
  };

  // ──────── Navigation ────────

  const NavSidebar = () => (
    <nav className="w-full md:w-48 shrink-0 space-y-0.5">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-lg transition-all text-left ${
              isActive
                ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20'
                : 'text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--background)]'
            }`}
          >
            <Icon size={16} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <Settings className="text-[var(--accent)]" size={24} />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <NavSidebar />

        {/* Content */}
        <div className="flex-1 space-y-6">

          {/* ── Profile ── */}
          {activeTab === 'profile' && (
            <section className="border border-[var(--border)] bg-[var(--panel)]">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
                <User className="text-[var(--accent)]" size={18} />
                <h2 className="font-semibold text-sm">Profile</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">Email</label>
                  <div className="text-sm text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] px-4 py-2.5">
                    {session?.user?.email || <span className="text-[var(--muted)]">Not signed in</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[var(--muted)] uppercase tracking-wider mb-1.5">Name</label>
                  <div className="text-sm text-[var(--foreground)] bg-[var(--background)] border border-[var(--border)] px-4 py-2.5">
                    {session?.user?.name || <span className="text-[var(--muted)]">Not set</span>}
                  </div>
                </div>

                {/* Change Account Password */}
                <AccountPasswordChange />
              </div>
            </section>
          )}

          {/* ── Export & Import ── */}
          {activeTab === 'export' && (
            <section className="border border-[var(--border)] bg-[var(--panel)]">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
                <Database className="text-[var(--accent)]" size={18} />
                <h2 className="font-semibold text-sm">Export &amp; Import Data</h2>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">Export to JSON</h3>
                  <p className="text-sm text-[var(--muted)] mb-4">Download all your data as JSON, or email it via Brevo.</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={handleDownload} disabled={downloading}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)] transition-colors disabled:opacity-50">
                      {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                      {downloading ? 'Downloading...' : 'Download JSON'}
                    </button>
                    {brevo?.configured && brevo.enabled ? (
                      <>
                        {showEmailInput ? (
                          <div className="flex items-center gap-2">
                            <input type="email" value={exportEmail} onChange={(e) => setExportEmail(e.target.value)}
                              placeholder="your@email.com"
                              className="px-3 py-2 text-sm border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] w-56" />
                            <button onClick={() => handleEmailExport(exportEmail)} disabled={sending || !exportEmail.trim()}
                              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[var(--accent)] text-[var(--background)] hover:brightness-110 disabled:opacity-50">
                              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                              Send
                            </button>
                            <button onClick={() => setShowEmailInput(false)} className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => setShowEmailInput(true)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] transition-colors">
                            <Send size={16} /> Email Export
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">
                        Configure Brevo first{' '}
                        <a href="/integrations/brevo" className="text-[var(--accent)] hover:underline">in Integrations</a>
                      </span>
                    )}
                  </div>
                  {brevo && (
                    <div className={`flex items-center gap-1.5 text-xs mt-3 ${brevo.configured && brevo.enabled ? 'text-green-400' : 'text-[var(--muted)]'}`}>
                      {brevo.configured && brevo.enabled
                        ? <><CheckCircle size={12} /><span>Brevo is configured</span></>
                        : <><AlertCircle size={12} /><span>Brevo not configured — email export unavailable</span></>
                      }
                    </div>
                  )}
                </div>
                <div className="border-t border-[var(--border)] pt-6">
                  <h3 className="text-sm font-semibold text-[var(--foreground)] mb-2">Import from JSON</h3>
                  <p className="text-sm text-[var(--muted)] mb-4">Import data from a previously exported JSON file.</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--accent)] cursor-pointer transition-colors">
                    {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {importing ? 'Importing...' : 'Select JSON File'}
                    <input type="file" accept=".json" onChange={handleImport} className="hidden" disabled={importing} />
                  </label>
                  {importResult && (
                    <div className={`mt-3 text-xs ${importResult.errors > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                      Imported {importResult.imported} items
                      {importResult.errors > 0 && <span className="text-red-400"> • {importResult.errors} errors</span>}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── Transcriber ── */}
          {activeTab === 'transcriber' && (
            <section className="border border-[var(--border)] bg-[var(--panel)]">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
                <Mic className="text-[var(--accent)]" size={18} />
                <h2 className="font-semibold text-sm">Transcriber Defaults</h2>
              </div>
              <div className="p-6 space-y-4">
                <label className="block text-sm text-[var(--foreground)] mb-2">Default Whisper Model</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(MODEL_INFO) as ModelSize[]).map((size) => (
                    <button key={size} onClick={() => handleModelChange(size)}
                      className={`px-4 py-2 text-sm border transition-all ${
                        modelSize === size
                          ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                          : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--border)]/60'
                      }`}>
                      {MODEL_LABELS[size]}
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-xs text-[var(--muted)]">
                  {MODEL_INFO[modelSize].speed} · {MODEL_INFO[modelSize].quality} · {MODEL_INFO[modelSize].ram} RAM
                </div>
              </div>
            </section>
          )}

          {/* ── Appearance ── */}
          {activeTab === 'appearance' && (
            <section className="border border-[var(--border)] bg-[var(--panel)]">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
                <Palette className="text-[var(--accent)]" size={18} />
                <h2 className="font-semibold text-sm">Appearance</h2>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-sm text-[var(--foreground)]">Theme</label>
                    <p className="text-xs text-[var(--muted)] mt-0.5">Dark theme is the only option</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-not-allowed">
                    <input type="checkbox" checked disabled className="sr-only peer" />
                    <div className="w-10 h-5 bg-[var(--accent)] opacity-50 rounded-sm" />
                    <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-[var(--background)] transition-transform peer-checked:translate-x-5" />
                  </label>
                </div>
                <div className="flex items-center gap-2 text-xs text-[var(--muted)] border-t border-[var(--border)] pt-4">
                  <ChevronRight size={14} className="text-[var(--warning)]" />
                  <span>Light mode and theme customization coming soon</span>
                </div>
              </div>
            </section>
          )}

          {/* ── Password Vault ── */}
          {activeTab === 'vault' && (
            <section className="border border-[var(--border)] bg-[var(--panel)]">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
                <Lock className="text-[var(--accent)]" size={18} />
                <h2 className="font-semibold text-sm">Password Vault</h2>
              </div>
              <div className="p-6 space-y-6">
                {/* Change Master Password */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Key size={16} className="text-[var(--accent)]" />
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">Change Master Password</h3>
                  </div>
                  <p className="text-xs text-[var(--muted)] mb-3">
                    Re-encrypt all stored credentials with a new password.
                  </p>

                  {!showChangePassword ? (
                    <button onClick={() => setShowChangePassword(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-all">
                      <RefreshCw size={14} /> Change Master Password
                    </button>
                  ) : (
                    <div className="space-y-3 p-4 rounded-lg border border-[var(--border)] bg-[var(--background)]">
                      <div className="relative">
                        <label className="block text-xs font-medium text-[var(--muted)] mb-1">Current password</label>
                        <input type={showOldPw ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
                          placeholder="Enter current master password" autoFocus
                          className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50" />
                        <button type="button" onClick={() => setShowOldPw(!showOldPw)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--foreground)]">
                          {showOldPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <div className="relative">
                        <label className="block text-xs font-medium text-[var(--muted)] mb-1">New password</label>
                        <input type={showNewPw ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new master password"
                          className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50" />
                        <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--foreground)]">
                          {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <div className="relative">
                        <label className="block text-xs font-medium text-[var(--muted)] mb-1">Confirm new password</label>
                        <input type={showConfirmPw ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50" />
                        <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--foreground)]">
                          {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={handleChangePassword} disabled={changingPassword}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50">
                          {changingPassword ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                          {changingPassword ? 'Re-encrypting...' : 'Change Password'}
                        </button>
                        <button onClick={() => { setShowChangePassword(false); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                          className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-all">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── Danger Zone ── */}
          {activeTab === 'danger' && (
            <section className="border border-red-500/30 bg-[var(--panel)]">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-red-500/30">
                <AlertTriangle className="text-red-400" size={18} />
                <h2 className="font-semibold text-sm text-red-400">Danger Zone</h2>
              </div>
              <div className="p-6 space-y-6">
                {/* Reset Vault */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Trash2 size={16} className="text-red-400" />
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">Reset Password Vault</h3>
                  </div>
                  <p className="text-xs text-[var(--muted)] mb-3">
                    Permanently delete all stored credentials and API keys. This cannot be undone.
                  </p>
                  {!showResetVault ? (
                    <button onClick={() => setShowResetVault(true)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all">
                      <Trash2 size={14} /> Reset Vault
                    </button>
                  ) : (
                    <div className="space-y-3 p-4 rounded-lg border border-red-500/30 bg-red-500/5">
                      <p className="text-xs text-red-400 font-medium">
                        ⚠️ Type <strong>RESET</strong> to confirm:
                      </p>
                      <input type="text" value={resetConfirmText} onChange={(e) => setResetConfirmText(e.target.value)}
                        placeholder="Type RESET" autoFocus
                        className="w-full px-3 py-2 text-sm rounded-lg border border-red-500/50 bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-red-500/50" />
                      <div className="flex items-center gap-2">
                        <button onClick={handleResetVault} disabled={resettingVault || resetConfirmText !== 'RESET'}
                          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all disabled:opacity-50">
                          {resettingVault ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          {resettingVault ? 'Resetting...' : 'Delete Everything'}
                        </button>
                        <button onClick={() => { setShowResetVault(false); setResetConfirmText(''); }}
                          className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] transition-all">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
