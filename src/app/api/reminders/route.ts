import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const fired = searchParams.get('fired');

    const where: Record<string, unknown> = { userId: session.user.id };
    if (fired === 'false') {
      where.fired = false;
    } else if (fired === 'true') {
      where.fired = true;
    }

    const reminders = await prisma.reminder.findMany({
      where,
      orderBy: { triggerAt: 'asc' },
      include: {
        task: { select: { id: true, title: true, projectId: true } },
        idea: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(reminders);
  } catch (error) {
    console.error('Get reminders error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reminders' },
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
    const { taskId, ideaId, triggerAt, title, note } = await req.json();

    if (!title || !triggerAt) {
      return NextResponse.json(
        { error: 'Title and triggerAt are required' },
        { status: 400 }
      );
    }

    const reminder = await prisma.reminder.create({
      data: {
        userId: session.user.id,
        taskId: taskId || undefined,
        ideaId: ideaId || undefined,
        triggerAt: new Date(triggerAt),
        title,
        note: note || undefined,
      },
    });

    return NextResponse.json(reminder, { status: 201 });
  } catch (error) {
    console.error('Create reminder error:', error);
    return NextResponse.json(
      { error: 'Failed to create reminder' },
      { status: 500 }
    );
  }
}
