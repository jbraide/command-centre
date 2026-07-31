'use client';

import { useState, useRef, useCallback, KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';

/* ── Props ─────────────────────────────────────── */

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/* ── Component ─────────────────────────────────── */

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Ask the AI assistant…',
}: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = text.trim().length > 0 && !disabled;

  const handleSend = useCallback(() => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [canSend, onSend, text]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--panel)] p-4">
      <div className="flex items-end gap-2 max-w-4xl mx-auto">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full resize-none bg-[var(--background)] border border-[var(--border)]
              text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]
              rounded-sm px-3 py-2.5 pr-10
              focus:outline-none focus:border-[var(--accent)] transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!canSend}
          className={`shrink-0 flex items-center justify-center w-10 h-10 rounded-sm transition-all ${
            canSend
              ? 'bg-[var(--accent)] text-[var(--background)] hover:brightness-110'
              : 'bg-[var(--border)] text-[var(--muted)] cursor-not-allowed'
          }`}
          title="Send message (Enter)"
        >
          {disabled ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>

      <p className="text-[10px] text-[var(--muted)] text-center mt-2">
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
