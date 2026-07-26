import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const scripts = await prisma.script.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      style: {
        select: { name: true },
      },
      project: {
        select: { name: true },
      },
    },
  });

  return NextResponse.json(scripts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, content, styleId, projectId } = await req.json();

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const script = await prisma.script.create({
      data: {
        userId: session.user.id,
        title: title.trim(),
        content,
        ...(styleId ? { styleId } : {}),
        ...(projectId ? { projectId } : {}),
      },
      include: {
        style: {
          select: { name: true },
        },
        project: {
          select: { name: true },
        },
      },
    });

    return NextResponse.json(script, { status: 201 });
  } catch (error) {
    console.error('Create script error:', error);
    return NextResponse.json(
      { error: 'Failed to create script' },
      { status: 500 }
    );
  }
}
