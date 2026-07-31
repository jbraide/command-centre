import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/ai/sessions
 * List all chat sessions for the authenticated user, including message count.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const sessions = await prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        _count: {
          select: { messages: true },
        },
      },
    });

    const result = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      messageCount: s._count.messages,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('List sessions error:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/ai/sessions
 * Create a new chat session for the authenticated user.
 * Accepts an optional title in the request body.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await req.json().catch(() => ({}));
    const title: string | undefined = body?.title;

    const chatSession = await prisma.chatSession.create({
      data: {
        userId,
        title: title?.trim() || null,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });

    return NextResponse.json(chatSession, { status: 201 });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 },
    );
  }
}
