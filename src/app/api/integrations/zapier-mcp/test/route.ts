import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { testZapierConnection } from '@/lib/ai/zapier-mcp';

// POST /api/integrations/zapier-mcp/test — connect to a Zapier MCP endpoint
// and return the tools it exposes.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { apiKey, endpointUrl } = body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'API key is required.' },
        { status: 400 }
      );
    }

    if (!endpointUrl || typeof endpointUrl !== 'string' || endpointUrl.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'MCP endpoint URL is required.' },
        { status: 400 }
      );
    }

    // Basic URL format validation
    try {
      const url = new URL(endpointUrl);
      if (url.protocol !== 'https:') {
        return NextResponse.json(
          { success: false, error: 'MCP endpoint URL must use HTTPS.' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'MCP endpoint URL is not a valid URL.' },
        { status: 400 }
      );
    }

    const result = await testZapierConnection({
      endpointUrl: endpointUrl.trim(),
      apiKey: apiKey.trim(),
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: `Failed to connect: ${result.error ?? 'unknown error'}`,
      });
    }

    return NextResponse.json({
      success: true,
      count: result.count ?? 0,
      tools: result.tools ?? [],
      message: `Connected to Zapier MCP — ${result.count ?? 0} tools available`,
    });
  } catch (error) {
    console.error('Zapier MCP test error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
