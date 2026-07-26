import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const transcriptions = await prisma.savedTranscription.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      url: true,
      title: true,
      text: true,
      segments: true,
      language: true,
      duration: true,
      createdAt: true,
    },
  });

  return NextResponse.json(transcriptions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { url, title, text, segments, language, duration } = await req.json();

    if (!url || !text) {
      return NextResponse.json(
        { error: 'URL and text are required' },
        { status: 400 }
      );
    }

    const saved = await prisma.savedTranscription.create({
      data: {
        userId: session.user.id,
        url,
        title: title || 'Untitled',
        text,
        segments: segments ? JSON.stringify(segments) : null,
        language: language || 'unknown',
        duration: duration || null,
      },
    });

    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error('Save error:', error);
    return NextResponse.json(
      { error: 'Failed to save transcription' },
      { status: 500 }
    );
  }
}
