'use client';

import { useEffect, useRef } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import MessageBubble from './message-bubble';
import ToolCard from './tool-card';
import type { Message } from '@/hooks/use-ai-chat';

/* ── Props ─────────────────────────────────────── */

interface ChatMessagesProps {
  messages: Message[];
  loading: boolean;
  thinking: boolean;
  error: string | null;
}

/* ── Component ─────────────────────────────────── */

export default function ChatMessages({
  messages,
  loading,
  thinking,
  error,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  /* ── Loading state ──────────────────────────── */

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={24} className="text-[var(--accent)] animate-spin" />
      </div>
    );
  }

  /* ── Empty state ────────────────────────────── */

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        <MessageSquare size={40} className="text-[var(--border)]" />
        <div className="text-center">
          <p className="text-sm font-medium text-[var(--muted)]">
            Start a conversation
          </p>
          <p className="text-xs text-[var(--muted)] mt-1 opacity-60">
            Ask me anything about your projects, tasks, or ideas
          </p>
        </div>
      </div>
    );
  }

  /* ── Messages ───────────────────────────────── */

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {messages.map((msg, i) => (
          <div key={msg.id} className="space-y-2">
            <MessageBubble
              message={msg}
              isStreaming={
                msg.role === 'assistant' &&
                i === messages.length - 1 &&
                thinking
              }
            />

            {/* Tool calls inline between bubbles */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="flex flex-col gap-1.5 pl-10">
                {msg.toolCalls.map((tc, j) => (
                  <ToolCard key={`${msg.id}-tc-${j}`} toolCall={tc} />
                ))}
              </div>
            )}

            {/* Date separator between days */}
            {i < messages.length - 1 &&
              new Date(msg.createdAt).toDateString() !==
                new Date(messages[i + 1].createdAt).toDateString() && (
                <div className="flex items-center gap-3 py-2">
                  <div className="flex-1 h-px bg-[var(--border)]" />
                  <span className="text-[10px] text-[var(--muted)] uppercase tracking-wider">
                    {new Date(msg.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <div className="flex-1 h-px bg-[var(--border)]" />
                </div>
              )}
          </div>
        ))}

        {/* Error banner */}
        {error && (
          <div className="px-3 py-2 bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-sm text-xs text-[var(--danger)]">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
