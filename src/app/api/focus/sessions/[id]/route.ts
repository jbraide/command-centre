import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const focusSession = await prisma.focusSession.findUnique({
      where: { id },
    });

    if (!focusSession) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (focusSession.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { endedAt, completedPomodoros } = await req.json();

    const updated = await prisma.focusSession.update({
      where: { id },
      data: {
        ...(endedAt !== undefined ? { endedAt: new Date(endedAt) } : {}),
        ...(completedPomodoros !== undefined ? { completedPomodoros } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update focus session error:', error);
    return NextResponse.json(
      { error: 'Failed to update focus session' },
      { status: 500 }
    );
  }
}
