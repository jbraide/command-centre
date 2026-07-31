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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const habits = await prisma.habit.findMany({
      where: { userId: session.user.id, active: true },
      include: { logs: { orderBy: { date: 'desc' } } },
      orderBy: { createdAt: 'asc' },
    });

    const today = getTodayUTC();

    const result = habits.map((habit) => {
      // todayDone
      const todayLog = habit.logs.find((log) => isSameDay(log.date, today));
      const todayDone = !!todayLog;

      // Streak: count consecutive days back from today
      // Logs are already sorted descending by Prisma
      let streak = 0;
      let checkDate = new Date(today);

      for (const log of habit.logs) {
        if (!log.completed) continue;

        if (isSameDay(log.date, checkDate)) {
          streak++;
          checkDate.setUTCDate(checkDate.getUTCDate() - 1);
        } else if (log.date.getTime() < checkDate.getTime()) {
          break;
        }
      }

      // Completion rate for last 30 days
      const last30Days = new Set(
        getDaysArray(30).map((d) => d.toISOString().split('T')[0])
      );
      const doneCount = habit.logs.filter((log) =>
        last30Days.has(log.date.toISOString().split('T')[0])
      ).length;
      const completionRate = Math.round((doneCount / 30) * 100);

      return {
        id: habit.id,
        name: habit.name,
        description: habit.description,
        frequency: habit.frequency,
        color: habit.color,
        active: habit.active,
        todayDone,
        streak,
        completionRate,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Fetch habits error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch habits' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description, frequency, color } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const habit = await prisma.habit.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        description: description?.trim() ?? null,
        frequency: frequency ?? 'daily',
        color: color ?? '#7fd858',
      },
    });

    return NextResponse.json(habit, { status: 201 });
  } catch (error) {
    console.error('Create habit error:', error);
    return NextResponse.json(
      { error: 'Failed to create habit' },
      { status: 500 }
    );
  }
}
