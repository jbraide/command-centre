import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lesson = await prisma.personaLesson.findUnique({
    where: { id },
    include: {
      persona: { select: { userId: true } },
    },
  });

  if (!lesson) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (lesson.persona.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.personaLesson.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const lesson = await prisma.personaLesson.findUnique({
    where: { id },
    include: { persona: { select: { userId: true } } },
  });

  if (!lesson) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (lesson.persona.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { title, content, url } = await req.json();

    const updated = await prisma.personaLesson.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(url !== undefined ? { url: url || null } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update lesson error:', error);
    return NextResponse.json({ error: 'Failed to update lesson' }, { status: 500 });
  }
}
