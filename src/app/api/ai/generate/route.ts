import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateCompletion, buildScriptPrompt, buildStructuredScriptPrompt } from '@/lib/ai';

/**
 * Extract the text under a `## <header>` markdown section, up to (but not
 * including) the next `## <nextHeader>` section. Returns null if the section
 * is not found.
 */
function extractSection(content: string, header: string, nextHeader?: string): string | null {
  const pattern = nextHeader
    ? new RegExp(`## ${header}\\s*\n([\\s\\S]*?)\n\\s*## ${nextHeader}`)
    : new RegExp(`## ${header}\\s*\n([\\s\\S]*)$`);
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const {
      topic,
      personaId,
      ideaId,
      scriptStyle,
      constraints,
      thinking,
      title,
      format = 'table',
    } = await req.json();

    // ── Determine the topic ─────────────────────────────
    let resolvedTopic = topic;
    let resolvedIdea = null;

    // If ideaId is provided and no explicit topic override, fetch the idea
    if (ideaId && !topic) {
      resolvedIdea = await prisma.idea.findUnique({
        where: { id: ideaId, userId: session.user.id },
      });

      if (!resolvedIdea) {
        return NextResponse.json(
          { error: 'Idea not found' },
          { status: 404 }
        );
      }

      resolvedTopic = resolvedIdea.title;
      if (resolvedIdea.rawNotes) {
        resolvedTopic += '\n\n' + resolvedIdea.rawNotes;
      }
    }

    if (!resolvedTopic || typeof resolvedTopic !== 'string') {
      return NextResponse.json(
        { error: 'Topic is required. Provide a topic or select an idea.' },
        { status: 400 }
      );
    }

    // ── Fetch persona data if provided ──────────────────
    let personaLessons: string | undefined;
    let personaExamples: string | undefined;
    let resolvedPersona = null;

    if (personaId) {
      resolvedPersona = await prisma.creatorPersona.findUnique({
        where: { id: personaId, userId: session.user.id },
        include: {
          examples: true,
          lessons: true,
        },
      });

      if (!resolvedPersona) {
        return NextResponse.json(
          { error: 'Creator persona not found' },
          { status: 404 }
        );
      }

      if (resolvedPersona.lessons.length > 0) {
        personaLessons = resolvedPersona.lessons
          .map((l) => `[${l.title}] ${l.content}`)
          .join('\n');
      }

      if (resolvedPersona.examples.length > 0) {
        personaExamples = resolvedPersona.examples
          .map((e) => {
            let block = e.content;
            if (e.note) block += `\n/* ${e.note} */`;
            return block;
          })
          .join('\n\n---\n\n');
      }
    }

    // ── Fetch script style if provided ──────────────────
    let styleGuidelines: string | undefined;
    if (scriptStyle) {
      const styleRecord = await prisma.scriptStyle.findUnique({
        where: { id: scriptStyle },
      });
      if (styleRecord?.guidelines) {
        styleGuidelines = styleRecord.guidelines;
      }
    }

    // ── Build prompt and generate ────────────────────────
    const systemPrompt =
      format === 'structured'
        ? buildStructuredScriptPrompt({
            topic: resolvedTopic,
            personaLessons,
            personaExamples,
            scriptStyle: styleGuidelines,
            constraints,
          })
        : buildScriptPrompt({
            topic: resolvedTopic,
            personaLessons,
            personaExamples,
            scriptStyle: styleGuidelines,
            constraints,
          });

    const content = await generateCompletion({
      userId,
      systemPrompt,
      userPrompt: `Topic: ${resolvedTopic}\n\nWrite the script.`,
      temperature: 0.7,
      maxTokens: 2048,
      thinking: thinking ?? false,
    });

    // ── Create the script in DB ─────────────────────────
    const scriptTitle = title
      ? title.trim()
      : resolvedIdea
        ? `Script: ${resolvedIdea.title}`
        : `Generated Script ${new Date().toLocaleDateString()}`;

    const isStructured = format === 'structured';

    // Parse structured sections so they can be stored separately
    const scriptText = isStructured
      ? extractSection(content, 'Script', 'Creative Direction')
      : null;
    const creativeDirection = isStructured
      ? extractSection(content, 'Creative Direction', 'Production Notes')
      : null;
    const productionNotes = isStructured
      ? extractSection(content, 'Production Notes')
      : null;

    const script = await prisma.script.create({
      data: {
        userId: session.user.id,
        title: scriptTitle,
        content,
        format: isStructured ? 'structured' : 'table',
        scriptText,
        creativeDirection,
        productionNotes,
        styleId: scriptStyle || null,
        personaId: personaId || null,
        ideaId: ideaId || null,
      },
      include: {
        style: { select: { name: true } },
        project: { select: { id: true, name: true } },
        persona: { select: { id: true, name: true, colorTag: true } },
        idea: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({ content, script });
  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate script. Check your API key and try again.' },
      { status: 500 }
    );
  }
}
