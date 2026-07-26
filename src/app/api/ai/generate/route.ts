import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateCompletion, buildScriptPrompt } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    return NextResponse.json(
      { error: 'DeepSeek API key not configured. Set DEEPSEEK_API_KEY in your .env file.' },
      { status: 503 }
    );
  }

  try {
    const {
      topic,
      personaLessons,
      personaExamples,
      scriptStyle,
      constraints,
      thinking,
    } = await req.json();

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json(
        { error: 'Topic is required' },
        { status: 400 }
      );
    }

    const systemPrompt = buildScriptPrompt({
      topic,
      personaLessons,
      personaExamples,
      scriptStyle,
      constraints,
    });

    const content = await generateCompletion({
      systemPrompt,
      userPrompt: `Topic: ${topic}\n\nWrite the script.`,
      temperature: 0.7,
      maxTokens: 2048,
      thinking: thinking ?? false,
    });

    return NextResponse.json({ content });
  } catch (error) {
    console.error('AI generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate script. Check your API key and try again.' },
      { status: 500 }
    );
  }
}
