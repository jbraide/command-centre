import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { DEEPSEEK_BASE_URL, getDeepSeekConfig } from '@/lib/ai';
import { toolRegistry, type ToolDefinition } from '@/lib/ai/tool-registry';
import { executeToolCall } from '@/lib/ai/tool-router';
import { registerUserMcpTools } from '@/lib/ai/zapier-mcp';
import { getMessages, saveMessage } from '@/lib/ai/db';
import {
  executePlan,
  extractSummary,
  type ExecutionPlan,
  type PlanStep,
  type StepStatus,
  type PlanCallbacks,
} from '@/lib/ai/agent';
import { z } from 'zod';

// ─── Request validation ───────────────────────────────────────────────────────

const chatRequestSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
});

// ─── System prompt ────────────────────────────────────────────────────────────

function buildAgentSystemPrompt(tools: ToolDefinition[]): string {
  const toolDescriptions = tools
    .map(
      (t) =>
        `  - **\`${t.name}\`**: ${t.description}` +
        (t.category === 'external' ? ' *(external service)*' : ''),
    )
    .join('\n');

  return [
    'You are the **Command Center AI agent** — a smart assistant for a unified business operations, content creation, password management, and AI script generation dashboard.',
    '',
    '## Available Tools',
    'You have access to the following tools. You MUST use them to answer questions — never just describe what you would do.',
    '',
    toolDescriptions,
    '',
    '## CRITICAL: Tool Calling Rules',
    '1. **You MUST call tools immediately.** Do not say "I will fetch X" — just call the tool. The system will execute it and return the result.',
    '2. **Multiple steps.** If a request needs several tools, call them one at a time. Each call returns data you can use in the next call.',
    '3. **Script generation.** When asked to write a script, first call `get_personas` and `get_styles` to find available IDs, then call `generate_script` with those IDs.',
    '4. **Be concise.** Summarise results naturally. Never output raw JSON.',
    '5. **Password Vault.** You cannot read decrypted passwords. Direct users to the Password Vault module.',
    '6. **Saved Knowledge.** Use the "## Saved Knowledge" section below when generating scripts or answering questions.',
    '7. **External tools** (marked *(external service)*) perform REAL actions in connected apps (Calendar, Gmail, Google Docs, Slack, etc.). Only call an external tool when the user explicitly asks for that action. For read-only questions, prefer internal tools.',
  ].join('\n');
}

// ─── SSE helpers ──────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function sseEvent(data: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

// ─── Parse XML tool calls from DeepSeek text responses ─────────────────────
// DeepSeek with thinking mode sometimes outputs tool calls as XML blocks in
// the text content instead of using proper OpenAI function calling format.
// This parser extracts them and converts to the standard format.

function parseXmlInvokes(text: string): Array<{
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}> {
  const results: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }> = [];

  // Match <invoke name="tool_name">...</invoke> blocks
  const invokeRegex = /<invoke\s+name="([^"]+)"\s*>([\s\S]*?)<\/invoke>/gi;
  let match: RegExpExecArray | null;

  while ((match = invokeRegex.exec(text)) !== null) {
    const toolName = match[1];
    const innerXml = match[2];
    const args: Record<string, string> = {};

    // Parse <parameter name="x">value</parameter>
    const paramRegex = /<parameter\s+name="([^"]+)"(?:\s+string="(true|false)")?\s*>([\s\S]*?)<\/parameter>/gi;
    let pMatch: RegExpExecArray | null;

    while ((pMatch = paramRegex.exec(innerXml)) !== null) {
      args[pMatch[1]] = pMatch[3].trim();
    }

    results.push({
      id: `xml_${toolName}_${results.length}`,
      type: 'function',
      function: {
        name: toolName,
        arguments: JSON.stringify(args),
      },
    });
  }

  return results;
}

// ─── Create ExecutionPlan from tool calls ─────────────────────────────────────

function createPlanFromToolCalls(
  toolCalls: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>,
): ExecutionPlan {
  const steps: PlanStep[] = toolCalls.map((tc) => {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function.arguments);
    } catch { /* use empty args */ }
    return {
      id: tc.id,
      description: tc.function.name.replace(/_/g, ' '),
      toolName: tc.function.name,
      toolArgs: args,
      status: 'pending' as StepStatus,
      attempt: 0,
    };
  });
  const summary =
    steps.length === 1
      ? `1 step: ${steps[0].description}`
      : `${steps.length} steps: ${steps.map((s) => s.description).join(', ')}`;
  return { steps, summary };
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authSession = await auth();
  if (!authSession?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = authSession.user.id;

  // Parse request body
  let body: { sessionId: string; message: string };
  try {
    const raw = await req.json();
    body = chatRequestSchema.parse(raw);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request. sessionId and message are required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { sessionId, message } = body;

  // Verify the session belongs to this user
  const sessionRecord = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { userId: true },
  });

  if (!sessionRecord) {
    return new Response(JSON.stringify({ error: 'Session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (sessionRecord.userId !== userId) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Save user message
  await saveMessage(sessionId, 'user', message);

  // Get DeepSeek config
  const config = await getDeepSeekConfig(userId);
  if (!config) {
    return new Response(
      JSON.stringify({ error: 'DeepSeek API key not configured. Configure it in Integrations or set DEEPSEEK_API_KEY in your .env file.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const model = config.model;

  // Build conversation — include internal tools plus any configured Zapier MCP tools
  let availableTools = toolRegistry.getAll();
  try {
    const mcpCount = await registerUserMcpTools(userId);
    if (mcpCount > 0) {
      availableTools = toolRegistry.getAll();
    }
  } catch (error) {
    console.error('[Chat] Failed to register MCP tools:', error);
  }
  let systemPrompt = buildAgentSystemPrompt(availableTools);

  // Inject memories
  const memories = await prisma.memory.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });

  if (memories.length > 0) {
    const memoryLines = memories
      .map((m) => `  - **${m.key}**${m.category ? ` [${m.category}]` : ''}: ${m.value}`)
      .join('\n');
    systemPrompt += `\n\n## Saved Knowledge\nThe user has taught you the following facts across conversations. Refer to them when relevant:\n${memoryLines}`;
  }

  // Load conversation history
  const dbMessages = await getMessages(sessionId);
  const recentMessages = dbMessages.slice(-30);
  const conversationMessages: Array<Record<string, unknown>> = [
    { role: 'system', content: systemPrompt },
    ...recentMessages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.toolCalls ? { tool_calls: JSON.parse(m.toolCalls) } : {}),
    })),
    { role: 'user', content: message },
  ];

  // ── SSE Stream ─────────────────────────────────────────────────────────

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(sseEvent(data));

      try {
        const maxRounds = 10;
        let finalContent: string | null = null;

        for (let round = 0; round < maxRounds; round++) {
          if (req.signal.aborted) break;

          // Call DeepSeek with tools via direct fetch
          const apiUrl = 'https://api.deepseek.com/v1/chat/completions';

          const toolsPayload = availableTools.map((t) => ({
            type: 'function',
            function: {
              name: t.name,
              description: t.description,
              parameters: t.inputSchema,
            },
          }));

          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: conversationMessages,
              tools: toolsPayload,
              tool_choice: 'auto',
              temperature: 0.3,
              max_tokens: 8192,
              thinking: { type: 'enabled', reasoning_effort: 'max' },
              stream: false,
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`DeepSeek API error (${res.status}): ${errText.slice(0, 200)}`);
          }

          const data = await res.json();
          const choice = data.choices?.[0];
          const msg = choice?.message;

          if (!msg) throw new Error('Empty response from DeepSeek');

          const toolCalls = msg.tool_calls?.filter(
            (tc: any) => tc.type === 'function' && tc.function?.name,
          ) ?? [];

          // DeepSeek sometimes outputs <invoke> XML in text content instead of proper function calls.
          // Fallback: parse XML tool calls from the text content.
          const textToolCalls = toolCalls.length === 0 && msg.content
            ? parseXmlInvokes(msg.content)
            : [];

          const activeToolCalls = toolCalls.length > 0 ? toolCalls : textToolCalls;

          if (activeToolCalls.length > 0) {
            // Build plan
            const plan = createPlanFromToolCalls(activeToolCalls);
            send({ type: 'plan', steps: plan.steps, summary: plan.summary });

            // Save assistant message (use reasoning_content as fallback for thinking mode)
            const assistantContent = msg.content || msg.reasoning_content || '';
            await saveMessage(sessionId, 'assistant', assistantContent, JSON.stringify(activeToolCalls));

            // Add to conversation — include reasoning_content if present for DeepSeek thinking mode
            const assistantMsg: Record<string, unknown> = { role: 'assistant', content: assistantContent, tool_calls: activeToolCalls };
            if (msg.reasoning_content) {
              assistantMsg.reasoning_content = msg.reasoning_content;
            }
            conversationMessages.push(assistantMsg);

            // Execute tools
            const results = await executePlan(plan, userId, {
              onStepStart: (step) => {
                send({ type: 'step_start', step: { id: step.id, description: step.description, toolName: step.toolName, status: step.status, attempt: step.attempt } });
                send({ type: 'tool_call_start', toolCall: { name: step.toolName, status: 'pending' } });
              },
              onStepComplete: (step) => {
                send({ type: 'step_complete', step: { id: step.id, description: step.description, toolName: step.toolName, status: step.status, result: step.result, attempt: step.attempt } });
                const s = extractSummary(step.result, step.toolName);
                send({ type: 'tool_call_complete', toolCall: { name: step.toolName, status: 'completed', result: s || step.result } });
              },
              onStepRetry: (step, _attempt, error) => {
                send({ type: 'step_retry', step: { id: step.id, description: step.description, toolName: step.toolName, status: step.status }, error });
              },
              onStepError: (step, error) => {
                send({ type: 'step_error', step: { id: step.id, description: step.description, toolName: step.toolName, status: 'failed', attempt: step.attempt, error } });
                send({ type: 'tool_call_error', toolCall: { name: step.toolName, status: 'error' } });
              },
              onComplete: () => {},
            }, req.signal);

            // Save tool results and add to conversation
            for (const step of plan.steps) {
              const stepResult = results.find((r) => r.id === step.id);
              const content = JSON.stringify(
                stepResult?.status === 'completed'
                  ? { success: true, data: stepResult.result }
                  : { success: false, error: stepResult?.error },
              );
              await saveMessage(sessionId, 'tool', content, JSON.stringify({ tool_call_id: step.id }));
              conversationMessages.push({ role: 'tool', tool_call_id: step.id, content });
            }
          } else {
            // No tool calls — this is the final text response
            finalContent = (msg.content || msg.reasoning_content || '') as string;
            await saveMessage(sessionId, 'assistant', finalContent);
            break;
          }
        }

        // ── Stream final text response ──
        if (finalContent !== null) {
          const streamUrl = 'https://api.deepseek.com/v1/chat/completions';

          const streamRes = await fetch(streamUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${config.apiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: conversationMessages,
              temperature: 0.1,
              max_tokens: 8192,
              thinking: { type: 'enabled', reasoning_effort: 'max' },
              stream: true,
            }),
          });

          if (streamRes.ok && streamRes.body) {
            const reader = streamRes.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let streamedContent = '';

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split('\n');
              buffer = lines.pop() || '';
              for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const d = line.slice(6).trim();
                if (d === '[DONE]') break;
                try {
                  const parsed = JSON.parse(d);
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (delta) {
                    streamedContent += delta;
                    send({ type: 'text', content: delta });
                  }
                } catch { /* skip */ }
              }
            }

            if (streamedContent) {
              await prisma.chatMessage.updateMany({
                where: { sessionId, role: 'assistant', content: finalContent },
                data: { content: streamedContent },
              });
            }
          }
        } else {
          send({ type: 'text', content: 'I could not complete all the required steps. Please try rephrasing your request.' });
        }

        send({ type: 'done' });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'An error occurred';
        console.error('[Chat]', msg);
        send({ type: 'error', content: msg });
        send({ type: 'done' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
