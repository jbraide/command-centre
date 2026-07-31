import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const sessions = await prisma.focusSession.findMany({
      where: {
        userId: session.user.id,
        startedAt: { gte: startOfDay, lte: endOfDay },
      },
      orderBy: { startedAt: 'desc' },
    });

    const endedSessions = sessions.filter((s) => s.endedAt);
    const totalMinutes = endedSessions.reduce(
      (sum, s) => sum + (s.duration || 0),
      0
    );
    const completedPomodoros = endedSessions.reduce(
      (sum, s) => sum + s.completedPomodoros,
      0
    );

    const currentSession = sessions.find((s) => !s.endedAt) ?? null;

    return NextResponse.json({
      totalSessions: endedSessions.length,
      totalMinutes,
      completedPomodoros: completedPomodoros || endedSessions.length,
      currentSession,
    });
  } catch (error) {
    console.error('Fetch today focus sessions error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch today stats' },
      { status: 500 }
    );
  }
}
