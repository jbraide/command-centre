'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Save,
  Loader2,
  Key,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Mail,
  Cloud,
  Plug,
  Send,
  Zap,
  Brain,
  CheckCircle2,
  XCircle,
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

interface ApiKeyEntry {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
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

const SERVICE_ICON_MAP: Record<string, LucideIcon> = {
  brevo: Mail,
  cloudflare: Cloud,
  'zapier-mcp': Zap,
  deepseek: Brain,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function ServiceConfigPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.service as string;

  // Lookup service definition
  const serviceDef = AVAILABLE_SERVICES.find((s) => s.id === serviceId);
  const ServiceIcon = serviceDef
    ? serviceDef.icon
    : SERVICE_ICON_MAP[serviceId] || Plug;

  /* Data state */
  const [integration, setIntegration] = useState<ServiceIntegration | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');

  /* Form state */
  const [selectedApiKeyId, setSelectedApiKeyId] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [label, setLabel] = useState('');
  const [enabled, setEnabled] = useState(true);

  /* Test email state */
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  /* Test connection state (Zapier MCP) */
  const [testConnecting, setTestConnecting] = useState(false);
  const [testConnectionResult, setTestConnectionResult] = useState<{ ok: boolean; message: string; tools?: string[] } | null>(null);

  /* Test connection state (DeepSeek) */
  const [deepseekTesting, setDeepseekTesting] = useState(false);
  const [deepseekTestResult, setDeepseekTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  /* Masked key display */
  const [revealedKeyId, setRevealedKeyId] = useState<string | null>(null);
  const [revealedKeyValue, setRevealedKeyValue] = useState('');
  const [fetchingReveal, setFetchingReveal] = useState(false);

  /* Fetch initial data */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [servicesRes, keysRes] = await Promise.all([
        fetch('/api/services'),
        fetch('/api/api-keys'),
      ]);

      if (!servicesRes.ok) {
        const body = await servicesRes.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to load services');
      }
      if (!keysRes.ok) {
        const body = await keysRes.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to load API keys');
      }

      const services: ServiceIntegration[] = await servicesRes.json();
      const keys: ApiKeyEntry[] = await keysRes.json();

      setApiKeys(keys);

      // Find existing config for this service
      const existing = services.find((s) => s.service === serviceId) ?? null;
      setIntegration(existing);

      if (existing) {
        setLabel(existing.label);
        setEnabled(existing.enabled);

        // Populate field values from existing config
        const config = existing.config as Record<string, string>;
        const values: Record<string, string> = {};
        if (serviceDef) {
          for (const field of serviceDef.fields) {
            values[field.key] = config[field.key] ?? '';
          }
        }
        // Also populate apiKeyId if it exists in config
        if (config.apiKeyId) {
          setSelectedApiKeyId(config.apiKeyId);
        }
        setFieldValues(values);
      } else {
        // Defaults for new config
        setLabel(serviceDef?.name ?? '');
        setEnabled(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [serviceId, serviceDef]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* Fetch revealed key */
  const fetchDecryptedKey = async (id: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/api-keys/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to fetch key');
      }
      const data = await res.json();
      return data.key ?? null;
    } catch {
      return null;
    }
  };

  const handleReveal = async (id: string) => {
    if (revealedKeyId === id) {
      setRevealedKeyId(null);
      setRevealedKeyValue('');
      return;
    }

    setFetchingReveal(true);
    const key = await fetchDecryptedKey(id);
    if (key !== null) {
      setRevealedKeyId(id);
      setRevealedKeyValue(key);
    } else {
      toast.error('Failed to decrypt key');
    }
    setFetchingReveal(false);
  };

  /* Handle field value changes */
  const handleFieldChange = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
  };

  /* Save */
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    // Validation
    if (!selectedApiKeyId) {
      setFormError('Please select an API key.');
      return;
    }

    if (serviceDef) {
      for (const field of serviceDef.fields) {
        if (field.required && !fieldValues[field.key]?.trim()) {
          setFormError(`"${field.label}" is required.`);
          return;
        }
      }
    }

    if (!label.trim()) {
      setFormError('Label is required.');
      return;
    }

    setSaving(true);
    try {
      const config: Record<string, unknown> = {
        apiKeyId: selectedApiKeyId,
      };
      for (const [key, value] of Object.entries(fieldValues)) {
        if (value.trim()) {
          config[key] = value.trim();
        }
      }

      const res = await fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: serviceId,
          label: label.trim(),
          config,
          enabled,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? 'Failed to save configuration');
      }

      toast.success(
        integration
          ? `${label.trim()} configuration updated`
          : `${label.trim()} connected`
      );
      router.push('/integrations');
    } catch (e: unknown) {
      toast.error(
        e instanceof Error ? e.message : 'Failed to save configuration'
      );
    } finally {
      setSaving(false);
    }
  };

  /* Send test email */
  const handleSendTest = async () => {
    if (!testEmail.trim()) return;

    setTestSending(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [{ email: testEmail.trim() }],
          subject: 'Command Center — Test Email from Brevo',
          htmlContent:
            '<h2>✅ Brevo is working!</h2><p>Your Command Center email integration is configured correctly.</p><p>Sent at: ' +
            new Date().toLocaleString() +
            '</p>',
        }),
      });

      const body = await res.json().catch(() => null);

      if (res.ok) {
        setTestResult({ ok: true, message: 'Test email sent successfully!' });
      } else {
        setTestResult({
          ok: false,
          message: body?.error ?? body?.message ?? 'Failed to send test email',
        });
      }
    } catch {
      setTestResult({ ok: false, message: 'Network error — could not send test email' });
    } finally {
      setTestSending(false);
    }
  };

  /* Test Zapier MCP connection */
  const handleTestConnection = async () => {
    setTestConnecting(true);
    setTestConnectionResult(null);

    try {
      const res = await fetch('/api/integrations/zapier-mcp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: fieldValues.apiKey ?? '',
          endpointUrl: fieldValues.endpointUrl ?? '',
        }),
      });

      const body = await res.json().catch(() => null);

      if (res.ok && body?.success) {
        setTestConnectionResult({
          ok: true,
          message: `Connection successful! Discovered ${body.tools?.length ?? 0} tools.`,
          tools: body.tools ?? [],
        });
      } else {
        setTestConnectionResult({
          ok: false,
          message: body?.error ?? 'Failed to connect to Zapier MCP',
        });
      }
    } catch {
      setTestConnectionResult({
        ok: false,
        message: 'Network error — could not test connection',
      });
    } finally {
      setTestConnecting(false);
    }
  };

  /* Test DeepSeek connection */
  const handleDeepseekTest = async () => {
    setDeepseekTesting(true);
    setDeepseekTestResult(null);

    // Fetch the decrypted API key from the store
    let apiKey = '';
    try {
      const keyRes = await fetch(`/api/api-keys/${selectedApiKeyId}`);
      if (keyRes.ok) {
        const keyData = await keyRes.json();
        apiKey = keyData.key ?? '';
      }
    } catch {}

    if (!apiKey) {
      setDeepseekTestResult({ ok: false, message: 'Could not retrieve API key from store.' });
      setDeepseekTesting(false);
      return;
    }

    try {
      const res = await fetch('/api/integrations/deepseek/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey,
          model: fieldValues.model ?? 'deepseek-v4-flash',
        }),
      });

      const body = await res.json().catch(() => null);

      if (body?.success) {
        setDeepseekTestResult({ ok: true, message: body.message });
      } else {
        setDeepseekTestResult({
          ok: false,
          message: body?.error ?? 'Failed to connect to DeepSeek API',
        });
      }
    } catch {
      setDeepseekTestResult({
        ok: false,
        message: 'Network error — could not test connection',
      });
    } finally {
      setDeepseekTesting(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */

  // Unknown service
  if (!loading && !serviceDef) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <button
          onClick={() => router.push('/integrations')}
          className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Integrations
        </button>
        <div className="text-center py-12 border border-dashed border-[var(--border)] rounded-sm">
          <Plug size={36} className="mx-auto text-[var(--muted)] mb-3" />
          <p className="text-[var(--muted)] text-sm">
            Unknown service &ldquo;{serviceId}&rdquo;. Please select from the
            integrations list.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Back link */}
      <button
        onClick={() => router.push('/integrations')}
        className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Integrations
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        {serviceDef && (
          <div
            className={`p-2 rounded-sm bg-[var(--background)] ${serviceDef.color}`}
          >
            <ServiceIcon size={22} />
          </div>
        )}
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            {serviceDef?.name ?? 'Service'} Configuration
          </h1>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            {serviceDef?.description}
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-14 rounded-sm bg-[var(--panel)] border border-[var(--border)] animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Error banner */}
      {!loading && error && (
        <div className="flex items-start gap-3 p-4 rounded-sm border border-red-500/30 bg-red-500/10 text-sm text-red-400">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => {
              setError('');
              fetchData();
            }}
            className="hover:text-red-300"
          >
            <Loader2 size={16} />
          </button>
        </div>
      )}

      {/* Form */}
      {!loading && !error && serviceDef && (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Form error */}
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-sm border border-red-500/30 bg-red-500/10 text-sm text-red-400">
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          {/* API Key selector */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
              API Key <span className="text-red-400">*</span>
            </label>
            {apiKeys.length === 0 ? (
              <div className="p-4 rounded-sm border border-dashed border-[var(--border)] bg-[var(--panel)] text-center">
                <Key size={20} className="mx-auto text-[var(--muted)] mb-2" />
                <p className="text-xs text-[var(--muted)] mb-2">
                  No API keys yet. Create one in API Key Store.
                </p>
                <a
                  href="/api-keys"
                  className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                >
                  <Key size={14} />
                  Go to API Key Store
                </a>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={selectedApiKeyId}
                  onChange={(e) => setSelectedApiKeyId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] appearance-none"
                >
                  <option value="" disabled>
                    Select an API key...
                  </option>
                  {apiKeys.map((key) => (
                    <option key={key.id} value={key.id}>
                      {key.name}
                    </option>
                  ))}
                </select>

                {selectedApiKeyId && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)]">
                    <span className="font-mono text-xs text-[var(--muted)] truncate">
                      {revealedKeyId === selectedApiKeyId
                        ? revealedKeyValue
                        : maskApiKey(selectedApiKeyId)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleReveal(selectedApiKeyId)}
                      disabled={fetchingReveal}
                      className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50 shrink-0"
                      title={
                        revealedKeyId === selectedApiKeyId ? 'Hide' : 'Show key'
                      }
                    >
                      {fetchingReveal ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : revealedKeyId === selectedApiKeyId ? (
                        <EyeOff size={14} />
                      ) : (
                        <Eye size={14} />
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Service-specific fields */}
          {serviceDef.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
                {field.label}{' '}
                {field.required ? (
                  <span className="text-red-400">*</span>
                ) : (
                  <span className="text-[var(--muted)] font-normal">
                    (optional)
                  </span>
                )}
              </label>
              {field.type === 'select' ? (
                <select
                  value={fieldValues[field.key] ?? ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                >
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={fieldValues[field.key] ?? ''}
                  onChange={(e) => handleFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
                  required={field.required}
                  className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                />
              )}
            </div>
          ))}

          {/* Label */}
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
              Label <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Production Brevo"
              required
              className="w-full px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between p-4 rounded-sm border border-[var(--border)] bg-[var(--panel)]">
            <div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                Enabled
              </p>
              <p className="text-xs text-[var(--muted)] mt-0.5">
                {enabled
                  ? 'Service will process requests immediately.'
                  : 'Service is paused and will not process requests.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-sm transition-colors ${
                enabled
                  ? 'bg-green-500/80'
                  : 'bg-[var(--border)]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-sm bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || apiKeys.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {saving ? 'Saving…' : integration ? 'Update' : 'Save'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/integrations')}
              disabled={saving}
              className="px-5 py-2.5 rounded-sm border border-[var(--border)] text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>

            {integration && (
              <div className="flex items-center gap-1.5 ml-auto text-xs">
                {integration.enabled ? (
                  <CheckCircle size={14} className="text-green-400" />
                ) : (
                  <AlertCircle size={14} className="text-yellow-400" />
                )}
                <span className="text-[var(--muted)]">
                  {integration.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>
            )}
          </div>
        </form>
      )}

      {/* Test Email section — Brevo only, saved & enabled */}
      {serviceId === 'brevo' && integration && enabled && (
        <div className="border border-[var(--border)] bg-[var(--panel)] rounded-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Mail size={18} className="text-blue-400" />
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Test Email
            </h3>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1.5">
              Recipient Email
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="Enter recipient email"
                className="flex-1 px-3 py-2 rounded-sm border border-[var(--border)] bg-[var(--background)] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
              <button
                type="button"
                onClick={handleSendTest}
                disabled={testSending || !testEmail.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
              >
                {testSending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {testSending ? 'Sending…' : 'Send Test'}
              </button>
            </div>
          </div>

          {/* Result feedback */}
          {testResult && (
            <div
              className={`flex items-start gap-2 p-3 rounded-sm text-sm ${
                testResult.ok
                  ? 'border border-green-500/30 bg-green-500/10 text-green-400'
                  : 'border border-red-500/30 bg-red-500/10 text-red-400'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              ) : (
                <XCircle size={16} className="mt-0.5 shrink-0" />
              )}
              <span className="flex-1">{testResult.message}</span>
              <button
                type="button"
                onClick={() => setTestResult(null)}
                className="hover:opacity-70 shrink-0"
              >
                <XCircle size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Test Connection section — Zapier MCP only, saved & enabled */}
      {serviceId === 'zapier-mcp' && integration && enabled && (
        <div className="border border-[var(--border)] bg-[var(--panel)] rounded-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-orange-400" />
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Test Connection
            </h3>
          </div>

          <p className="text-xs text-[var(--muted)]">
            Test the connection to your Zapier MCP endpoint to verify it is working correctly.
          </p>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testConnecting}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {testConnecting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Zap size={16} />
            )}
            {testConnecting ? 'Testing…' : 'Test Connection'}
          </button>

          {/* Result feedback */}
          {testConnectionResult && (
            <div
              className={`flex items-start gap-2 p-3 rounded-sm text-sm ${
                testConnectionResult.ok
                  ? 'border border-green-500/30 bg-green-500/10 text-green-400'
                  : 'border border-red-500/30 bg-red-500/10 text-red-400'
              }`}
            >
              {testConnectionResult.ok ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              ) : (
                <XCircle size={16} className="mt-0.5 shrink-0" />
              )}
              <div className="flex-1 space-y-1">
                <span>{testConnectionResult.message}</span>
                {testConnectionResult.ok && testConnectionResult.tools && testConnectionResult.tools.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-medium text-[var(--muted)] mb-1">Discovered tools:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {testConnectionResult.tools.map((tool) => (
                        <span
                          key={tool}
                          className="inline-block px-2 py-0.5 rounded-sm bg-[var(--background)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)]"
                        >
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setTestConnectionResult(null)}
                className="hover:opacity-70 shrink-0"
              >
                <XCircle size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Test Connection section — DeepSeek only, saved & enabled */}
      {serviceId === 'deepseek' && integration && enabled && (
        <div className="border border-[var(--border)] bg-[var(--panel)] rounded-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Brain size={18} className="text-purple-400" />
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Test Connection
            </h3>
          </div>

          <p className="text-xs text-[var(--muted)]">
            Send a test request to the DeepSeek API to verify your API key and model are working.
          </p>

          <button
            type="button"
            onClick={handleDeepseekTest}
            disabled={deepseekTesting}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-sm bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {deepseekTesting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Brain size={16} />
            )}
            {deepseekTesting ? 'Testing…' : 'Test Connection'}
          </button>

          {deepseekTestResult && (
            <div
              className={`flex items-start gap-2 p-3 rounded-sm text-sm ${
                deepseekTestResult.ok
                  ? 'border border-green-500/30 bg-green-500/10 text-green-400'
                  : 'border border-red-500/30 bg-red-500/10 text-red-400'
              }`}
            >
              {deepseekTestResult.ok ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              ) : (
                <XCircle size={16} className="mt-0.5 shrink-0" />
              )}
              <span>{deepseekTestResult.message}</span>
              <button
                type="button"
                onClick={() => setDeepseekTestResult(null)}
                className="hover:opacity-70 shrink-0 ml-auto"
              >
                <XCircle size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
