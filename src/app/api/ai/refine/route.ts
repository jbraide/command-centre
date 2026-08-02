import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateCompletion } from '@/lib/ai';

/**
 * POST /api/ai/refine
 * Refine an existing script using the FULL context: creator persona
 * (lessons + examples), script style guidelines, and business memories.
 *
 * Body:
 *   scriptId: string
 *   instructions?: string   — optional refinement focus (e.g. "make the hook stronger")
 *
 * Returns:
 *   { content, script }     — refined content + updated script record
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { scriptId, instructions } = await req.json();

    if (!scriptId) {
      return NextResponse.json({ error: 'scriptId is required' }, { status: 400 });
    }

    // ── Load the script (must belong to user) ──────────────────────
    const script = await prisma.script.findFirst({
      where: { id: scriptId, userId: session.user.id },
      include: {
        persona: { include: { lessons: true, examples: true } },
        style: true,
      },
    });

    if (!script) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }

    // ── Assemble context ───────────────────────────────────────────
    const contextParts: string[] = [];

    // Persona voice
    if (script.persona) {
      const lessons = script.persona.lessons
        .map((l) => `[${l.title}] ${l.content}`)
        .join('\n');
      const examples = script.persona.examples
        .map((e) => e.content)
        .join('\n\n---\n\n');
      if (lessons) {
        contextParts.push(`## Creator Voice — Lessons (follow these as hard rules)\n${lessons}`);
      }
      if (examples) {
        contextParts.push(`## Style References (study the rhythm, DO NOT copy phrases)\n${examples}`);
      }
    }

    // Script style guidelines
    if (script.style?.guidelines) {
      contextParts.push(`## Script Style / Brand Guidelines\n${script.style.guidelines}`);
    }

    // Business memories (LuxeRide context, etc.)
    const memories = await prisma.memory.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
    });
    if (memories.length > 0) {
      const memoryLines = memories
        .map((m) => `- **${m.key}**: ${m.value}`)
        .join('\n');
      contextParts.push(`## Saved Business Context\n${memoryLines}`);
    }

    const contextBlock = contextParts.join('\n\n');

    // ── Build refine prompt ────────────────────────────────────────
    const focus = instructions?.trim()
      ? instructions.trim()
      : 'improve overall quality: strengthen the hook, tighten the copy, fix any claims that contradict the brand facts, and keep it authentic to the brand voice';

    const systemPrompt = [
      'You are a professional short-form video script editor for a Nigerian e-commerce brand.',
      'You refine scripts to be MORE consistent, more authentic, and free of invented product claims.',
      '',
      contextBlock,
      '',
      '## Refinement Rules',
      '1. Keep the script structure and format (same table format or sections).',
      '2. Only use product facts from the context. If a claim in the script is NOT supported by the context (e.g. "machine-washable" for a non-washable product), REMOVE or FIX it.',
      '3. Strengthen the hook and the call-to-action. Tighten wordy lines.',
      '4. Match the brand voice: conversational, authentic, practical Nigerian English.',
      '5. Never invent prices or features. Keep on-screen text for every key claim.',
      '6. Keep it under 30 seconds / 150 words of voiceover.',
      '7. Output ONLY the refined script (same format), no commentary.',
    ].join('\n');

    const userPrompt = [
      `Original script:\n${script.content}`,
      '',
      `Refinement focus: ${focus}`,
      '',
      'Return the refined script now.',
    ].join('\n');

    // ── Generate refined content ───────────────────────────────────
    const content = await generateCompletion({
      userId: session.user.id,
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      maxTokens: 8192,
    });

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'AI returned empty content. Try again.' }, { status: 502 });
    }

    // ── Update the script record ──────────────────────────────────
    const updated = await prisma.script.update({
      where: { id: script.id },
      data: { content },
      include: {
        style: { select: { name: true } },
        persona: { select: { id: true, name: true, colorTag: true } },
      },
    });

    return NextResponse.json({ content, script: updated });
  } catch (error) {
    console.error('Refine script error:', error);
    return NextResponse.json(
      { error: 'Failed to refine script. Check your API key and try again.' },
      { status: 500 }
    );
  }
}
