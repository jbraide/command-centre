import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable(),
});

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
    const body = createProjectSchema.parse(await req.json());

    const project = await prisma.project.create({
      data: {
        userId: session.user.id,
        name: body.name,
        description: body.description ?? null,
        ...(body.color ? { color: body.color } : {}),
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }
    console.error('Create project error:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
