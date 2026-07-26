import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/api-keys/[id] — get a single key with all fields
// Returns client-side encryptedKey + iv for client-side decryption (master password),
// and server-side encrypted fields for automated API use.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const entry = await prisma.apiKey.findUnique({
    where: { id },
  });

  if (!entry || entry.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: entry.id,
    name: entry.name,
    description: entry.description,
    encryptedKey: entry.encryptedKey,
    iv: entry.iv,
    serverEncryptedKey: entry.serverEncryptedKey,
    serverIv: entry.serverIv,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });
}

// DELETE /api/api-keys/[id] — delete a key
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const entry = await prisma.apiKey.findUnique({
    where: { id },
  });

  if (!entry || entry.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.apiKey.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
