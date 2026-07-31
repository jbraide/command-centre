import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { title, description, dueDate, priority, parentId } = await req.json();

    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Validate parentId if provided (one level deep only)
    if (parentId) {
      const parentTask = await prisma.task.findUnique({
        where: { id: parentId },
      });

      if (!parentTask) {
        return NextResponse.json(
          { error: 'Parent task not found' },
          { status: 404 }
        );
      }

      if (parentTask.projectId !== id) {
        return NextResponse.json(
          { error: 'Parent task does not belong to this project' },
          { status: 400 }
        );
      }

      if (parentTask.parentId) {
        return NextResponse.json(
          { error: 'Subtasks can only be one level deep' },
          { status: 400 }
        );
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority: priority ?? 'MEDIUM',
        projectId: id,
        parentId: parentId || undefined,
      },
      include: { subtasks: true },
    });

    // Auto-create reminder when task has a dueDate (1 hour before due)
    if (task.dueDate && !task.parentId) {
      const triggerAt = new Date(task.dueDate.getTime() - 60 * 60 * 1000);
      await prisma.reminder.create({
        data: {
          userId: session.user.id,
          taskId: task.id,
          triggerAt,
          title: `Due soon: ${task.title}`,
          note: description || undefined,
        },
      }).catch((err) => console.error('Auto-reminder creation failed:', err));
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
