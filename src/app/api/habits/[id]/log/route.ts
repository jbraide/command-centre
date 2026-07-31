import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function getDaysArray(days: number): Date[] {
  const today = getTodayUTC();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export async function POST(
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

    // Toggle today's log
    const today = getTodayUTC();
    const existingLog = await prisma.habitLog.findUnique({
      where: { habitId_date: { habitId: id, date: today } },
    });

    let completed: boolean;
    if (existingLog) {
      await prisma.habitLog.delete({ where: { id: existingLog.id } });
      completed = false;
    } else {
      await prisma.habitLog.create({
        data: { habitId: id, date: today, completed: true },
      });
      completed = true;
    }

    // Recalculate streak
    const updatedLogs = await prisma.habitLog.findMany({
      where: { habitId: id },
      orderBy: { date: 'desc' },
    });

    let streak = 0;
    for (const day of getDaysArray(365)) {
      const log = updatedLogs.find((l) => isSameDay(l.date, day));
      if (log) {
        streak++;
      } else {
        if (day.getTime() < today.getTime()) break;
      }
    }

    // Completion rate for last 30 days
    const last30Days = getDaysArray(30);
    const doneCount = last30Days.filter((day) =>
      updatedLogs.some((log) => isSameDay(log.date, day))
    ).length;
    const completionRate = Math.round((doneCount / 30) * 100);

    return NextResponse.json({
      habitId: id,
      date: today.toISOString(),
      completed,
      streak,
      completionRate,
    });
  } catch (error) {
    console.error('Toggle habit log error:', error);
    return NextResponse.json(
      { error: 'Failed to toggle habit log' },
      { status: 500 }
    );
  }
}
