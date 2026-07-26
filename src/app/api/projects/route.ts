import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      color: true,
      status: true,
      createdAt: true,
      _count: {
        select: {
          tasks: true,
        },
      },
    },
  });

  // Get completed task counts for all returned projects
  const projectIds = projects.map((p) => p.id);
  const completedCounts = await prisma.task.groupBy({
    by: ['projectId'],
    where: {
      projectId: { in: projectIds },
      completed: true,
    },
    _count: { id: true },
  });

  const completedMap = new Map(
    completedCounts.map((c) => [c.projectId, c._count.id])
  );

  const result = projects.map((project) => ({
    ...project,
    completedTasks: completedMap.get(project.id) ?? 0,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description, color } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        description: description?.trim() ?? null,
        ...(color ? { color } : {}),
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
