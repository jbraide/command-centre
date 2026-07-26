'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Key,
  Shield,
  Globe,
  Plus,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  Search,
  Lock,
  Unlock,
  Loader2,
  X,
  CheckCircle,
  AlertCircle,
  SquareArrowOutUpRight,
  Wand2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { deriveKey, encrypt, decrypt, generateSalt, generateIV, uint8ArrayToBase64, base64ToUint8Array } from '@/lib/crypto';

// ───────── Types ─────────

interface PasswordEntry {
  id: string;
  website: string;
  username: string;
  createdAt: string;
}

interface PasswordEntryFull extends PasswordEntry {
  encryptedPassword: string;
  iv: string;
  encryptedNotes: string | null;
}

// ───────── Helpers ─────────

const VAULT_VERIFY_PLAINTEXT = 'VAULT_OK';

// ───────── Inline Modal ─────────

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

// ───────── Main Component ─────────

export default function PasswordsPage() {
  // ── Vault state ──
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [isNewVault, setIsNewVault] = useState(false);
  const [masterPasswordInput, setMasterPasswordInput] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [derivedKey, setDerivedKey] = useState<CryptoKey | null>(null);

  // ── Entries ──
  const [entries, setEntries] = useState<PasswordEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Dialogs ──
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [viewingEntry, setViewingEntry] = useState<PasswordEntryFull | null>(null);
  const [decryptedPassword, setDecryptedPassword] = useState('');
  const [decryptedNotes, setDecryptedNotes] = useState('');
  const [revealedPassword, setRevealedPassword] = useState('');

  // ── Add credential form ──
  const [formWebsite, setFormWebsite] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Delete confirmation ──
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Password generator ──
  const [showGenerator, setShowGenerator] = useState(false);
  const [genLength, setGenLength] = useState(20);
  const [genUppercase, setGenUppercase] = useState(true);
  const [genLowercase, setGenLowercase] = useState(true);
  const [genNumbers, setGenNumbers] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [genAmbiguous, setGenAmbiguous] = useState(false);

  function generatePassword() {
    let chars = '';
    if (genLowercase) chars += 'abcdefghijklmnopqrstuvwxyz';
    if (genUppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (genNumbers) chars += '0123456789';
    if (genSymbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (!genAmbiguous) {
      chars = chars.replace(/[oO0l1I]/g, '');
    }

    if (!chars) {
      toast.error('Select at least one character type');
      return;
    }

    const array = new Uint32Array(genLength);
    crypto.getRandomValues(array);
    let password = '';
    for (let i = 0; i < genLength; i++) {
      password += chars[array[i] % chars.length];
    }

    setFormPassword(password);
    setShowGenerator(false);
    toast.success('Password generated');
  }

  // ── Determine new vs existing vault on mount ──
  useEffect(() => {
    const salt = localStorage.getItem('vault-salt');
    setIsNewVault(!salt);
  }, []);

  // ── Fetch entries (only when vault is unlocked) ──
  const fetchEntries = useCallback(async () => {
    try {
      setLoadingEntries(true);
      const res = await fetch('/api/passwords');
      if (!res.ok) throw new Error('Failed to fetch passwords');
      const data = await res.json();
      setEntries(data);
    } catch {
      toast.error('Failed to load passwords');
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    if (vaultUnlocked) {
      fetchEntries();
    }
  }, [vaultUnlocked, fetchEntries]);

  // ── Filtered entries ──
  const filteredEntries = entries.filter((entry) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      entry.website.toLowerCase().includes(q) ||
      entry.username.toLowerCase().includes(q)
    );
  });

  // ──────── Setup Vault ────────

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

      localStorage.setItem('vault-salt', uint8ArrayToBase64(salt));
      localStorage.setItem('vault-verify-iv', uint8ArrayToBase64(verifyIv));
      localStorage.setItem('vault-verify-token', verifyToken);

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

  // ──────── Unlock Vault ────────

  const handleUnlock = async () => {
    if (!masterPasswordInput.trim()) {
      toast.error('Please enter your master password');
      return;
    }
    try {
      setUnlocking(true);

      const saltB64 = localStorage.getItem('vault-salt');
      if (!saltB64) {
        toast.error('Vault not found. Please set up a new vault.');
        setIsNewVault(true);
        return;
      }

      const salt = base64ToUint8Array(saltB64);
      const key = await deriveKey(masterPasswordInput, salt);

      // Verify the master password by decrypting the stored token
      const verifyIvB64 = localStorage.getItem('vault-verify-iv');
      const verifyToken = localStorage.getItem('vault-verify-token');

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
      fetchEntries();
    } catch {
      toast.error('Failed to unlock vault');
    } finally {
      setUnlocking(false);
    }
  };

  // ──────── Reset Add Form ────────

  const resetAddForm = () => {
    setFormWebsite('');
    setFormUsername('');
    setFormPassword('');
    setFormNotes('');
    setShowFormPassword(false);
  };

  // ──────── Add Credential ────────

  const handleAddCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWebsite.trim() || !formUsername.trim() || !formPassword.trim()) {
      toast.error('Website, username, and password are required');
      return;
    }
    if (!derivedKey) {
      toast.error('Vault is locked');
      return;
    }
    try {
      setSaving(true);

      // Encrypt password
      const passwordIv = generateIV();
      const encryptedPassword = await encrypt(
        derivedKey,
        formPassword,
        passwordIv
      );

      // Encrypt notes (if provided) — store IV + ciphertext combined
      let encryptedNotes: string | null = null;
      if (formNotes.trim()) {
        const notesIv = generateIV();
        const notesCiphertext = await encrypt(
          derivedKey,
          formNotes.trim(),
          notesIv
        );
        encryptedNotes =
          uint8ArrayToBase64(notesIv) + '.' + notesCiphertext;
      }

      const res = await fetch('/api/passwords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          website: formWebsite.trim(),
          username: formUsername.trim(),
          encryptedPassword,
          iv: uint8ArrayToBase64(passwordIv),
          encryptedNotes,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save credential');
      }

      toast.success('Credential saved');
      setShowAddDialog(false);
      resetAddForm();
      fetchEntries();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to save credential'
      );
    } finally {
      setSaving(false);
    }
  };

  // ──────── View Entry ────────

  const handleViewEntry = async (entry: PasswordEntry) => {
    if (!derivedKey) {
      toast.error('Vault is locked');
      return;
    }
    try {
      // Reset and open modal immediately (loading state)
      setDecryptedPassword('');
      setDecryptedNotes('');
      setRevealedPassword('');
      setViewingEntry(null);
      setShowViewDialog(true);

      const res = await fetch(`/api/passwords/${entry.id}`);
      if (!res.ok) throw new Error('Failed to fetch credential');
      const full: PasswordEntryFull = await res.json();
      setViewingEntry(full);

      // Decrypt password
      const iv = base64ToUint8Array(full.iv);
      const pwd = await decrypt(derivedKey, full.encryptedPassword, iv);
      setDecryptedPassword(pwd);

      // Decrypt notes (combined format: ivBase64.ciphertext)
      if (full.encryptedNotes) {
        const dotIdx = full.encryptedNotes.indexOf('.');
        if (dotIdx !== -1) {
          const notesIv = base64ToUint8Array(full.encryptedNotes.slice(0, dotIdx));
          const notesCiphertext = full.encryptedNotes.slice(dotIdx + 1);
          try {
            const notes = await decrypt(derivedKey, notesCiphertext, notesIv);
            setDecryptedNotes(notes);
          } catch {
            setDecryptedNotes('[Decryption failed]');
          }
        }
      }
    } catch {
      toast.error('Failed to view credential');
      setShowViewDialog(false);
    }
  };

  // ──────── Copy Handlers ────────

  const handleCopyUsername = async (username: string) => {
    try {
      await navigator.clipboard.writeText(username);
      toast.success('Username copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleCopyPassword = async (entry: PasswordEntry) => {
    if (!derivedKey) {
      toast.error('Vault is locked');
      return;
    }
    try {
      const res = await fetch(`/api/passwords/${entry.id}`);
      if (!res.ok) throw new Error('Failed to fetch credential');
      const full: PasswordEntryFull = await res.json();
      const iv = base64ToUint8Array(full.iv);
      const pwd = await decrypt(derivedKey, full.encryptedPassword, iv);
      await navigator.clipboard.writeText(pwd);
      toast.success('Password copied');
    } catch {
      toast.error('Failed to copy password');
    }
  };

  // ──────── Delete Entry ────────

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const res = await fetch(`/api/passwords/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete credential');
      toast.success('Credential deleted');
      setDeleteConfirmId(null);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      toast.error('Failed to delete credential');
    } finally {
      setDeleting(false);
    }
  };

  // ──────── Render ────────

  // ── Locked / Setup Vault Screen ──
  if (!vaultUnlocked) {
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
            Password Vault
          </h1>
          <p className="text-sm text-center text-[var(--muted)] mb-8">
            {isNewVault
              ? 'Set a master password to create your encrypted vault'
              : 'Enter your master password to unlock'}
          </p>

          {/* Password input */}
          <input
            type="password"
            value={masterPasswordInput}
            onChange={(e) => setMasterPasswordInput(e.target.value)}
            placeholder={
              isNewVault ? 'Create a master password' : 'Master password'
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                isNewVault ? handleSetupVault() : handleUnlock();
              }
            }}
            className="w-full px-4 py-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all mb-4"
            autoFocus
          />

          {/* Action button */}
          <button
            onClick={isNewVault ? handleSetupVault : handleUnlock}
            disabled={unlocking}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {unlocking && <Loader2 size={16} className="animate-spin" />}
            {unlocking
              ? isNewVault
                ? 'Setting up...'
                : 'Unlocking...'
              : isNewVault
                ? 'Set Up Vault'
                : 'Unlock Vault'}
          </button>
        </div>
      </div>
    );
  }

  // ── Unlocked View ──
  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            Password Vault
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Securely stored credentials
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
              placeholder="Search credentials..."
              className="w-full sm:w-56 pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
            />
          </div>
          {/* Add button */}
          <button
            onClick={() => {
              resetAddForm();
              setShowAddDialog(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all whitespace-nowrap"
          >
            <Plus size={16} />
            Add Credential
          </button>
        </div>
      </div>

      {/* ── Loading ── */}
      {loadingEntries && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
          <Loader2 size={32} className="animate-spin mb-3" />
          <p className="text-sm">Loading credentials...</p>
        </div>
      )}

      {/* ── Empty (no entries at all) ── */}
      {!loadingEntries && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
          <Key size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium text-[var(--foreground)] mb-1">
            No credentials yet
          </p>
          <p className="text-sm mb-6">
            Add your first credential to get started.
          </p>
          <button
            onClick={() => {
              resetAddForm();
              setShowAddDialog(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all"
          >
            <Plus size={16} />
            Add Credential
          </button>
        </div>
      )}

      {/* ── Empty search results ── */}
      {!loadingEntries && entries.length > 0 && filteredEntries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-[var(--muted)]">
          <Search size={48} className="mb-4 opacity-50" />
          <p className="text-lg font-medium text-[var(--foreground)] mb-1">
            No results found
          </p>
          <p className="text-sm">
            Try a different search term.
          </p>
        </div>
      )}

      {/* ── Credential List ── */}
      {!loadingEntries && filteredEntries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-5"
            >
              {/* Website */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--border)] flex items-center justify-center shrink-0">
                  <Globe size={18} className="text-[var(--accent)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-[var(--foreground)] truncate">
                    {entry.website}
                  </h3>
                  <p className="text-sm text-[var(--muted)] truncate">
                    {entry.username}
                  </p>
                </div>
              </div>

              {/* Actions */}
              {deleteConfirmId === entry.id ? (
                /* Delete confirmation inline */
                <div className="flex items-center gap-2 pt-3 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--danger)] flex-1">
                    Are you sure?
                  </p>
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    disabled={deleting}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--danger)] text-white hover:brightness-110 transition-all disabled:opacity-50"
                  >
                    {deleting && <Loader2 size={12} className="animate-spin" />}
                    Delete
                  </button>
                </div>
              ) : (
                /* Action buttons */
                <div className="flex items-center gap-1 pt-3 border-t border-[var(--border)]">
                  <button
                    onClick={() => handleViewEntry(entry)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
                    title="View details"
                  >
                    <Eye size={14} />
                    View
                  </button>
                  <button
                    onClick={() => handleCopyUsername(entry.username)}
                    className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
                    title="Copy username"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={() => handleCopyPassword(entry)}
                    className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
                    title="Copy password"
                  >
                    <Key size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirmId(entry.id)}
                    className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--border)] transition-all ml-auto"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ──────── Add Credential Modal ──────── */}
      <Modal open={showAddDialog} onClose={() => setShowAddDialog(false)}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            New Credential
          </h2>
          <button
            onClick={() => setShowAddDialog(false)}
            className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleAddCredential} className="space-y-4">
          {/* Website */}
          <div>
            <label
              htmlFor="cred-website"
              className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
            >
              Website <span className="text-red-400">*</span>
            </label>
            <input
              id="cred-website"
              type="text"
              value={formWebsite}
              onChange={(e) => setFormWebsite(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
              autoFocus
            />
          </div>

          {/* Username */}
          <div>
            <label
              htmlFor="cred-username"
              className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
            >
              Username <span className="text-red-400">*</span>
            </label>
            <input
              id="cred-username"
              type="text"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="cred-password"
              className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
            >
              Password <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                id="cred-password"
                type={showFormPassword ? 'text' : 'password'}
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-3 py-2 pr-10 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowFormPassword(!showFormPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                tabIndex={-1}
              >
                {showFormPassword ? (
                  <EyeOff size={16} />
                ) : (
                  <Eye size={16} />
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowGenerator(!showGenerator)}
              className="mt-2 flex items-center gap-1.5 text-xs text-[var(--accent)] hover:brightness-110 transition-all"
            >
              <Wand2 size={13} />
              Generate password
            </button>

            {/* Password Generator Panel */}
            {showGenerator && (
              <div className="mt-3 p-4 rounded-lg border border-[var(--border)] bg-[var(--background)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--foreground)]">
                    Length: {genLength}
                  </span>
                  <input
                    type="range"
                    min={6}
                    max={64}
                    value={genLength}
                    onChange={(e) => setGenLength(Number(e.target.value))}
                    className="w-32 accent-[var(--accent)]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={genUppercase}
                      onChange={(e) => setGenUppercase(e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    A-Z
                  </label>
                  <label className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={genLowercase}
                      onChange={(e) => setGenLowercase(e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    a-z
                  </label>
                  <label className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={genNumbers}
                      onChange={(e) => setGenNumbers(e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    0-9
                  </label>
                  <label className="flex items-center gap-2 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={genSymbols}
                      onChange={(e) => setGenSymbols(e.target.checked)}
                      className="accent-[var(--accent)]"
                    />
                    !@#$%
                  </label>
                </div>

                <label className="flex items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={genAmbiguous}
                    onChange={(e) => setGenAmbiguous(e.target.checked)}
                    className="accent-[var(--accent)]"
                  />
                  Include ambiguous characters (o, O, 0, l, 1, I)
                </label>

                <button
                  type="button"
                  onClick={generatePassword}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all"
                >
                  <RefreshCw size={14} />
                  Generate
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="cred-notes"
              className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
            >
              Notes <span className="text-[var(--muted)] font-normal">(optional)</span>
            </label>
            <textarea
              id="cred-notes"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="Extra info, PINs, etc."
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowAddDialog(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save Credential'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ──────── View Credential Modal ──────── */}
      <Modal open={showViewDialog} onClose={() => setShowViewDialog(false)}>
        {!viewingEntry ? (
          /* Loading state inside modal */
          <div className="flex flex-col items-center justify-center py-12 text-[var(--muted)]">
            <Loader2 size={28} className="animate-spin mb-3" />
            <p className="text-sm">Decrypting...</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-[var(--foreground)] truncate pr-2">
                {viewingEntry.website}
              </h2>
              <button
                onClick={() => setShowViewDialog(false)}
                className="p-1 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Website (read-only) */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1 uppercase tracking-wider">
                  Website
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[var(--foreground)] break-all">
                    {viewingEntry.website}
                  </p>
                  <a
                    href={
                      viewingEntry.website.startsWith('http')
                        ? viewingEntry.website
                        : `https://${viewingEntry.website}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--muted)] hover:text-[var(--accent)] transition-colors shrink-0"
                    title="Open website"
                  >
                    <SquareArrowOutUpRight size={14} />
                  </a>
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1 uppercase tracking-wider">
                  Username
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[var(--foreground)] break-all flex-1">
                    {viewingEntry.username}
                  </p>
                  <button
                    onClick={() => handleCopyUsername(viewingEntry.username)}
                    className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all shrink-0"
                    title="Copy username"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-medium text-[var(--muted)] mb-1 uppercase tracking-wider">
                  Password
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] font-mono">
                    {revealedPassword || '••••••••••••'}
                  </div>
                  <button
                    onClick={() =>
                      setRevealedPassword(
                        revealedPassword ? '' : decryptedPassword
                      )
                    }
                    className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all shrink-0"
                    title={revealedPassword ? 'Hide password' : 'Show password'}
                  >
                    {revealedPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(decryptedPassword);
                        toast.success('Password copied');
                      } catch {
                        toast.error('Failed to copy');
                      }
                    }}
                    className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all shrink-0"
                    title="Copy password"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              {/* Notes */}
              {decryptedNotes && (
                <div>
                  <label className="block text-xs font-medium text-[var(--muted)] mb-1 uppercase tracking-wider">
                    Notes
                  </label>
                  <div className="flex items-start gap-2">
                    <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap break-words flex-1 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]">
                      {decryptedNotes}
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(decryptedNotes);
                          toast.success('Notes copied');
                        } catch {
                          toast.error('Failed to copy');
                        }
                      }}
                      className="p-1.5 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--border)] transition-all shrink-0 mt-2"
                      title="Copy notes"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
