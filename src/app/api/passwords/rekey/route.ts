import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// POST /api/passwords/rekey — batch-update all entries with new encryption
// Used when changing master password (client re-encrypts all entries)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { entries } = await request.json();

    if (!Array.isArray(entries)) {
      return NextResponse.json({ error: 'entries must be an array' }, { status: 400 });
    }

    // Verify all entries belong to this user before updating
    const userId = session.user.id;
    const existingIds = await prisma.passwordEntry.findMany({
      where: { userId },
      select: { id: true },
    });
    const validIds = new Set(existingIds.map((e) => e.id));

    for (const entry of entries) {
      if (!validIds.has(entry.id)) {
        return NextResponse.json(
          { error: `Entry ${entry.id} not found or not yours` },
          { status: 403 }
        );
      }
    }

    // Update all entries in a transaction
    await prisma.$transaction(
      entries.map((entry: { id: string; encryptedPassword: string; iv: string; encryptedNotes?: string | null }) =>
        prisma.passwordEntry.update({
          where: { id: entry.id },
          data: {
            encryptedPassword: entry.encryptedPassword,
            iv: entry.iv,
            encryptedNotes: entry.encryptedNotes ?? null,
          },
        })
      )
    );

    return NextResponse.json({ success: true, count: entries.length });
  } catch (error) {
    console.error('Rekey error:', error);
    return NextResponse.json({ error: 'Failed to re-encrypt entries' }, { status: 500 });
  }
}
