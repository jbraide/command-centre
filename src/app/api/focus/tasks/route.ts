import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const projects = await prisma.project.findMany({
      where: { userId: session.user.id, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        tasks: {
          where: { completed: false },
          select: {
            id: true,
            title: true,
            projectId: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Flatten into a list of tasks with project name
    const tasks = projects.flatMap((p) =>
      p.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        projectId: t.projectId,
        projectName: p.name,
      }))
    );

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Fetch focus tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
