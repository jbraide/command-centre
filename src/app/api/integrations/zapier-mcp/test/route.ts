import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const MOCK_TOOLS = [
  'add_calendar_event',
  'get_calendar_events',
  'send_gmail',
  'create_google_doc',
  'find_google_doc',
  'send_slack_message',
  'create_trello_card',
  'add_dropbox_file',
];

// POST /api/integrations/zapier-mcp/test — test connection to Zapier MCP endpoint
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

    // TODO: Replace with actual Zapier MCP SDK connection test
    // For now, simulate a successful connection by returning mock tool names
    // when the endpoint URL looks valid and an API key is provided.
    //
    // Future implementation should use the @zapier/mcp-client SDK:
    //   import { MCPClient } from '@zapier/mcp-client';
    //   const client = new MCPClient({ apiKey, endpointUrl });
    //   const tools = await client.listTools();

    return NextResponse.json({
      success: true,
      tools: MOCK_TOOLS,
      message: `Connected to Zapier MCP at ${endpointUrl}`,
    });
  } catch (error) {
    console.error('Zapier MCP test error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
