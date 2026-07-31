import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const scriptIncludes = {
  style: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
  persona: { select: { id: true, name: true, colorTag: true } },
  idea: { select: { id: true, title: true } },
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const script = await prisma.script.findUnique({
    where: { id },
    include: scriptIncludes,
  });

  if (!script) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (script.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(script);
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
    const script = await prisma.script.findUnique({ where: { id } });

    if (!script) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (script.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { title, content, styleId, projectId, personaId, ideaId } = await req.json();

    const updated = await prisma.script.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(styleId !== undefined ? { styleId: styleId ?? null } : {}),
        ...(projectId !== undefined ? { projectId: projectId ?? null } : {}),
        ...(personaId !== undefined ? { personaId: personaId ?? null } : {}),
        ...(ideaId !== undefined ? { ideaId: ideaId ?? null } : {}),
      },
      include: scriptIncludes,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update script error:', error);
    return NextResponse.json(
      { error: 'Failed to update script' },
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

  const script = await prisma.script.findUnique({ where: { id } });

  if (!script) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (script.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.script.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
