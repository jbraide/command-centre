import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const habit = await prisma.habit.findUnique({ where: { id } });
    if (!habit) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (habit.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Generate last 30 days
    const today = new Date();
    const startDate = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - 29));

    const logs = await prisma.habitLog.findMany({
      where: {
        habitId: id,
        date: { gte: startDate },
      },
      orderBy: { date: 'asc' },
    });

    // Build array of { date, completed } for last 30 days
    const result = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate() - i));
      const log = logs.find(
        (l) =>
          l.date.getUTCFullYear() === d.getUTCFullYear() &&
          l.date.getUTCMonth() === d.getUTCMonth() &&
          l.date.getUTCDate() === d.getUTCDate()
      );
      result.push({
        date: d.toISOString(),
        completed: !!log,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fetch habit logs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch habit logs' },
      { status: 500 }
    );
  }
}
