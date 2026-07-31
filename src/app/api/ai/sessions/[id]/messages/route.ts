import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getMessages } from '@/lib/ai/db';

/**
 * GET /api/ai/sessions/[id]/messages
 * Returns all messages for a session, ordered by creation time (ASC).
 * Verifies the session belongs to the authenticated user.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: sessionId } = await params;

  try {
    // Verify the session belongs to the authenticated user
    const sessionRecord = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    if (!sessionRecord || sessionRecord.userId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const messages = await getMessages(sessionId);

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 },
    );
  }
}
