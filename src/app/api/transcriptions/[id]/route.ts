import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const transcription = await prisma.savedTranscription.findUnique({
    where: { id },
  });

  if (!transcription) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (transcription.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.savedTranscription.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
