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

  const persona = await prisma.creatorPersona.findUnique({
    where: { id },
    include: {
      examples: {
        orderBy: { createdAt: 'desc' },
        include: {
          transcription: {
            select: { id: true, title: true },
          },
        },
      },
      lessons: {
        orderBy: { createdAt: 'desc' },
      },
      _count: {
        select: { scripts: true },
      },
    },
  });

  if (!persona) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (persona.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(persona);
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

  try {
    const persona = await prisma.creatorPersona.findUnique({ where: { id } });

    if (!persona) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (persona.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, colorTag, active } = await req.json();

    const updated = await prisma.creatorPersona.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() ?? null } : {}),
        ...(colorTag !== undefined ? { colorTag: colorTag ?? '#7fd858' } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update persona error:', error);
    return NextResponse.json(
      { error: 'Failed to update persona' },
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

  const persona = await prisma.creatorPersona.findUnique({ where: { id } });

  if (!persona) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (persona.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Cascade deletes examples and lessons, scripts get SetNull
  await prisma.creatorPersona.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
