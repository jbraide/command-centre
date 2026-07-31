import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (idea.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { title, rawNotes, tags, status, linkedProjectId, linkedScriptId } =
      await req.json();

    // Validate status if provided
    if (
      status !== undefined &&
      !['raw', 'promoted', 'archived'].includes(status)
    ) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (title !== undefined) data.title = title.trim();
    if (rawNotes !== undefined) data.rawNotes = rawNotes?.trim() ?? null;
    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        data.tags = JSON.stringify(tags);
      } else if (typeof tags === 'string') {
        const parsed = tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean);
        data.tags = JSON.stringify(parsed);
      } else {
        data.tags = null;
      }
    }
    if (status !== undefined) data.status = status;
    if (linkedProjectId !== undefined) data.linkedProjectId = linkedProjectId || null;
    if (linkedScriptId !== undefined) data.linkedScriptId = linkedScriptId || null;

    const updated = await prisma.idea.update({
      where: { id },
      data,
      include: {
        project: { select: { id: true, name: true } },
        script: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update idea error:', error);
    return NextResponse.json(
      { error: 'Failed to update idea' },
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

  try {
    const idea = await prisma.idea.findUnique({ where: { id } });
    if (!idea) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (idea.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.idea.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete idea error:', error);
    return NextResponse.json(
      { error: 'Failed to delete idea' },
      { status: 500 }
    );
  }
}
