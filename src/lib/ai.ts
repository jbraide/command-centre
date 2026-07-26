/**
 * DeepSeek V4 API configuration.
 * OpenAI-compatible API format — use the OpenAI SDK with custom baseURL.
 *
 * Models:
 *   deepseek-v4-flash — fast, general chat (replaces deepseek-chat)
 *   deepseek-v4-pro   — thinking/reasoning mode (replaces deepseek-reasoner)
 *
 * Environment:
 *   DEEPSEEK_API_KEY  — your DeepSeek API key (set in .env)
 *   DEEPSEEK_MODEL    — model name (default: deepseek-v4-flash)
 */

import type OpenAI from 'openai';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

let _client: OpenAI | null = null;

async function getClient(): Promise<OpenAI> {
  if (!_client) {
    const { default: OpenAIClient } = await import('openai');
    _client = new OpenAIClient({
      baseURL: DEEPSEEK_BASE_URL,
      apiKey: process.env.DEEPSEEK_API_KEY || '',
    });
  }
  return _client;
}

export async function generateCompletion({
  systemPrompt,
  userPrompt,
  temperature = 0.7,
  maxTokens = 2048,
  thinking = false,
}: {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  thinking?: boolean;
}): Promise<string> {
  const client = await getClient();

  const messages: { role: 'system' | 'user'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const completion = await client.chat.completions.create({
    model: thinking ? 'deepseek-v4-pro' : DEEPSEEK_MODEL,
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

export { DEEPSEEK_MODEL };
