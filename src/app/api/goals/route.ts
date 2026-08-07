import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/goals — list all goals with task progress
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const goals = await prisma.goal.findMany({
      where: { userId: session.user.id },
      orderBy: [{ status: 'asc' }, { targetDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        tasks: {
          select: { completed: true },
        },
      },
    });

    const result = goals.map((goal) => {
      const { tasks, ...rest } = goal;
      const total = tasks.length;
      const completed = tasks.filter((t) => t.completed).length;
      return {
        ...rest,
        taskCount: total,
        completedTasks: completed,
        remainingTasks: total - completed,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('List goals error:', error);
    return NextResponse.json({ error: 'Failed to load goals' }, { status: 500 });
  }
}

// POST /api/goals — create a goal
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description, targetDate, color } = await request.json();

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const goal = await prisma.goal.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        description: description || null,
        targetDate: targetDate ? new Date(targetDate) : null,
        color: color || undefined,
      },
    });

    return NextResponse.json(goal, { status: 201 });
  } catch (error) {
    console.error('Create goal error:', error);
    return NextResponse.json({ error: 'Failed to create goal' }, { status: 500 });
  }
}
