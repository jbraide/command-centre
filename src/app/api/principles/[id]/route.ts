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

  const principle = await prisma.keyPrinciple.findUnique({
    where: { id },
  });

  if (!principle) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (principle.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(principle);
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
    const principle = await prisma.keyPrinciple.findUnique({ where: { id } });

    if (!principle) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (principle.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { title, content } = await req.json();

    const updated = await prisma.keyPrinciple.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(content !== undefined ? { content } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update principle error:', error);
    return NextResponse.json(
      { error: 'Failed to update principle' },
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

  const principle = await prisma.keyPrinciple.findUnique({ where: { id } });

  if (!principle) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (principle.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.keyPrinciple.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
