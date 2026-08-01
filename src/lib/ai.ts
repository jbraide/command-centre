/**
 * DeepSeek V4 API configuration.
 * OpenAI-compatible API format — use the OpenAI SDK with custom baseURL.
 *
 * The API key and model are configured via the DeepSeek service integration
 * in the Integrations module (stored in the ServiceIntegration table).
 * Falls back to DEEPSEEK_API_KEY / DEEPSEEK_MODEL env vars if not configured.
 */

import type OpenAI from 'openai';
import { prisma } from '@/lib/db';

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

let _client: OpenAI | null = null;
let _currentKey: string | null = null;

/**
 * Fetch the DeepSeek config for a user from the integration settings.
 * Returns { apiKey, model } or null if not configured.
 */
export async function getDeepSeekConfig(userId: string): Promise<{ apiKey: string; model: string } | null> {
  try {
    const integration = await prisma.serviceIntegration.findUnique({
      where: { userId_service: { userId, service: 'deepseek' } },
    });

    if (integration?.enabled && integration.config) {
      const config = JSON.parse(integration.config);
      const model = config.model || 'deepseek-v4-flash';

      // If the config has an apiKeyId, fetch the decrypted key from the API Key Store
      if (config.apiKeyId) {
        const apiKeyRecord = await prisma.apiKey.findUnique({
          where: { id: config.apiKeyId },
        });
        if (apiKeyRecord && apiKeyRecord.serverEncryptedKey && apiKeyRecord.serverIv) {
          // The API key is server-side encrypted, decrypt it
          const { decryptApiKey } = await import('@/lib/api-key-crypto');
          const apiKey = decryptApiKey(apiKeyRecord.serverEncryptedKey, apiKeyRecord.serverIv);
          return { apiKey, model };
        }
        // If no server-encrypted key, the API key was created without keyForServer
        // Fall through to env fallback
      }
    }
  } catch {
    // Fall through to env fallback
  }

  // Fallback to environment variables
  if (process.env.DEEPSEEK_API_KEY) {
    return {
      apiKey: process.env.DEEPSEEK_API_KEY,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    };
  }

  return null;
}

export async function getClient(userId: string): Promise<{ client: OpenAI; model: string }> {
  const config = await getDeepSeekConfig(userId);

  if (!config) {
    throw new Error('DeepSeek API key not configured. Configure it in Integrations or set DEEPSEEK_API_KEY in your .env file.');
  }

  // Reuse client if the key hasn't changed
  if (!_client || _currentKey !== config.apiKey) {
    const { default: OpenAIClient } = await import('openai');
    _client = new OpenAIClient({
      baseURL: DEEPSEEK_BASE_URL,
      apiKey: config.apiKey,
    });
    _currentKey = config.apiKey;
  }

  return { client: _client, model: config.model };
}

export async function generateCompletion({
  userId,
  systemPrompt,
  userPrompt,
  temperature = 0.7,
  maxTokens = 2048,
  thinking = false,
}: {
  userId: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  thinking?: boolean;
}): Promise<string> {
  const { client, model } = await getClient(userId);

  const messages: { role: 'system' | 'user'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const completion = await client.chat.completions.create({
    model: thinking ? 'deepseek-v4-pro' : model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(thinking ? { thinking: { type: 'enabled' as const }, reasoning_effort: 'high' as const } : {}),
  });

  return completion.choices[0]?.message?.content || '';
}

/**
 * Script Writer prompt builder — assembles the persona context, examples,
 * key principles, and style guidelines into a system prompt for AI generation.
 */
export function buildScriptPrompt({
  topic,
  personaLessons,
  personaExamples,
  scriptStyle,
  constraints,
}: {
  topic: string;
  personaLessons?: string;
  personaExamples?: string;
  scriptStyle?: string;
  constraints?: string;
}): string {
  const parts: string[] = [];

  parts.push('You are a professional script writer helping create a short-form video script.');

  if (personaLessons) {
    parts.push(`
## Voice Lessons (follow these as hard rules)
${personaLessons}`);
  }

  if (personaExamples) {
    parts.push(`
## Style References (study the rhythm and structure, do NOT copy phrases)
${personaExamples}`);
    parts.push(`
IMPORTANT: Use the examples above for style inspiration only. Do not copy any specific phrases, jokes, or claims from them. The topic below is new content — every detail must be about the current topic.`);
  }

  if (scriptStyle) {
    parts.push(`
## Script Structure / Template
${scriptStyle}`);
  }

  if (constraints) {
    parts.push(`
## Constraints
${constraints}`);
  }

  parts.push(`
## Output rules
- One clear hook in the first line
- Write conversationally, as if speaking directly to camera
- Respect any voice lessons as hard constraints
- If no persona is specified, write in a clear, engaging, natural voice
- Output only the script text, no commentary`);

  return parts.join('\n\n');
}

/**
 * Structured Script Writer prompt builder — same persona context, examples,
 * style, and constraints as the table prompt, but instructs the model to
 * output a structured (non-table) markdown document with three sections:
 * Script, Creative Direction, and Production Notes.
 */
export function buildStructuredScriptPrompt({
  topic,
  personaLessons,
  personaExamples,
  scriptStyle,
  constraints,
}: {
  topic: string;
  personaLessons?: string;
  personaExamples?: string;
  scriptStyle?: string;
  constraints?: string;
}): string {
  const parts: string[] = [];

  parts.push('You are a professional script writer helping create a short-form video script.');

  if (personaLessons) {
    parts.push(`
## Voice Lessons (follow these as hard rules)
${personaLessons}`);
  }

  if (personaExamples) {
    parts.push(`
## Style References (study the rhythm and structure, do NOT copy phrases)
${personaExamples}`);
    parts.push(`
IMPORTANT: Use the examples above for style inspiration only. Do not copy any specific phrases, jokes, or claims from them. The topic below is new content — every detail must be about the current topic.`);
  }

  if (scriptStyle) {
    parts.push(`
## Script Structure / Template
${scriptStyle}`);
  }

  if (constraints) {
    parts.push(`
## Constraints
${constraints}`);
  }

  parts.push(`
## Output rules
- One clear hook in the first line
- Write conversationally, as if speaking directly to camera
- Respect any voice lessons as hard constraints
- If no persona is specified, write in a clear, engaging, natural voice
- Output ONLY the markdown structure below, with EXACTLY these ## section headers:

## Script
<the actual spoken script, broken into scene beats. No tables. Use short lines like a screenplay.>

## Creative Direction
<visual direction per scene: camera angle, shot type, on-screen action, props, B-roll, location. Bullet points.>

## Production Notes
<timing (e.g. total 30s), pacing, audio/music/SFX cues, on-screen text/Captions, CTA/end card, hashtags if relevant>

Format rules:
- The Script section must be the raw voiceover text a creator would read — no tables, no cells.
- Creative Direction explains what's on screen for each beat.
- Production Notes covers timing, audio, captions, CTA.
- Output only the three sections above, no commentary outside them.`);

  return parts.join('\n\n');
}
