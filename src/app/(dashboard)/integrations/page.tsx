'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mail,
  Cloud,
  Plug,
  Zap,
  Brain,
  ToggleLeft,
  ToggleRight,
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface ServiceConfigField {
  key: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'select';
  required: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
}

interface AvailableService {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  fields: ServiceConfigField[];
  color: string;
}

interface ServiceIntegration {
  id: string;
  service: string;
  label: string;
  enabled: boolean;
  createdAt: string;
  config: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Available services                                                */
/* ------------------------------------------------------------------ */

const AVAILABLE_SERVICES: AvailableService[] = [
  {
    id: 'brevo',
    name: 'Brevo Email',
    description: 'Send transactional emails — invoices, notifications, and more.',
    icon: Mail,
    fields: [
      { key: 'senderEmail', label: 'Sender Email', type: 'email', required: true },
      { key: 'senderName', label: 'Sender Name', type: 'text', required: false },
    ],
    color: 'text-blue-400',
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    description: 'DNS management, caching, and performance optimization.',
    icon: Cloud,
    fields: [
      { key: 'zoneId', label: 'Zone ID', type: 'text', required: true },
      { key: 'email', label: 'Account Email', type: 'email', required: true },
    ],
    color: 'text-orange-400',
  },
  {
    id: 'zapier-mcp',
    name: 'Zapier MCP',
    description: 'Connect to 8000+ apps via Zapier\'s MCP server — Calendar, Gmail, Google Docs, and more.',
    icon: Zap,
    fields: [
      { key: 'apiKey', label: 'Zapier API Key', type: 'password', required: true },
      { key: 'endpointUrl', label: 'MCP Endpoint URL', type: 'text', required: true, placeholder: 'https://actions.zapier.com/mcp/...' },
    ],
    color: 'text-orange-400',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek AI',
    description: 'AI script generation and assistant — configure your API key and model.',
    icon: Brain,
    fields: [
      { key: 'model', label: 'Model', type: 'select', required: false, options: [
        { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash (fast)' },
        { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro (thinking)' },
      ]},
    ],
    color: 'text-purple-400',
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function IntegrationsPage() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<ServiceIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/services');
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to load integrations');
      }
      const data: ServiceIntegration[] = await res.json();
      setIntegrations(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const getIntegration = (serviceId: string): ServiceIntegration | undefined =>
    integrations.find((i) => i.service === serviceId);

  const handleToggle = async (integration: ServiceIntegration) => {
    setToggling(integration.id);
    try {
      const res = await fetch(`/api/services/${integration.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !integration.enabled }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to toggle integration');
      }

      const updated: ServiceIntegration = await res.json();
      setIntegrations((prev) =>
        prev.map((i) => (i.id === updated.id ? updated : i))
      );
      toast.success(
        `${updated.label} ${updated.enabled ? 'enabled' : 'disabled'}`
      );
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to toggle integration'
      );
    } finally {
      setToggling(null);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <Plug className="text-[var(--accent)]" size={24} />
          Integrations
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Connect external services to your Command Center. API keys are stored
          securely in the{' '}
          <a
            href="/api-keys"
            className="text-[var(--accent)] hover:underline"
          >
            API Key Store
          </a>
          .
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-sm border border-red-500/30 bg-red-500/10 text-sm text-red-400">
          <XCircle size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="hover:text-red-300">
            <ArrowRight size={16} className="rotate-45" />
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-40 rounded-sm bg-[var(--panel)] border border-[var(--border)] animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Services grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_SERVICES.map((service) => {
            const integration = getIntegration(service.id);
            const Icon = service.icon;
            const isConnected = !!integration;

            return (
              <div
                key={service.id}
                className="rounded-sm border border-[var(--border)] bg-[var(--panel)] p-5 flex flex-col gap-4"
              >
                {/* Top row: icon + status */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-sm bg-[var(--background)] ${service.color}`}
                    >
                      <Icon size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-[var(--foreground)]">
                        {service.name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 text-xs mt-0.5 ${
                          isConnected
                            ? integration?.enabled
                              ? 'text-green-400'
                              : 'text-yellow-400'
                            : 'text-[var(--muted)]'
                        }`}
                      >
                        {isConnected ? (
                          integration?.enabled ? (
                            <>
                              <CheckCircle size={12} />
                              Connected
                            </>
                          ) : (
                            <>
                              <ToggleLeft size={12} />
                              Disabled
                            </>
                          )
                        ) : (
                          <>
                            <XCircle size={12} />
                            Not Connected
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-[var(--muted)] leading-relaxed flex-1">
                  {service.description}
                </p>

                {/* Bottom row: actions */}
                <div className="flex items-center justify-between pt-1">
                  {isConnected && (
                    <button
                      onClick={() => handleToggle(integration!)}
                      disabled={toggling === integration!.id}
                      className={`flex items-center gap-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                        integration!.enabled
                          ? 'text-yellow-400 hover:text-yellow-300'
                          : 'text-green-400 hover:text-green-300'
                      }`}
                    >
                      {toggling === integration!.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : integration!.enabled ? (
                        <ToggleRight size={16} />
                      ) : (
                        <ToggleLeft size={16} />
                      )}
                      {integration!.enabled ? 'Disable' : 'Enable'}
                    </button>
                  )}
                  {!isConnected && <div />}

                  <button
                    onClick={() => router.push(`/integrations/${service.id}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-xs font-medium hover:opacity-90 transition-opacity"
                  >
                    {isConnected ? 'Reconfigure' : 'Configure'}
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Placeholder for future services */}
          <div className="rounded-sm border border-dashed border-[var(--border)] bg-[var(--panel)]/50 p-5 flex flex-col items-center justify-center gap-2 text-center opacity-60">
            <Zap size={24} className="text-[var(--muted)]" />
            <p className="text-xs text-[var(--muted)]">
              More integrations coming soon
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
