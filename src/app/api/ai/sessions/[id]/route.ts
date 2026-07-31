import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * DELETE /api/ai/sessions/[id]
 * Delete a chat session and its messages.
 * Verifies the session belongs to the authenticated user.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const { id: sessionId } = await params;

  try {
    // Verify ownership before deleting
    const existing = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 },
      );
    }

    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await prisma.chatSession.delete({
      where: { id: sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 },
    );
  }
}
