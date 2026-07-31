import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateCompletion } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;

  try {
    const { text, title, personaId, url } = await req.json();

    if (!text || !personaId) {
      return NextResponse.json({ error: 'text and personaId are required' }, { status: 400 });
    }

    const persona = await prisma.creatorPersona.findUnique({
      where: { id: personaId, userId },
    });
    if (!persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 });
    }

    const transcriptTitle = title || 'Untitled Transcript';

    const systemPrompt = `You are a content analysis expert. Extract 3-7 specific, actionable lessons from the following transcript.

For each lesson, provide:
- A short title (e.g. "Hook structure", "Pacing", "CTA style")
- A detailed description of the technique or pattern observed

Focus on:
- Hook style (how they open)
- Pacing and structure
- Language and vocabulary
- CTA patterns
- Storytelling patterns

Return ONLY a JSON array of objects, each with "title" and "content" fields. No markdown, no explanation.`;

    const userPrompt = `Title: ${transcriptTitle}\n\nTranscript:\n${text.substring(0, 8000)}`;

    let aiResponse: string;
    try {
      aiResponse = await generateCompletion({
        userId,
        systemPrompt,
        userPrompt,
        temperature: 0.3,
        maxTokens: 2048,
      });
    } catch {
      return NextResponse.json(
        { error: 'AI extraction failed. Check your DeepSeek API key.' },
        { status: 503 }
      );
    }

    let lessons: { title: string; content: string }[] = [];
    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : aiResponse;
      lessons = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse AI response.' },
        { status: 500 }
      );
    }

    if (!Array.isArray(lessons) || lessons.length === 0) {
      return NextResponse.json(
        { error: 'No lessons could be extracted.' },
        { status: 422 }
      );
    }

    const savedLessons = await Promise.all(
      lessons.map((lesson) =>
        prisma.personaLesson.create({
          data: {
            personaId,
            title: lesson.title || 'Untitled Lesson',
            content: lesson.content || '',
            url: url || null,
          },
        })
      )
    );

    await prisma.personaExample.create({
      data: {
        personaId,
        sourceType: 'transcription',
        content: text.substring(0, 5000),
        note: transcriptTitle,
      },
    });

    return NextResponse.json({
      success: true,
      lessons: savedLessons.length,
      example: transcriptTitle,
      data: savedLessons,
    });
  } catch (error) {
    console.error('Extract lessons error:', error);
    return NextResponse.json(
      { error: 'Failed to extract lessons' },
      { status: 500 }
    );
  }
}
