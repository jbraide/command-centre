'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Mail,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  Users,
  Zap,
  FileText,
  ChevronDown,
} from 'lucide-react';

interface BrevoStatus {
  configured: boolean;
  enabled: boolean;
  senderEmail?: string;
}

const TEMPLATES = [
  {
    name: 'Follow Up',
    subject: 'Following up — {company}',
    body: `Hi {name},

I wanted to follow up on our last conversation regarding {topic}.

Let me know if you have any questions or if there's anything else I can help with.

Best regards,
{signature}`,
  },
  {
    name: 'Invoice Reminder',
    subject: 'Invoice {invoice} — payment reminder',
    body: `Hi {name},

This is a friendly reminder that invoice {invoice} for {amount} is due.

Please let me know if you've already processed payment or if you need any clarification.

Best regards,
{signature}`,
  },
  {
    name: 'Welcome',
    subject: 'Welcome to {company}!',
    body: `Hi {name},

Welcome aboard! We're excited to have you with us.

Here's what you can expect next:
- {step1}
- {step2}
- {step3}

If you have any questions, just reply to this email.

Best regards,
{signature}`,
  },
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default function EmailPage() {
  const [brevo, setBrevo] = useState<BrevoStatus | null>(null);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templateIdx, setTemplateIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/services')
      .then((r) => r.json())
      .then((services: any[]) => {
        const bs = services.find((s: any) => s.service === 'brevo');
        setBrevo({
          configured: !!bs,
          enabled: bs?.enabled ?? false,
          senderEmail: (bs?.config as any)?.senderEmail,
        });
      })
      .catch(() => setBrevo({ configured: false, enabled: false }));
  }, []);

  const parseRecipients = (input: string): { email: string }[] => {
    return input
      .split(/[,\n;]/)
      .map((e) => e.trim())
      .filter((e) => e.includes('@'))
      .map((email) => ({ email }));
  };

  const applyTemplate = (idx: number) => {
    setTemplateIdx(idx);
    setSubject(TEMPLATES[idx].subject);
    setBody(TEMPLATES[idx].body);
    setShowTemplates(false);
  };

  const handleSend = async () => {
    const recipients = parseRecipients(to);
    if (recipients.length === 0) {
      toast.error('Enter at least one recipient email');
      return;
    }
    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!body.trim()) {
      toast.error('Email body is required');
      return;
    }

    setSending(true);
    setResult(null);
    try {
      // Convert plain text to HTML (line breaks → <br>)
      const htmlContent = body
        .split('\n')
        .map((line) => escapeHtml(line))
        .join('<br/>');

      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipients,
          subject: subject.trim(),
          htmlContent: `<p>${htmlContent}</p>`,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to send email');
      }

      setResult({ ok: true, message: `Email sent to ${recipients.length} recipient(s)` });
      toast.success('Email sent!');
      setTo(''); setSubject(''); setBody(''); setTemplateIdx(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to send email';
      setResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-blue-500/20">
          <Mail size={22} className="text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">Email</h1>
          <p className="text-sm text-[var(--muted)]">
            Send emails via Brevo — powered by your integrations
          </p>
        </div>
      </div>

      {/* Brevo status */}
      {brevo && (
        <div
          className={`flex items-center gap-2 p-3 rounded-lg border text-sm ${
            brevo.configured && brevo.enabled
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
          }`}
        >
          {brevo.configured && brevo.enabled ? (
            <>
              <CheckCircle size={16} />
              <span>
                Brevo connected
                {brevo.senderEmail ? ` — sending from ${brevo.senderEmail}` : ''}
              </span>
            </>
          ) : (
            <>
              <XCircle size={16} />
              <span>
                Brevo not configured.{' '}
                <a href="/integrations/brevo" className="underline hover:opacity-80">
                  Configure it in Integrations
                </a>
              </span>
            </>
          )}
        </div>
      )}

      {/* Templates dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] hover:border-[var(--accent)] transition-colors"
        >
          <Zap size={14} className="text-[var(--accent)]" />
          Templates
          <ChevronDown size={14} className="text-[var(--muted)]" />
        </button>
        {showTemplates && (
          <div className="absolute z-10 mt-1 w-64 rounded-lg border border-[var(--border)] bg-[var(--panel)] shadow-xl overflow-hidden">
            {TEMPLATES.map((t, i) => (
              <button
                key={t.name}
                onClick={() => applyTemplate(i)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-[var(--background)] transition-colors"
              >
                <FileText size={14} className="text-[var(--accent)] shrink-0" />
                <div>
                  <div className="text-[var(--foreground)]">{t.name}</div>
                  <div className="text-xs text-[var(--muted)] truncate">{t.subject}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Compose card */}
      <div className="border border-[var(--border)] bg-[var(--panel)] rounded-lg overflow-hidden">
        {/* To */}
        <div className="px-5 pt-5">
          <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
            To <span className="text-red-400">*</span>
          </label>
          <div className="flex items-center gap-2">
            <Users size={14} className="text-[var(--muted)] shrink-0" />
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="person@example.com, other@example.com"
              className="flex-1 bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>
          <p className="text-xs text-[var(--muted)] mt-1">
            Separate multiple recipients with commas.
          </p>
        </div>

        {/* Subject */}
        <div className="px-5 pt-4">
          <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
            Subject <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
            Message <span className="text-red-400">*</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message... Use {name}, {company}, {signature} placeholders in templates."
            rows={10}
            className="w-full bg-[var(--background)] border border-[var(--border)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:border-[var(--accent)] transition-colors resize-y"
          />
          <p className="text-xs text-[var(--muted)] mt-1">
            Plain text — line breaks become paragraphs. Templates use placeholders like{' '}
            <code className="text-[var(--accent)]">{'{name}'}</code>.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between px-5 pb-5">
          <div className="text-xs text-[var(--muted)]">
            {templateIdx !== null && (
              <span className="inline-flex items-center gap-1.5 text-[var(--accent)]">
                <Zap size={12} /> Template: {TEMPLATES[templateIdx].name}
              </span>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={sending || !brevo?.configured || !brevo?.enabled}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? 'Sending...' : 'Send Email'}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div
          className={`flex items-start gap-2 p-4 rounded-lg text-sm ${
            result.ok
              ? 'border border-green-500/30 bg-green-500/10 text-green-400'
              : 'border border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {result.ok ? (
            <CheckCircle size={16} className="mt-0.5 shrink-0" />
          ) : (
            <XCircle size={16} className="mt-0.5 shrink-0" />
          )}
          <span>{result.message}</span>
        </div>
      )}
    </div>
  );
}
