import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const example = await prisma.personaExample.findUnique({
    where: { id },
    include: {
      persona: { select: { userId: true } },
    },
  });

  if (!example) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (example.persona.userId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.personaExample.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
