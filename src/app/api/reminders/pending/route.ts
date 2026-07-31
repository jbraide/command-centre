import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const reminders = await prisma.reminder.findMany({
      where: {
        userId: session.user.id,
        fired: false,
        triggerAt: { lte: now },
      },
      orderBy: { triggerAt: 'asc' },
      include: {
        task: { select: { id: true, title: true, projectId: true } },
        idea: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(reminders);
  } catch (error) {
    console.error('Get pending reminders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending reminders' },
      { status: 500 }
    );
  }
}
