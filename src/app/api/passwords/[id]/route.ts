import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/passwords/[id] — get full entry data including encrypted fields
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const entry = await prisma.passwordEntry.findUnique({
    where: { id },
  });

  if (!entry || entry.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: entry.id,
    website: entry.website,
    username: entry.username,
    encryptedPassword: entry.encryptedPassword,
    iv: entry.iv,
    encryptedNotes: entry.encryptedNotes,
  });
}

// DELETE /api/passwords/[id] — delete a password entry
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const entry = await prisma.passwordEntry.findUnique({
    where: { id },
  });

  if (!entry || entry.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.passwordEntry.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
