'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  HardDriveUpload,
  Upload,
  Loader2,
  FileVideo,
  FileText,
  Trash2,
  Copy,
  Download,
  CloudOff,
  FolderUp,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

/* ------------------------------------------------------------------ */
/*  Types & helpers                                                    */
/* ------------------------------------------------------------------ */

interface R2Object {
  key: string;
  size: number;
  lastModified: string;
}

interface UploadEntry {
  id: string;
  name: string;
  key: string;
  progress: number;
  state: 'uploading' | 'done' | 'error';
  error?: string;
}

type PageStatus = 'loading' | 'unconfigured' | 'ready';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  );
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i;
const VIDEO_EXT = /\.(mp4|webm|mov|avi|mkv|m4v)$/i;

function fileKind(key: string): 'image' | 'video' | 'other' {
  if (IMAGE_EXT.test(key)) return 'image';
  if (VIDEO_EXT.test(key)) return 'video';
  return 'other';
}

function fileNameFromKey(key: string): string {
  return key.split('/').pop() ?? key;
}

function sanitizeFileName(name: string): string {
  const safe = name.replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe || 'file';
}

function uploadWithProgress(
  file: File,
  key: string,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/r2/files');
    xhr.setRequestHeader('x-file-key', key);
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let message = 'Upload failed';
        try {
          const body = JSON.parse(xhr.responseText);
          message = body.error || message;
        } catch {}
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

function FileThumb({ obj }: { obj: R2Object }) {
  const kind = fileKind(obj.key);
  if (kind === 'image') {
    return (
      <div className="h-12 w-12 shrink-0 rounded-sm overflow-hidden border border-[var(--border)] bg-[var(--panel)] flex items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/r2/object?key=${encodeURIComponent(obj.key)}`}
          alt={obj.key}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }
  const Icon = kind === 'video' ? FileVideo : FileText;
  return (
    <div className="h-12 w-12 shrink-0 rounded-sm border border-[var(--border)] bg-[var(--panel)] flex items-center justify-center text-[var(--muted)]">
      <Icon size={20} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function StoragePage() {
  const [status, setStatus] = useState<PageStatus>('loading');
  const [listError, setListError] = useState('');
  const [objects, setObjects] = useState<R2Object[]>([]);
  const [publicBaseUrl, setPublicBaseUrl] = useState<string | null>(null);
  const [folder, setFolder] = useState('uploads/');
  const [search, setSearch] = useState('');
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    setListError('');
    try {
      const res = await fetch('/api/r2/files');
      const data = await res.json();
      if (data.configured === false) {
        setStatus('unconfigured');
        return;
      }
      if (!res.ok || data.error) {
        setListError(data.error || 'Failed to list files');
        setStatus('ready');
        return;
      }
      setObjects(data.objects ?? []);
      setPublicBaseUrl(data.publicBaseUrl ?? null);
      setStatus('ready');
    } catch {
      setListError('Failed to load files');
      setStatus('ready');
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleFiles = async (incoming: FileList | File[]) => {
    const files = Array.from(incoming);
    if (files.length === 0) return;

    const folderPath = folder.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    const prefix = folderPath ? `${folderPath}/` : '';
    const existingKeys = new Set(objects.map((o) => o.key));

    const jobs = files.map((file) => {
      const safe = sanitizeFileName(file.name);
      let key = `${prefix}${safe}`;
      if (existingKeys.has(key)) key = `${prefix}${Date.now()}-${safe}`;
      existingKeys.add(key);
      return { file, key };
    });

    const entries: UploadEntry[] = jobs.map(({ file, key }) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      key,
      progress: 0,
      state: 'uploading',
    }));
    setUploads((prev) => [...entries, ...prev]);

    // Upload sequentially to avoid hammering the bucket with parallel large files
    for (let i = 0; i < jobs.length; i++) {
      const { file, key } = jobs[i];
      const entry = entries[i];
      try {
        await uploadWithProgress(file, key, (progress) => {
          setUploads((prev) =>
            prev.map((u) => (u.id === entry.id ? { ...u, progress } : u))
          );
        });
        setUploads((prev) =>
          prev.map((u) =>
            u.id === entry.id ? { ...u, state: 'done', progress: 100 } : u
          )
        );
        toast.success(`Uploaded ${file.name}`);
      } catch (e) {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === entry.id
              ? { ...u, state: 'error', error: e instanceof Error ? e.message : 'Upload failed' }
              : u
          )
        );
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    fetchFiles();
  };

  const handleDelete = async (key: string) => {
    setDeletingKey(key);
    try {
      const res = await fetch(`/api/r2/files?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'Failed to delete file');
      setObjects((prev) => prev.filter((o) => o.key !== key));
      setConfirmDeleteKey(null);
      toast.success('File deleted');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete file');
    } finally {
      setDeletingKey(null);
    }
  };

  const copyUrl = async (obj: R2Object) => {
    const url = publicBaseUrl
      ? `${publicBaseUrl.replace(/\/+$/, '')}/${obj.key
          .split('/')
          .map(encodeURIComponent)
          .join('/')}`
      : obj.key;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(publicBaseUrl ? 'Public URL copied' : 'Object key copied');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const filtered = search.trim()
    ? objects.filter((o) => o.key.toLowerCase().includes(search.toLowerCase()))
    : objects;

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <HardDriveUpload className="text-[var(--accent)]" size={24} />
            File Storage
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Upload and manage files in your Cloudflare R2 bucket.
          </p>
        </div>
        {status === 'ready' && (
          <button
            onClick={fetchFiles}
            className="flex items-center gap-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        )}
      </div>

      {/* Loading */}
      {status === 'loading' && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 rounded-sm bg-[var(--panel)] border border-[var(--border)] animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Not configured */}
      {status === 'unconfigured' && (
        <div className="rounded-sm border border-dashed border-[var(--border)] bg-[var(--panel)]/50 p-12 text-center space-y-4">
          <CloudOff size={36} className="mx-auto text-[var(--muted)]" />
          <div>
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Cloudflare R2 is not configured
            </h3>
            <p className="text-xs text-[var(--muted)] mt-1 max-w-md mx-auto">
              Add your R2 credentials in Integrations — you&apos;ll need your
              Account ID, Access Key ID, Bucket Name, and a Secret Access Key
              stored in the API Key Store.
            </p>
          </div>
          <Link
            href="/integrations/cloudflare"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <HardDriveUpload size={16} />
            Configure Cloudflare R2
          </Link>
        </div>
      )}

      {/* Configured */}
      {status === 'ready' && (
        <>
          {/* Error banner */}
          {listError && (
            <div className="flex items-start gap-3 p-4 rounded-sm border border-red-500/30 bg-red-500/10 text-sm text-red-400">
              <XCircle size={18} className="mt-0.5 shrink-0" />
              <span className="flex-1">{listError}</span>
              <button onClick={fetchFiles} className="hover:text-red-300 shrink-0">
                <RefreshCw size={14} />
              </button>
            </div>
          )}

          {/* Upload card */}
          <div className="rounded-sm border border-[var(--border)] bg-[var(--panel)] p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FolderUp size={18} className="text-[var(--accent)]" />
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Upload Files
              </h3>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                  Folder (optional)
                </label>
                <input
                  type="text"
                  value={folder}
                  onChange={(e) => setFolder(e.target.value)}
                  placeholder="uploads/"
                  className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
              <div className="sm:self-end">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 px-5 py-2 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  <Upload size={16} />
                  Choose Files
                </button>
              </div>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-sm border border-dashed p-8 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                  : 'border-[var(--border)] hover:border-[var(--accent)]/50'
              }`}
            >
              <Upload size={24} className="mx-auto text-[var(--muted)] mb-2" />
              <p className="text-sm text-[var(--foreground)]">
                Drag &amp; drop files here, or click to browse
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">
                Files, images, and videos — uploads go to{' '}
                <span className="font-mono">{folder || 'the bucket root'}</span>
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) handleFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Upload queue */}
            {uploads.length > 0 && (
              <div className="space-y-2">
                {uploads.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 p-3 rounded-sm border border-[var(--border)] bg-[var(--background)]"
                  >
                    {u.state === 'uploading' ? (
                      <Loader2 size={16} className="shrink-0 text-[var(--accent)] animate-spin" />
                    ) : u.state === 'done' ? (
                      <CheckCircle2 size={16} className="shrink-0 text-green-400" />
                    ) : (
                      <XCircle size={16} className="shrink-0 text-red-400" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--foreground)] truncate">
                        {u.name}
                        {u.error && (
                          <span className="text-red-400 normal-case"> — {u.error}</span>
                        )}
                      </p>
                      <div className="h-1 bg-[var(--border)] mt-1.5 overflow-hidden rounded-sm">
                        <div
                          className={`h-full transition-all ${
                            u.state === 'error' ? 'bg-red-400' : 'bg-[var(--accent)]'
                          }`}
                          style={{ width: `${u.progress}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-[var(--muted)] shrink-0">
                      {u.state === 'done' ? 'Done' : u.state === 'error' ? 'Failed' : `${u.progress}%`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Files list */}
          <div className="rounded-sm border border-[var(--border)] bg-[var(--panel)] p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="text-sm font-semibold text-[var(--foreground)]">
                Files ({objects.length})
              </h3>
              <div className="relative w-full sm:w-64">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search files..."
                  className="w-full pl-9 pr-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              </div>
            </div>

            {objects.length === 0 ? (
              <div className="text-center py-12">
                <HardDriveUpload size={28} className="mx-auto text-[var(--muted)] mb-2" />
                <p className="text-sm text-[var(--muted)]">No files yet — upload something above.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12">
                <Search size={24} className="mx-auto text-[var(--muted)] mb-2" />
                <p className="text-sm text-[var(--muted)]">
                  No files match &ldquo;{search}&rdquo;.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((obj) => (
                  <div
                    key={obj.key}
                    className="flex items-center gap-3 p-3 rounded-sm border border-[var(--border)] bg-[var(--background)]"
                  >
                    <FileThumb obj={obj} />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--foreground)] truncate">
                        {obj.key}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {formatBytes(obj.size)} · {formatDate(obj.lastModified)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => copyUrl(obj)}
                        title={publicBaseUrl ? 'Copy public URL' : 'Copy object key'}
                        className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                      >
                        <Copy size={15} />
                      </button>
                      <a
                        href={`/api/r2/object?key=${encodeURIComponent(obj.key)}`}
                        download={fileNameFromKey(obj.key)}
                        title="Download"
                        className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                      >
                        <Download size={15} />
                      </a>
                      {confirmDeleteKey === obj.key ? (
                        <button
                          onClick={() => handleDelete(obj.key)}
                          disabled={deletingKey === obj.key}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-sm bg-red-500/15 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors disabled:opacity-50"
                        >
                          {deletingKey === obj.key ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                          Confirm
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteKey(obj.key)}
                          title="Delete"
                          className="p-2 text-[var(--muted)] hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
