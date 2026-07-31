'use client';

import { User, Bot } from 'lucide-react';
import type { Message } from '@/hooks/use-ai-chat';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ── Props ─────────────────────────────────────── */

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
}

/* ── Helpers ───────────────────────────────────── */

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/* ── Component ─────────────────────────────────── */

export default function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`shrink-0 w-7 h-7 rounded-sm flex items-center justify-center ${
          isUser
            ? 'bg-[var(--accent)] text-[var(--background)]'
            : 'bg-[var(--border)] text-[var(--muted)]'
        }`}
      >
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] min-w-0 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3.5 py-2.5 rounded-sm text-sm leading-relaxed break-words ${
            isUser
              ? 'bg-[var(--accent)] text-[var(--background)] whitespace-pre-wrap'
              : 'bg-[var(--panel)] border border-[var(--border)] text-[var(--foreground)]'
          }`}
        >
          {isUser ? (
            message.content
          ) : message.content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => <h1 className="text-base font-bold mt-3 mb-1 text-[var(--accent)]" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-sm font-semibold mt-2.5 mb-1 text-[var(--accent)]" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-xs font-semibold mt-2 mb-0.5 text-[var(--foreground)]" {...props} />,
                p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
                li: ({ node, ...props }) => <li className="text-sm" {...props} />,
                a: ({ node, ...props }) => <a className="text-[var(--accent)] hover:underline font-medium" target="_blank" rel="noopener noreferrer" {...props} />,
                code: ({ node, className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match;
                  return isInline ? (
                    <code className="bg-[var(--background)] px-1 py-0.5 rounded text-[11px] border border-[var(--border)] font-mono text-[var(--warning)]" {...props}>
                      {children}
                    </code>
                  ) : (
                    <pre className="bg-[var(--background)] p-2.5 rounded-sm border border-[var(--border)] my-2 overflow-x-auto">
                      <code className="text-[11px] font-mono block text-[var(--foreground)]" {...props}>
                        {children}
                      </code>
                    </pre>
                  );
                },
                table: ({ node, ...props }) => <table className="w-full border-collapse border border-[var(--border)] my-2 text-xs" {...props} />,
                th: ({ node, ...props }) => <th className="border border-[var(--border)] bg-[var(--background)] p-1.5 text-left font-semibold text-[var(--accent)]" {...props} />,
                td: ({ node, ...props }) => <td className="border border-[var(--border)] p-1.5 text-[var(--muted)]" {...props} />,
                blockquote: ({ node, ...props }) => <blockquote className="border-l-2 border-[var(--border)] pl-3 italic my-2 text-[var(--muted)]" {...props} />,
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : isStreaming ? (
            <span className="inline-flex gap-0.5">
              <span className="animate-pulse">▊</span>
              <span className="animate-pulse animation-delay-200">▊</span>
              <span className="animate-pulse animation-delay-400">▊</span>
            </span>
          ) : (
            <span className="text-[var(--muted)] italic">No content</span>
          )}
        </div>

        {/* Timestamp */}
        <p
          className={`text-[10px] text-[var(--muted)] mt-1 px-0.5 ${
            isUser ? 'text-right' : 'text-left'
          }`}
        >
          {formatTime(message.createdAt)}
          {isStreaming && ' · Streaming…'}
        </p>
      </div>
    </div>
  );
}
