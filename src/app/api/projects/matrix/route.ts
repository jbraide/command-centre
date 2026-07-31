import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// 48 hours in milliseconds
const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;

function isWithin48h(date: Date | null): boolean {
  if (!date) return false;
  return date.getTime() - Date.now() <= FORTY_EIGHT_HOURS;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch all top-level tasks across all of the user's projects
    const tasks = await prisma.task.findMany({
      where: {
        project: {
          userId: session.user.id,
        },
        parentId: null, // Only top-level tasks
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            color: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const quadrants: {
      do: typeof tasks;
      schedule: typeof tasks;
      delegate: typeof tasks;
      eliminate: typeof tasks;
    } = {
      do: [],
      schedule: [],
      delegate: [],
      eliminate: [],
    };

    for (const task of tasks) {
      const isHigh = task.priority === 'HIGH';
      const isLowMed = task.priority === 'LOW' || task.priority === 'MEDIUM';
      const dueSoon = isWithin48h(task.dueDate);

      if (isHigh && dueSoon) {
        // Q1: Do — urgent + important
        quadrants.do.push(task);
      } else if (isHigh) {
        // Q2: Schedule — not urgent + important (includes no dueDate)
        quadrants.schedule.push(task);
      } else if (isLowMed && dueSoon) {
        // Q3: Delegate — urgent + not important
        quadrants.delegate.push(task);
      } else if (isLowMed) {
        // Q4: Eliminate — not urgent + not important (includes no dueDate)
        quadrants.eliminate.push(task);
      }
    }

    return NextResponse.json({ quadrants });
  } catch (error) {
    console.error('Matrix fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch matrix data' },
      { status: 500 }
    );
  }
}
