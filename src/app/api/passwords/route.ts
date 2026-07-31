import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/passwords — list all password entries for the user
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const includeEncrypted = url.searchParams.get('includeEncrypted') === 'true';

  const entries = await prisma.passwordEntry.findMany({
    where: { userId: session.user.id },
    select: includeEncrypted
      ? {
          id: true,
          website: true,
          username: true,
          encryptedPassword: true,
          iv: true,
          encryptedNotes: true,
          createdAt: true,
        }
      : {
          id: true,
          website: true,
          username: true,
          createdAt: true,
        },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(entries);
}

// POST /api/passwords — create a new password entry
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { website, username, encryptedPassword, iv, encryptedNotes } = body;

    if (!website || !username || !encryptedPassword || !iv) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const entry = await prisma.passwordEntry.create({
      data: {
        userId: session.user.id,
        website,
        username,
        encryptedPassword,
        iv,
        encryptedNotes: encryptedNotes || null,
      },
      select: {
        id: true,
        website: true,
        username: true,
        createdAt: true,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Error creating password entry:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/passwords — delete all password entries for the user (reset vault)
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.passwordEntry.deleteMany({
      where: { userId: session.user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error resetting vault:', error);
    return NextResponse.json(
      { error: 'Failed to reset vault' },
      { status: 500 }
    );
  }
}
