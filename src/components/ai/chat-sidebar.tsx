'use client';

import { useState, useMemo } from 'react';
import { Plus, MessageSquare, Trash2, Search, Loader2 } from 'lucide-react';
import type { Session } from '@/hooks/use-ai-chat';

/* ── Helpers ───────────────────────────────────── */

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Props ─────────────────────────────────────── */

interface ChatSidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  loading: boolean;
  onNewChat: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
}

/* ── Component ─────────────────────────────────── */

export default function ChatSidebar({
  sessions,
  currentSessionId,
  loading,
  onNewChat,
  onSwitch,
  onDelete,
}: ChatSidebarProps) {
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return sessions;
    const q = search.toLowerCase();
    return sessions.filter((s) => s.title.toLowerCase().includes(q));
  }, [sessions, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-[var(--border)]">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium
            bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all rounded-sm"
        >
          <Plus size={16} />
          New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            type="text"
            placeholder="Search sessions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--background)] border border-[var(--border)]
              text-[var(--foreground)] placeholder:text-[var(--muted)] rounded-sm
              focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="text-[var(--muted)] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-[var(--muted)] text-center py-8 italic">
            {search ? 'No matching sessions' : 'No sessions yet'}
          </p>
        ) : (
          filtered.map((session) => {
            const isActive = session.id === currentSessionId;
            const msgCount = session._count?.messages ?? 0;

            return (
              <div
                key={session.id}
                className={`group relative flex items-center gap-2 px-3 py-2 rounded-sm cursor-pointer transition-colors ${
                  isActive
                    ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/30'
                    : 'border border-transparent hover:bg-[var(--background)] hover:border-[var(--border)]'
                }`}
                onClick={() => onSwitch(session.id)}
              >
                <MessageSquare
                  size={14}
                  className={`shrink-0 ${
                    isActive ? 'text-[var(--accent)]' : 'text-[var(--muted)]'
                  }`}
                />

                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs truncate ${
                      isActive ? 'text-[var(--foreground)] font-medium' : 'text-[var(--muted)]'
                    }`}
                    title={session.title}
                  >
                    {session.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-[var(--muted)]">
                      {formatDate(session.updatedAt || session.createdAt)}
                    </span>
                    {msgCount > 0 && (
                      <span className="text-[10px] text-[var(--muted)]">
                        {msgCount} msg{msgCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeletingId(session.id);
                    onDelete(session.id);
                  }}
                  className="shrink-0 p-1 text-[var(--muted)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-all"
                  title="Delete session"
                >
                  {deletingId === session.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
