import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { apiKey, model } = await req.json();

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'API key is required' },
        { status: 400 }
      );
    }

    const selectedModel = model || 'deepseek-v4-flash';

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [{ role: 'user', content: 'Respond with only the word: ok' }],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      return NextResponse.json(
        {
          success: false,
          error: `API returned ${response.status}: ${errorBody || response.statusText}`,
        },
        { status: 200 }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

    return NextResponse.json({
      success: true,
      message: `Connected successfully using ${selectedModel}`,
      model: selectedModel,
      reply: reply.trim(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to test connection' },
      { status: 200 }
    );
  }
}
