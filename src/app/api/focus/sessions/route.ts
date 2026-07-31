import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { taskId, duration, breakDuration } = await req.json();

    const focusSession = await prisma.focusSession.create({
      data: {
        userId: session.user.id,
        taskId: taskId ?? null,
        duration: duration ?? 25,
        breakDuration: breakDuration ?? 5,
        startedAt: new Date(),
      },
    });

    return NextResponse.json(focusSession, { status: 201 });
  } catch (error) {
    console.error('Create focus session error:', error);
    return NextResponse.json(
      { error: 'Failed to create focus session' },
      { status: 500 }
    );
  }
}
