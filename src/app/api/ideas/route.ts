import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const tag = searchParams.get('tag');

  const where: Record<string, unknown> = { userId: session.user.id };

  if (status && ['raw', 'promoted', 'archived'].includes(status)) {
    where.status = status;
  }

  if (tag) {
    // tags is a JSON string array — use LIKE to find the tag substring
    where.tags = { contains: tag };
  }

  try {
    const ideas = await prisma.idea.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        script: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(ideas);
  } catch (error) {
    console.error('Fetch ideas error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ideas' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, rawNotes, tags } = await req.json();

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Normalize tags: accept comma-separated string or JSON array
    let tagsValue: string | null = null;
    if (tags) {
      if (Array.isArray(tags)) {
        tagsValue = JSON.stringify(tags);
      } else if (typeof tags === 'string') {
        const parsed = tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
        tagsValue = JSON.stringify(parsed);
      }
    }

    const idea = await prisma.idea.create({
      data: {
        userId: session.user.id,
        title: title.trim(),
        rawNotes: rawNotes?.trim() ?? null,
        tags: tagsValue,
        status: 'raw',
      },
      include: {
        project: { select: { id: true, name: true } },
        script: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json(idea, { status: 201 });
  } catch (error) {
    console.error('Create idea error:', error);
    return NextResponse.json(
      { error: 'Failed to create idea' },
      { status: 500 }
    );
  }
}
