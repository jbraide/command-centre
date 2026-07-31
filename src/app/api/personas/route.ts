import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const personas = await prisma.creatorPersona.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { examples: true, lessons: true, scripts: true },
      },
    },
  });

  return NextResponse.json(personas);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description, colorTag, active } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const persona = await prisma.creatorPersona.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        ...(description !== undefined ? { description: description?.trim() ?? null } : {}),
        ...(colorTag !== undefined ? { colorTag: colorTag ?? '#7fd858' } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    });

    return NextResponse.json(persona, { status: 201 });
  } catch (error) {
    console.error('Create persona error:', error);
    return NextResponse.json(
      { error: 'Failed to create persona' },
      { status: 500 }
    );
  }
}
