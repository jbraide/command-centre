'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

/* ── Types ────────────────────────────────────── */

export interface ToolCallEvent {
  name: string;
  status: 'pending' | 'success' | 'error';
  result?: string;
}

export interface StepEvent {
  id: string;
  description: string;
  toolName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying';
  result?: unknown;
  error?: string;
  attempt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCallEvent[];
  createdAt: string;
}

export interface Session {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

interface SSEEvent {
  type:
    | 'text'
    | 'tool_call_start'
    | 'tool_call_end'
    | 'plan'
    | 'step_start'
    | 'step_complete'
    | 'step_retry'
    | 'step_error'
    | 'done'
    | 'error';
  content?: string;
  toolCall?: { name: string; status: 'pending' | 'success' | 'error'; result?: string; error?: string };
  step?: StepEvent;
  steps?: StepEvent[];
  summary?: string;
  error?: string;
}

/* ── Helpers ───────────────────────────────────── */

function parseSSELine(line: string): SSEEvent | null {
  if (!line.startsWith('data: ')) return null;
  try {
    return JSON.parse(line.slice(6));
  } catch {
    return null;
  }
}

function generateId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/* ── Hook ──────────────────────────────────────── */

export function useAiChat() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Persist current session ID in localStorage
  const STORAGE_KEY = 'ai-chat-session-id';

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setCurrentSessionId(stored);
    }
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem(STORAGE_KEY, currentSessionId);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [currentSessionId]);

  /* ── Session CRUD ───────────────────────────── */

  const fetchSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/ai/sessions');
      if (!res.ok) throw new Error('Failed to fetch sessions');
      const data = await res.json();
      setSessions(data);
    } catch (e) {
      console.error('fetchSessions error:', e);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  const fetchMessages = useCallback(async (sessionId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/ai/sessions/${sessionId}/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      setMessages(data);
    } catch (e) {
      console.error('fetchMessages error:', e);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const createSession = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Chat' }),
      });
      if (!res.ok) throw new Error('Failed to create session');
      const session: Session = await res.json();
      setSessions((prev) => [session, ...prev]);
      setCurrentSessionId(session.id);
      setMessages([]);
      return session;
    } catch (e) {
      console.error('createSession error:', e);
      return null;
    }
  }, []);

  const switchSession = useCallback(
    (id: string) => {
      setCurrentSessionId(id);
      setMessages([]);
      setError(null);
      fetchMessages(id);
    },
    [fetchMessages],
  );

  const deleteSession = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/ai/sessions/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete session');
        setSessions((prev) => prev.filter((s) => s.id !== id));
        if (currentSessionId === id) {
          setCurrentSessionId(null);
          setMessages([]);
        }
      } catch (e) {
        console.error('deleteSession error:', e);
      }
    },
    [currentSessionId],
  );

  /* ── Send Message ───────────────────────────── */

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;

      let sessionId = currentSessionId;

      // Auto-create session if none active
      if (!sessionId) {
        const session = await createSession();
        if (!session) return;
        sessionId = session.id;
      }

      const userMsg: Message = {
        id: generateId(),
        role: 'user',
        content: text.trim(),
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setSending(true);
      setThinking(true);
      setError(null);

      // Placeholder assistant message that will stream into
      const assistantMsgId = generateId();
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        toolCalls: [],
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      try {
        abortRef.current = new AbortController();

        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, message: text.trim() }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(errBody || `HTTP ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const event = parseSSELine(line);
            if (!event) continue;

            switch (event.type) {
              case 'plan':
                // Emitted when the agent creates an execution plan
                setThinking(false);
                // Optionally append plan info to the assistant message
                break;

              case 'step_start':
                setThinking(false);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          toolCalls: [
                            ...(m.toolCalls ?? []),
                            {
                              name: event.step?.toolName ?? event.toolCall?.name ?? '',
                              status: 'pending' as const,
                            },
                          ],
                        }
                      : m,
                  ),
                );
                break;

              case 'step_complete':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          toolCalls: (m.toolCalls ?? []).map((tc) =>
                            tc.name === (event.step?.toolName ?? '')
                              ? {
                                  ...tc,
                                  status: 'success' as const,
                                }
                              : tc,
                          ),
                        }
                      : m,
                  ),
                );
                break;

              case 'step_retry':
                // Update the tool call to show it's retrying
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          toolCalls: (m.toolCalls ?? []).map((tc) =>
                            tc.name === (event.step?.toolName ?? '')
                              ? { ...tc, status: 'pending' as const }
                              : tc,
                          ),
                        }
                      : m,
                  ),
                );
                break;

              case 'step_error':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          toolCalls: (m.toolCalls ?? []).map((tc) =>
                            tc.name === (event.step?.toolName ?? '')
                              ? {
                                  ...tc,
                                  status: 'error' as const,
                                  result: event.step?.error,
                                }
                              : tc,
                          ),
                        }
                      : m,
                  ),
                );
                break;

              // Legacy backward-compatible events
              case 'tool_call_start':
                setThinking(false);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          toolCalls: [
                            ...(m.toolCalls ?? []),
                            {
                              name: event.toolCall?.name ?? '',
                              status: 'pending' as const,
                            },
                          ],
                        }
                      : m,
                  ),
                );
                break;

              case 'tool_call_end':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? {
                          ...m,
                          toolCalls: (m.toolCalls ?? []).map((tc) =>
                            tc.name === event.toolCall?.name
                              ? {
                                  ...tc,
                                  status: (event.toolCall?.status as 'success' | 'error') ?? 'success',
                                  result: event.toolCall?.result ?? event.toolCall?.error,
                                }
                              : tc,
                          ),
                        }
                      : m,
                  ),
                );
                break;

              case 'text':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, content: m.content + (event.content ?? '') }
                      : m,
                  ),
                );
                break;

              case 'done':
                setThinking(false);
                break;

              case 'error':
                setError(event.error ?? 'An error occurred');
                setThinking(false);
                break;
            }
          }
        }
      } catch (e: any) {
        if (e.name === 'AbortError') return;
        setError(e.message || 'Failed to send message');
        // Remove the empty assistant message on error
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantMsgId || m.content || (m.toolCalls?.length ?? 0) > 0),
        );
      } finally {
        setSending(false);
        setThinking(false);
        abortRef.current = null;
        // Refresh session list to reflect new message count / title update
        fetchSessions();
      }
    },
    [currentSessionId, sending, createSession, fetchSessions],
  );

  /* ── Load sessions on mount ─────────────────── */

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Load messages when currentSessionId is restored from storage
  useEffect(() => {
    if (currentSessionId && messages.length === 0 && !loadingMessages) {
      fetchMessages(currentSessionId);
    }
  }, [currentSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
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
    fetchSessions,
    fetchMessages,
  };
}
