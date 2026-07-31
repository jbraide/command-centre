'use client';

import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import type { ToolCallEvent } from '@/hooks/use-ai-chat';

/* ── Props ─────────────────────────────────────── */

interface ToolCardProps {
  toolCall: ToolCallEvent;
}

/* ── Icons ─────────────────────────────────────── */

const statusConfig = {
  pending: {
    icon: Loader2,
    className: 'text-yellow-400 animate-spin',
    label: 'Running…',
  },
  success: {
    icon: CheckCircle,
    className: 'text-[var(--accent)]',
    label: 'Done',
  },
  error: {
    icon: XCircle,
    className: 'text-[var(--danger)]',
    label: 'Failed',
  },
} as const;

/* ── Tool name display ─────────────────────────── */

function formatToolName(name: string) {
  return name
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Component ─────────────────────────────────── */

export default function ToolCard({ toolCall }: ToolCardProps) {
  const config = statusConfig[toolCall.status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-sm text-xs">
      <Icon size={14} className={config.className} />
      <span className="text-[var(--muted)] font-medium">
        {formatToolName(toolCall.name)}
      </span>
      <span className="text-[var(--muted)] opacity-60">·</span>
      <span className={`${toolCall.status === 'error' ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}>
        {config.label}
      </span>
      {toolCall.result && toolCall.status === 'success' && (
        <>
          <span className="text-[var(--muted)] opacity-60">·</span>
          <span className="text-[var(--muted)] truncate max-w-[120px]">
            {toolCall.result}
          </span>
        </>
      )}
    </div>
  );
}
