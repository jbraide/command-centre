import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const task = await prisma.task.findUnique({ where: { id } });

    if (!task) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
    });

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { title, description, dueDate, priority, completed, sortOrder, repeatInterval, repeatEndDate, repeatCount, projectId, goalId } =
      await req.json();

    // Moving a task to another project
    if (projectId !== undefined && projectId !== task.projectId) {
      if (task.parentId) {
        return NextResponse.json(
          { error: 'Move the parent task instead — subtasks follow their parent' },
          { status: 400 }
        );
      }
      if (!projectId || typeof projectId !== 'string') {
        return NextResponse.json(
          { error: 'Invalid target project' },
          { status: 400 }
        );
      }
      const targetProject = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!targetProject || targetProject.userId !== session.user.id) {
        return NextResponse.json(
          { error: 'Target project not found' },
          { status: 404 }
        );
      }
    }

    // Goal assignment (nullable)
    if (goalId !== undefined && goalId !== null) {
      const goal = await prisma.goal.findUnique({ where: { id: goalId } });
      if (!goal || goal.userId !== session.user.id) {
        return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
      }
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(dueDate !== undefined
          ? { dueDate: dueDate ? new Date(dueDate) : null }
          : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(completed !== undefined ? { completed } : {}),
        ...(sortOrder !== undefined ? { sortOrder } : {}),
        ...(repeatInterval !== undefined ? { repeatInterval } : {}),
        ...(repeatEndDate !== undefined
          ? { repeatEndDate: repeatEndDate ? new Date(repeatEndDate) : null }
          : {}),
        ...(repeatCount !== undefined ? { repeatCount } : {}),
        ...(projectId !== undefined && projectId !== task.projectId
          ? { projectId }
          : {}),
        ...(goalId !== undefined ? { goalId: goalId || null } : {}),
      },
    });

    // If the task was moved, carry its subtasks along
    if (projectId !== undefined && projectId !== task.projectId) {
      await prisma.task.updateMany({
        where: { parentId: task.id },
        data: { projectId },
      });
    }

    // Auto-create reminder when dueDate is set/updated
    if (dueDate !== undefined && updated.dueDate && !updated.parentId) {
      const triggerAt = new Date(updated.dueDate.getTime() - 60 * 60 * 1000);
      // Only create if no existing unfired reminder for this task
      const existing = await prisma.reminder.findFirst({
        where: { taskId: id, fired: false },
      });
      if (!existing) {
        await prisma.reminder.create({
          data: {
            userId: session.user.id,
            taskId: id,
            triggerAt,
            title: `Due soon: ${updated.title}`,
            note: updated.description || undefined,
          },
        }).catch((err) => console.error('Auto-reminder creation failed:', err));
      }
    }

    // If marking as completed and task has a repeatInterval, create a recurring copy
    let newRecurringTask = null;
    if (completed === true && task.repeatInterval) {
      const now = new Date();
      let newDueDate: Date | null = null;

      if (task.dueDate) {
        const base = new Date(task.dueDate);
        switch (task.repeatInterval) {
          case 'daily':
            base.setDate(base.getDate() + 1);
            break;
          case 'weekdays':
            // Add 1 day; if it lands on weekend, skip to Monday
            base.setDate(base.getDate() + 1);
            while (base.getDay() === 0 || base.getDay() === 6) {
              base.setDate(base.getDate() + 1);
            }
            break;
          case 'weekly':
            base.setDate(base.getDate() + 7);
            break;
          case 'monthly':
            base.setMonth(base.getMonth() + 1);
            break;
          case 'yearly':
            base.setFullYear(base.getFullYear() + 1);
            break;
        }
        newDueDate = base;
      }

      // Check repeatEndDate
      if (task.repeatEndDate && newDueDate && newDueDate > task.repeatEndDate) {
        // Recurrence ended; don't create a new task
      } else {
        // Check repeatCount
        let newRepeatCount = task.repeatCount;
        if (newRepeatCount !== null && newRepeatCount !== undefined) {
          if (newRepeatCount <= 1) {
            // This was the last occurrence; don't create a new task
          } else {
            newRepeatCount = newRepeatCount - 1;

            newRecurringTask = await prisma.task.create({
              data: {
                title: task.title,
                description: task.description,
                priority: task.priority,
                projectId: updated.projectId,
                dueDate: newDueDate,
                repeatInterval: task.repeatInterval,
                repeatEndDate: task.repeatEndDate,
                repeatCount: newRepeatCount,
              },
              include: { subtasks: true },
            });
          }
        } else {
          // No repeatCount limit, create indefinitely
          newRecurringTask = await prisma.task.create({
            data: {
              title: task.title,
              description: task.description,
              priority: task.priority,
              projectId: updated.projectId,
              dueDate: newDueDate,
              repeatInterval: task.repeatInterval,
              repeatEndDate: task.repeatEndDate,
              repeatCount: null,
            },
            include: { subtasks: true },
          });
        }
      }
    }

    return NextResponse.json({ updated, newRecurringTask });
  } catch (error) {
    console.error('Update task error:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const task = await prisma.task.findUnique({ where: { id } });

    if (!task) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const project = await prisma.project.findUnique({
      where: { id: task.projectId },
    });

    if (!project || project.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.task.deleteMany({ where: { parentId: id } });
    await prisma.task.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete task error:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
