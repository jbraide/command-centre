import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { encryptApiKey } from '@/lib/api-key-crypto';

// GET /api/api-keys — list all api keys for the user
// Returns client-side encrypted data (encryptedKey, iv) so the UI can decrypt locally
// Server-side encrypted fields are NOT included in the list response
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      name: true,
      description: true,
      encryptedKey: true,
      iv: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(keys);
}

// POST /api/api-keys — create a new api key entry with dual encryption
//
// Request body:
//   name          - Display name for the key
//   description   - Optional description
//   encryptedKey  - Client-side encrypted key (AES-256-GCM, with master password)
//   iv            - Client-side IV
//   keyForServer  - Plaintext key (sent over HTTPS only, never stored)
//                    The server encrypts this with API_KEY_ENCRYPTION_KEY for automation use
//
// Storage:
//   encryptedKey / iv          — Client-side encrypted (for UI viewing/copying)
//   serverEncryptedKey / serverIv — Server-side encrypted (for automated API calls)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, encryptedKey, iv, keyForServer } = body;

    if (!name || !encryptedKey || !iv) {
      return NextResponse.json(
        { error: 'Missing required fields: name, encryptedKey, iv' },
        { status: 400 }
      );
    }

    // Server-side encrypt the plaintext key for automated API calls
    let serverEncryptedKey: string | null = null;
    let serverIv: string | null = null;

    if (keyForServer) {
      const se = encryptApiKey(keyForServer);
      serverEncryptedKey = se.encryptedKey;
      serverIv = se.iv;
    }

    const entry = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        name,
        description: description || null,
        encryptedKey,
        iv,
        serverEncryptedKey,
        serverIv,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error('Failed to create API key:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
