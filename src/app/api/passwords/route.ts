import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/passwords — list all password entries for the user (no encrypted data)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entries = await prisma.passwordEntry.findMany({
    where: { userId: session.user.id },
    select: {
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
