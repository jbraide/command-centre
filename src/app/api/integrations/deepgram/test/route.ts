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

    const selectedModel = model || 'nova-2';

    // Deepgram has a lightweight "balance" / account endpoint we can hit to validate the key.
    // For transcription services, a GET to /v1/keys or similar validates auth cheaply.
    const response = await fetch('https://api.deepgram.com/v1/projects', {
      method: 'GET',
      headers: {
        Authorization: `Token ${apiKey}`,
      },
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
    const projectName = data?.projects?.[0]?.name || '';

    return NextResponse.json({
      success: true,
      message: `Connected successfully${projectName ? ` to ${projectName}` : ''} (${selectedModel})`,
      model: selectedModel,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to test connection' },
      { status: 200 }
    );
  }
}
