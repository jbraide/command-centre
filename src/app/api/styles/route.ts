import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const styles = await prisma.scriptStyle.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: {
        select: { scripts: true },
      },
    },
  });

  return NextResponse.json(styles);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, description, guidelines } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const style = await prisma.scriptStyle.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        ...(description !== undefined ? { description: description?.trim() ?? null } : {}),
        ...(guidelines !== undefined ? { guidelines: guidelines?.trim() ?? null } : {}),
      },
    });

    return NextResponse.json(style, { status: 201 });
  } catch (error) {
    console.error('Create style error:', error);
    return NextResponse.json(
      { error: 'Failed to create style' },
      { status: 500 }
    );
  }
}
