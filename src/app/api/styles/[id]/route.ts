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

  const style = await prisma.scriptStyle.findUnique({
    where: { id },
    include: {
      _count: {
        select: { scripts: true },
      },
    },
  });

  if (!style) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (style.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(style);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const style = await prisma.scriptStyle.findUnique({ where: { id } });

    if (!style) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (style.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, description, guidelines } = await req.json();

    const updated = await prisma.scriptStyle.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() ?? null } : {}),
        ...(guidelines !== undefined ? { guidelines: guidelines?.trim() ?? null } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update style error:', error);
    return NextResponse.json(
      { error: 'Failed to update style' },
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

  const style = await prisma.scriptStyle.findUnique({ where: { id } });

  if (!style) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (style.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // OnDelete: SetNull for scripts — deletion won't cascade-delete associated scripts
  await prisma.scriptStyle.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
