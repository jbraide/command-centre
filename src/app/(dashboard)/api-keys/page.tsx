'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Lock,
  Unlock,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Search,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  deriveKey,
  encrypt,
  decrypt,
  generateSalt,
  generateIV,
  uint8ArrayToBase64,
  base64ToUint8Array,
} from '@/lib/crypto';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface ApiKeyEntry {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

interface ApiKeyWithSecret extends ApiKeyEntry {
  encryptedKey: string;
  iv: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const VAULT_VERIFY_PLAINTEXT = 'VAULT_OK';
const SALT_KEY = 'api-key-vault-salt';
const VERIFY_IV_KEY = 'api-key-vault-verify-iv';
const VERIFY_TOKEN_KEY = 'api-key-vault-verify-token';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function maskKey(key: string): string {
  return key.length > 8 ? `${key.slice(0, 8)}...` : `${key}...`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/*  Modal Wrapper                                                     */
/* ------------------------------------------------------------------ */

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[var(--panel)] border border-[var(--border)] p-6 w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Vault Setup Screen                                                */
/* ------------------------------------------------------------------ */

function VaultSetupScreen({
  masterPassword,
  onPasswordChange,
  onSubmit,
  unlocking,
}: {
  masterPassword: string;
  onPasswordChange: (v: string) => void;
  onSubmit: () => void;
  unlocking: boolean;
}) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full border-2 border-[var(--border)] bg-[var(--panel)] flex items-center justify-center">
            <Lock size={28} className="text-[var(--accent)]" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center text-[var(--foreground)] mb-2">
          API Key Vault
        </h1>
        <p className="text-sm text-center text-[var(--muted)] mb-8">
          Create a master password to secure your API keys
        </p>

        {/* Password input */}
        <input
          type="password"
          value={masterPassword}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="Create a master password"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
          }}
          className="w-full px-4 py-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all mb-4"
          autoFocus
        />

        {/* Action button */}
        <button
          onClick={onSubmit}
          disabled={unlocking || !masterPassword.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {unlocking && <Loader2 size={16} className="animate-spin" />}
          {unlocking ? 'Setting up...' : 'Set Up Vault'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Vault Unlock Screen                                               */
/* ------------------------------------------------------------------ */

function VaultUnlockScreen({
  masterPassword,
  onPasswordChange,
  onSubmit,
  unlocking,
}: {
  masterPassword: string;
  onPasswordChange: (v: string) => void;
  onSubmit: () => void;
  unlocking: boolean;
}) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full border-2 border-[var(--border)] bg-[var(--panel)] flex items-center justify-center">
            <Lock size={28} className="text-[var(--accent)]" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-center text-[var(--foreground)] mb-2">
          API Key Vault
        </h1>
        <p className="text-sm text-center text-[var(--muted)] mb-8">
          Enter your master password to unlock
        </p>

        {/* Password input */}
        <input
          type="password"
          value={masterPassword}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="Master password"
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit();
          }}
          className="w-full px-4 py-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all mb-4"
          autoFocus
        />

        {/* Action button */}
        <button
          onClick={onSubmit}
          disabled={unlocking || !masterPassword.trim()}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {unlocking && <Loader2 size={16} className="animate-spin" />}
          {unlocking ? 'Unlocking...' : 'Unlock Vault'}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page Component                                               */
/* ------------------------------------------------------------------ */

export default function ApiKeysPage() {
  /* ── Vault state ── */
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [isNewVault, setIsNewVault] = useState(false);
  const [masterPasswordInput, setMasterPasswordInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [derivedKey, setDerivedKey] = useState<CryptoKey | null>(null);

  /* ── Keys state ── */
  const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  /* ── Modal state ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formKey, setFormKey] = useState('');
  const [showFormKey, setShowFormKey] = useState(false);

  /* ── Revealed / fetched key ── */
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedKey, setRevealedKey] = useState('');
  const [fetchingReveal, setFetchingReveal] = useState(false);

  /* ── Copy feedback ── */
  const [copiedId, setCopiedId] = useState<string | null>(null);

  /* ── Delete ── */
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ── Email modal ── */
  const [emailModalId, setEmailModalId] = useState<string | null>(null);
  const [emailAddress, setEmailAddress] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  /* ── Check if vault exists on mount ── */
  useEffect(() => {
    const salt = localStorage.getItem(SALT_KEY);
    setIsNewVault(!salt);
  }, []);

  /* ── Fetch keys (only when vault is unlocked) ── */
  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/api-keys');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to load API keys');
      }
      setKeys(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (vaultUnlocked) {
      fetchKeys();
    }
  }, [vaultUnlocked, fetchKeys]);

  /* ── Filtered keys ── */
  const filteredKeys = keys.filter((entry) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      entry.name.toLowerCase().includes(q) ||
      (entry.description && entry.description.toLowerCase().includes(q))
    );
  });

  /* ──────── Setup Vault ──────── */

  const handleSetupVault = async () => {
    if (!masterPasswordInput.trim()) {
      toast.error('Please enter a master password');
      return;
    }
    try {
      setUnlocking(true);
      const salt = generateSalt();
      const key = await deriveKey(masterPasswordInput, salt);
      const verifyIv = generateIV();
      const verifyToken = await encrypt(key, VAULT_VERIFY_PLAINTEXT, verifyIv);

      localStorage.setItem(SALT_KEY, uint8ArrayToBase64(salt));
      localStorage.setItem(VERIFY_IV_KEY, uint8ArrayToBase64(verifyIv));
      localStorage.setItem(VERIFY_TOKEN_KEY, verifyToken);

      setDerivedKey(key);
      setVaultUnlocked(true);
      setIsNewVault(false);
      setMasterPasswordInput('');
      toast.success('Vault set up and unlocked');
    } catch {
      toast.error('Failed to set up vault');
    } finally {
      setUnlocking(false);
    }
  };

  /* ──────── Unlock Vault ──────── */

  const handleUnlock = async () => {
    if (!masterPasswordInput.trim()) {
      toast.error('Please enter your master password');
      return;
    }
    try {
      setUnlocking(true);

      const saltB64 = localStorage.getItem(SALT_KEY);
      if (!saltB64) {
        toast.error('Vault not found. Please set up a new vault.');
        setIsNewVault(true);
        return;
      }

      const salt = base64ToUint8Array(saltB64);
      const key = await deriveKey(masterPasswordInput, salt);

      // Verify the master password by decrypting the stored token
      const verifyIvB64 = localStorage.getItem(VERIFY_IV_KEY);
      const verifyToken = localStorage.getItem(VERIFY_TOKEN_KEY);

      if (verifyIvB64 && verifyToken) {
        try {
          const verifyIv = base64ToUint8Array(verifyIvB64);
          const decrypted = await decrypt(key, verifyToken, verifyIv);
          if (decrypted !== VAULT_VERIFY_PLAINTEXT) {
            toast.error('Incorrect master password');
            return;
          }
        } catch {
          toast.error('Incorrect master password');
          return;
        }
      }

      setDerivedKey(key);
      setVaultUnlocked(true);
      setMasterPasswordInput('');
      toast.success('Vault unlocked');
      fetchKeys();
    } catch {
      toast.error('Failed to unlock vault');
    } finally {
      setUnlocking(false);
    }
  };

  /* ── Reset form ── */
  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormKey('');
    setShowFormKey(false);
    setSaving(false);
  };

  /* ── Create key ── */
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formKey.trim()) return;
    if (!derivedKey) {
      toast.error('Vault is locked');
      return;
    }

    setSaving(true);
    try {
      // Client-side encryption
      const iv = generateIV();
      const encryptedKey = await encrypt(derivedKey, formKey.trim(), iv);

      const res = await fetch('/api/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDesc.trim() || undefined,
          encryptedKey,
          iv: uint8ArrayToBase64(iv),
          keyForServer: formKey.trim(),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to create API key');
      }

      const created: ApiKeyEntry = await res.json();
      setKeys((prev) => [created, ...prev]);
      setModalOpen(false);
      resetForm();
      toast.success('API key saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create key');
    } finally {
      setSaving(false);
    }
  };

  /* ── Fetch single decrypted key ── */
  const fetchDecrypted = async (id: string): Promise<string | null> => {
    if (!derivedKey) return null;
    try {
      const res = await fetch(`/api/api-keys/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to fetch key');
      }
      const data: ApiKeyWithSecret = await res.json();
      const iv = base64ToUint8Array(data.iv);
      return decrypt(derivedKey, data.encryptedKey, iv);
    } catch {
      return null;
    }
  };

  /* ── Show / hide key ── */
  const handleReveal = async (id: string) => {
    if (revealedId === id) {
      setRevealedId(null);
      setRevealedKey('');
      return;
    }

    setFetchingReveal(true);
    const key = await fetchDecrypted(id);
    if (key !== null) {
      setRevealedId(id);
      setRevealedKey(key);
    } else {
      toast.error('Failed to decrypt key');
    }
    setFetchingReveal(false);
  };

  /* ── Copy key ── */
  const handleCopy = async (id: string) => {
    let key = revealedId === id ? revealedKey : null;
    if (!key) {
      key = await fetchDecrypted(id);
      if (!key) {
        toast.error('Failed to fetch key for copy');
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(key);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  /* ── Delete key ── */
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to delete key');
      }
      setKeys((prev) => prev.filter((k) => k.id !== id));
      if (revealedId === id) {
        setRevealedId(null);
        setRevealedKey('');
      }
      toast.success('API key deleted');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete key');
    } finally {
      setDeletingId(null);
    }
  };

  /* ── Email key ── */
  const handleEmailKey = async () => {
    if (!emailModalId || !emailAddress.trim()) return;
    if (!derivedKey) {
      toast.error('Vault is locked');
      return;
    }

    setSendingEmail(true);
    try {
      const key = await fetchDecrypted(emailModalId);
      if (!key) {
        toast.error('Failed to decrypt key');
        return;
      }

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailAddress.trim(),
          subject: `API Key from Command Center`,
          body: `Here is the API key you requested:\n\n${key}\n\n— Command Center`,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to send email');
      }

      toast.success('Key sent to email');
      setEmailModalId(null);
      setEmailAddress('');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  /* ──────── Render: Locked / Setup ──────── */

  if (!vaultUnlocked) {
    if (isNewVault) {
      return (
        <VaultSetupScreen
          masterPassword={masterPasswordInput}
          onPasswordChange={setMasterPasswordInput}
          onSubmit={handleSetupVault}
          unlocking={unlocking}
        />
      );
    }
    return (
      <VaultUnlockScreen
        masterPassword={masterPasswordInput}
        onPasswordChange={setMasterPasswordInput}
        onSubmit={handleUnlock}
        unlocking={unlocking}
      />
    );
  }

  /* ──────── Render: Unlocked ──────── */

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Key className="text-[var(--accent)]" size={24} />
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              API Keys
            </h1>
          </div>
          <p className="text-sm text-[var(--muted)] mt-1">
            Store API keys for external services — encrypted at rest.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 sm:flex-none">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keys..."
              className="w-full sm:w-56 pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
            />
          </div>
          {/* Add button */}
          <button
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all whitespace-nowrap"
          >
            <Plus size={16} />
            Add Key
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-sm border border-red-500/30 bg-red-500/10 text-sm text-red-400 mb-6">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="hover:text-red-300">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
          <Loader2 size={32} className="animate-spin mb-3" />
          <p className="text-sm">Loading API keys...</p>
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && keys.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
          <Key size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium text-[var(--foreground)] mb-1">
            No API keys yet
          </p>
          <p className="text-sm mb-6">Add your first key to get started.</p>
          <button
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all"
          >
            <Plus size={16} />
            Add Key
          </button>
        </div>
      )}

      {/* ── Empty search results ── */}
      {!loading && keys.length > 0 && filteredKeys.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
          <Search size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium text-[var(--foreground)] mb-1">
            No results found
          </p>
          <p className="text-sm">Try a different search term.</p>
        </div>
      )}

      {/* ── Keys list ── */}
      {!loading && filteredKeys.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredKeys.map((entry) => {
            const isRevealed = revealedId === entry.id;
            const isDeleting = deletingId === entry.id;
            const isCopied = copiedId === entry.id;

            return (
              <div
                key={entry.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5"
              >
                {/* Card header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--border)] flex items-center justify-center shrink-0">
                    <Key size={18} className="text-[var(--accent)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-[var(--foreground)] truncate">
                      {entry.name}
                    </h3>
                    {entry.description && (
                      <p className="text-sm text-[var(--muted)] truncate">
                        {entry.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Key display */}
                <div className="font-mono text-xs text-[var(--muted)] bg-[var(--background)] border border-[var(--border)] px-3 py-2 rounded-md mb-3 truncate">
                  {isRevealed ? revealedKey : maskKey(entry.id)}
                </div>

                {/* Date */}
                <p className="text-[10px] text-[var(--muted)] mb-3">
                  Added {formatDate(entry.createdAt)}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-1 pt-3 border-t border-[var(--border)]">
                  {/* Show / Hide */}
                  <button
                    onClick={() => handleReveal(entry.id)}
                    disabled={fetchingReveal && !isRevealed}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
                    title={isRevealed ? 'Hide' : 'Show full key'}
                  >
                    {fetchingReveal && !isRevealed ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : isRevealed ? (
                      <EyeOff size={14} />
                    ) : (
                      <Eye size={14} />
                    )}
                    {isRevealed ? 'Hide' : 'Show'}
                  </button>

                  {/* Copy */}
                  <button
                    onClick={() => handleCopy(entry.id)}
                    className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
                    title="Copy key"
                  >
                    {isCopied ? (
                      <CheckCircle size={14} className="text-green-500" />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>

                  {/* Email */}
                  <button
                    onClick={() => {
                      setEmailModalId(entry.id);
                      setEmailAddress('');
                    }}
                    className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
                    title="Email key"
                  >
                    <Mail size={14} />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={isDeleting}
                    className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--border)] transition-all ml-auto disabled:opacity-50"
                    title="Delete"
                  >
                    {isDeleting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ──────── Add Key Modal ──────── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Add API Key
          </h2>
          <button
            onClick={() => setModalOpen(false)}
            className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Name */}
          <div>
            <label
              htmlFor="key-name"
              className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
            >
              Name <span className="text-red-400">*</span>
            </label>
            <input
              id="key-name"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Brevo API Key"
              required
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="key-desc"
              className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
            >
              Description{' '}
              <span className="text-[var(--muted)] font-normal">(optional)</span>
            </label>
            <input
              id="key-desc"
              type="text"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="What is this key used for?"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
            />
          </div>

          {/* Key */}
          <div>
            <label
              htmlFor="key-value"
              className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
            >
              Key <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                id="key-value"
                type={showFormKey ? 'text' : 'password'}
                value={formKey}
                onChange={(e) => setFormKey(e.target.value)}
                placeholder="Paste your API key here"
                required
                className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowFormKey(!showFormKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                tabIndex={-1}
              >
                {showFormKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !formName.trim() || !formKey.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ──────── Email Key Modal ──────── */}
      <Modal open={!!emailModalId} onClose={() => setEmailModalId(null)}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Email API Key
          </h2>
          <button
            onClick={() => setEmailModalId(null)}
            className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Send this API key to an email address. The key will be decrypted and
            included in the email body.
          </p>

          <div>
            <label
              htmlFor="email-address"
              className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
            >
              Email Address
            </label>
            <input
              id="email-address"
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEmailKey();
              }}
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEmailModalId(null)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEmailKey}
              disabled={sendingEmail || !emailAddress.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingEmail ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Mail size={14} />
              )}
              {sendingEmail ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
