import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function findOwnedGoal(id: string, userId: string) {
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal || goal.userId !== userId) return null;
  return goal;
}

// GET /api/goals/[id] — get a single goal with its tasks
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const goal = await findOwnedGoal(id, session.user.id);
  if (!goal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const tasks = await prisma.task.findMany({
    where: { goalId: id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      completed: true,
      dueDate: true,
      priority: true,
      projectId: true,
      project: { select: { name: true } },
    },
  });

  return NextResponse.json({ ...goal, tasks });
}

// PATCH /api/goals/[id] — update a goal
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const goal = await findOwnedGoal(id, session.user.id);
  if (!goal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const { name, description, targetDate, status, color } = await request.json();

    const updated = await prisma.goal.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(targetDate !== undefined
          ? { targetDate: targetDate ? new Date(targetDate) : null }
          : {}),
        ...(status !== undefined ? { status } : {}),
        ...(color !== undefined ? { color } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update goal error:', error);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
  }
}

// DELETE /api/goals/[id] — delete a goal (tasks are unlinked, not deleted)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const goal = await findOwnedGoal(id, session.user.id);
  if (!goal) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.goal.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
