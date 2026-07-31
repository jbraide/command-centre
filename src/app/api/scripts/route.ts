import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const scriptIncludes = {
  style: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  persona: { select: { id: true, name: true, colorTag: true } },
  idea: { select: { id: true, title: true } },
} as const;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const personaId = searchParams.get('personaId');

  const where: Record<string, unknown> = { userId: session.user.id };

  if (personaId) {
    where.personaId = personaId;
  }

  const scripts = await prisma.script.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: scriptIncludes,
  });

  return NextResponse.json(scripts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, content, styleId, projectId, personaId, ideaId } = await req.json();

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
        ...(personaId ? { personaId } : {}),
        ...(ideaId ? { ideaId } : {}),
      },
      include: scriptIncludes,
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
