'use client';

import { Bot, MessageSquare } from 'lucide-react';
import { useAiChat } from '@/hooks/use-ai-chat';
import ChatSidebar from '@/components/ai/chat-sidebar';
import ChatMessages from '@/components/ai/chat-messages';
import ChatInput from '@/components/ai/chat-input';

/* ── Skeleton ──────────────────────────────────── */

function ChatSkeleton() {
  return (
    <div className="flex h-full">
      {/* Sidebar skeleton */}
      <div className="w-60 border-r border-[var(--border)] p-3 space-y-3 animate-pulse">
        <div className="h-9 bg-[var(--border)] rounded-sm" />
        <div className="h-7 bg-[var(--border)] rounded-sm" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-[var(--border)] rounded-sm" />
        ))}
      </div>
      {/* Chat area skeleton */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <Loader2Icon />
        </div>
      </div>
    </div>
  );
}

function Loader2Icon() {
  return (
    <div className="animate-pulse flex flex-col items-center gap-3">
      <Bot size={48} className="text-[var(--border)]" />
      <div className="h-4 w-48 bg-[var(--border)] rounded-sm" />
      <div className="h-3 w-32 bg-[var(--border)] rounded-sm" />
    </div>
  );
}

/* ── Page ──────────────────────────────────────── */

export default function AiChatPage() {
  const {
    sessions,
    currentSessionId,
    messages,
    sending,
    thinking,
    loadingSessions,
    loadingMessages,
    error,
    sendMessage,
    createSession,
    switchSession,
    deleteSession,
  } = useAiChat();

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-3rem)] -m-4 md:-m-8">
      {/* ─── Sidebar ─────────────────────────────── */}
      <div className="hidden md:flex flex-col w-60 border-r border-[var(--border)] bg-[var(--panel)]">
        <ChatSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          loading={loadingSessions}
          onNewChat={createSession}
          onSwitch={switchSession}
          onDelete={deleteSession}
        />
      </div>

      {/* ─── Main Chat Area ─────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {currentSessionId ? (
          <>
            <ChatMessages
              messages={messages}
              loading={loadingMessages}
              thinking={thinking}
              error={error}
            />
            <ChatInput
              onSend={sendMessage}
              disabled={sending}
            />
          </>
        ) : (
          /* ── Empty state ───────────────────────── */
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
            <Bot size={56} className="text-[var(--border)]" />
            <div className="text-center max-w-sm">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                AI Assistant
              </h2>
              <p className="text-sm text-[var(--muted)] mt-1">
                Select a session from the sidebar or start a new chat to begin
              </p>
            </div>

            {/* Mobile: show session list inline */}
            <div className="md:hidden w-full max-w-sm mt-4 border border-[var(--border)] rounded-sm">
              <ChatSidebar
                sessions={sessions}
                currentSessionId={currentSessionId}
                loading={loadingSessions}
                onNewChat={createSession}
                onSwitch={switchSession}
                onDelete={deleteSession}
              />
            </div>

            <button
              onClick={createSession}
              className="mt-2 flex items-center gap-2 px-4 py-2 text-sm font-medium
                bg-[var(--accent)] text-[var(--background)] hover:brightness-110 transition-all rounded-sm"
            >
              <MessageSquare size={16} />
              Start New Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
