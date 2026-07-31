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

  const examples = await prisma.personaExample.findMany({
    where: { personaId: id },
    orderBy: { createdAt: 'desc' },
    include: {
      transcription: {
        select: { id: true, title: true },
      },
    },
  });

  return NextResponse.json(examples);
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

    const { sourceType, transcriptionId, content, note } = await req.json();

    if (!sourceType || !['manual', 'transcription'].includes(sourceType)) {
      return NextResponse.json({ error: 'Valid sourceType is required (manual | transcription)' }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // If linked to a transcription, verify it belongs to the user
    if (transcriptionId) {
      const transcription = await prisma.savedTranscription.findUnique({
        where: { id: transcriptionId },
        select: { userId: true },
      });

      if (!transcription || transcription.userId !== session.user.id) {
        return NextResponse.json({ error: 'Invalid transcription' }, { status: 400 });
      }
    }

    const example = await prisma.personaExample.create({
      data: {
        personaId: id,
        sourceType,
        transcriptionId: transcriptionId || null,
        content: content.trim(),
        note: note?.trim() ?? null,
      },
      include: {
        transcription: {
          select: { id: true, title: true },
        },
      },
    });

    return NextResponse.json(example, { status: 201 });
  } catch (error) {
    console.error('Create example error:', error);
    return NextResponse.json(
      { error: 'Failed to create example' },
      { status: 500 }
    );
  }
}
