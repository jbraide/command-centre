import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { toolRegistry, type ToolDefinition } from '@/lib/ai/tool-registry';

/** Prefix applied to external Zapier tool names to avoid collisions. */
export const ZAPIER_TOOL_PREFIX = 'zapier_';

/**
 * Zapier MCP client wrapper built on the official Model Context Protocol SDK.
 *
 * Zapier exposes MCP servers (AI Skills) at endpoints like:
 *   https://actions.zapier.com/mcp/<skill-id>/sse            (SSE transport)
 *   https://actions.zapier.com/mcp/<skill-id>/streamable-http (HTTP transport)
 *
 * Auth is an API key sent as `Authorization: Bearer <key>` (plus `x-api-key`
 * for Zapier compatibility).
 */

const CONNECTION_TIMEOUT_MS = 20_000;
const TOOL_CALL_TIMEOUT_MS = 60_000;

export interface ZapierMcpConfig {
  endpointUrl: string;
  apiKey: string;
}

export interface DiscoveredTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  rawSchema?: unknown;
}

export interface ZapierMcpResult {
  success: boolean;
  tools?: DiscoveredTool[];
  count?: number;
  content?: string;
  error?: string;
}

/** Wrap fetch to inject auth headers (used by the SSE EventSource). */
function withHeadersFetch(headers: Record<string, string>) {
  return (url: string | URL, init?: { headers?: HeadersInit }) => {
    const merged = new Headers(init?.headers);
    for (const [k, v] of Object.entries(headers)) merged.set(k, v);
    return fetch(url, { ...init, headers: merged });
  };
}

function buildHeaders(apiKey: string): Record<string, string> {
  if (!apiKey) return {};
  return {
    Authorization: `Bearer ${apiKey}`,
    'x-api-key': apiKey,
  };
}

/** Pick a transport based on the endpoint URL shape. */
async function connectClient(config: ZapierMcpConfig): Promise<Client> {
  const url = config.endpointUrl.trim();
  const headers = buildHeaders(config.apiKey);

  const client = new Client({ name: 'command-center', version: '1.0.0' });

  const isHttp =
    /streamable[-_]?http/i.test(url) || !/\/sse(\?|$)/i.test(url);

  if (isHttp) {
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers },
    });
    await client.connect(transport, { timeout: CONNECTION_TIMEOUT_MS });
  } else {
    const transport = new SSEClientTransport(new URL(url), {
      requestInit: { headers },
      eventSourceInit: { fetch: withHeadersFetch(headers) },
    });
    await client.connect(transport, { timeout: CONNECTION_TIMEOUT_MS });
  }

  return client;
}

function mcpContentToString(content: unknown): string {
  if (!Array.isArray(content)) return String(content ?? '');
  return content
    .map((part) => {
      const p = part as { type?: string; text?: string; data?: string };
      if (p.type === 'text') return p.text ?? '';
      if (p.type === 'resource' || p.type === 'resource_link') {
        return JSON.stringify(p);
      }
      return p.text ?? JSON.stringify(p);
    })
    .join('\n');
}

/**
 * Connect to a Zapier MCP endpoint and list the available tools.
 */
export async function testZapierConnection(
  config: ZapierMcpConfig,
): Promise<ZapierMcpResult> {
  let client: Client | null = null;
  try {
    client = await connectClient(config);
    const result = await client.listTools({}, { timeout: CONNECTION_TIMEOUT_MS });
    const tools: DiscoveredTool[] = (result.tools ?? []).map((t) => ({
      name: t.name,
      description: t.description ?? '',
      inputSchema: (t.inputSchema ?? { type: 'object', properties: {} }) as Record<string, unknown>,
      rawSchema: t.inputSchema,
    }));
    return { success: true, tools, count: tools.length };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
  }
}

/**
 * Call a tool on a Zapier MCP server. Opens a fresh connection per call so
 * multiple users / requests never share state.
 */
export async function callZapierTool(
  config: ZapierMcpConfig,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ZapierMcpResult> {
  let client: Client | null = null;
  try {
    client = await connectClient(config);
    const result = await client.callTool(
      { name: toolName, arguments: args },
      undefined,
      { timeout: TOOL_CALL_TIMEOUT_MS },
    );
    const content = mcpContentToString(result.content);
    if (result.isError) {
      return { success: false, error: content || `Tool "${toolName}" returned an error` };
    }
    return { success: true, content };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
  }
}

/**
 * Discover a user's configured Zapier MCP tools and register them with the
 * global tool registry as external tools (prefixed `zapier_`). Handlers load
 * the user's own config per call, so the same registered name is safe to share
 * across users. Returns the number of tools registered.
 */
export async function registerUserMcpTools(userId: string): Promise<number> {
  try {
    const config = await getZapierMcpConfig(userId);
    if (!config) return 0;

    const result = await testZapierConnection(config);
    if (!result.success || !result.tools) return 0;

    let registered = 0;
    for (const tool of result.tools) {
      const name = `${ZAPIER_TOOL_PREFIX}${tool.name}`;
      if (toolRegistry.get(name)) {
        registered += 1;
        continue;
      }

      const definition: ToolDefinition = {
        name,
        description: `${tool.description || `Call Zapier tool ${tool.name}`} (Zapier external action — performs a real action in a connected app such as Calendar, Gmail, Docs, or Slack; only call when the user explicitly asks for this action).`,
        category: 'external',
        inputSchema: {
          type: 'object',
          properties: (tool.inputSchema?.properties ?? {}) as Record<string, unknown>,
          ...(Array.isArray(tool.inputSchema?.required)
            ? { required: tool.inputSchema.required }
            : {}),
        },
        zodSchema: z.record(z.unknown()),
        handler: async (args: Record<string, unknown>, userId: string) => {
          const userConfig = await getZapierMcpConfig(userId);
          if (!userConfig) {
            return { success: false, error: 'Zapier MCP is not configured for this account.' };
          }
          return callZapierTool(userConfig, tool.name, args ?? {});
        },
      };

      toolRegistry.register(definition);
      registered += 1;
    }

    return registered;
  } catch (error) {
    console.error('[ZapierMCP] Tool registration failed:', error);
    return 0;
  }
}

/**
 * Load a user's Zapier MCP integration config (endpoint + decrypted key).
 * Returns null if not configured / disabled.
 */
export async function getZapierMcpConfig(userId: string): Promise<ZapierMcpConfig | null> {
  try {
    const integration = await prisma.serviceIntegration.findUnique({
      where: { userId_service: { userId, service: 'zapier-mcp' } },
    });

    if (!integration?.enabled || !integration.config) return null;

    const config = JSON.parse(integration.config);
    const endpointUrl = config.endpointUrl as string | undefined;
    if (!endpointUrl) return null;

    let apiKey = config.apiKey as string | undefined;

    // Prefer a key from the API Key Store (server-decrypted), fall back to any
    // raw key stored directly in the config.
    if (!apiKey && config.apiKeyId) {
      const keyRecord = await prisma.apiKey.findUnique({
        where: { id: config.apiKeyId as string },
      });
      if (keyRecord?.serverEncryptedKey && keyRecord.serverIv) {
        const { decryptApiKey } = await import('@/lib/api-key-crypto');
        apiKey = decryptApiKey(keyRecord.serverEncryptedKey, keyRecord.serverIv);
      }
    }

    if (!apiKey) return null;
    return { endpointUrl, apiKey };
  } catch (error) {
    console.error('[ZapierMCP] Failed to load config:', error);
    return null;
  }
}
