import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify ownership
  const persona = await prisma.creatorPersona.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!persona) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (persona.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const lessons = await prisma.personaLesson.findMany({
    where: { personaId: id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(lessons);
}

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
    // Verify ownership
    const persona = await prisma.creatorPersona.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!persona) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (persona.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { title, content, url } = await req.json();

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const lesson = await prisma.personaLesson.create({
      data: {
        personaId: id,
        title: title.trim(),
        content: content.trim(),
        url: url?.trim() || null,
      },
    });

    return NextResponse.json(lesson, { status: 201 });
  } catch (error) {
    console.error('Create lesson error:', error);
    return NextResponse.json(
      { error: 'Failed to create lesson' },
      { status: 500 }
    );
  }
}
