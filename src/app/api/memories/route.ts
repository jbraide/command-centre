import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createMemorySchema = z.object({
  key: z.string().min(1, 'key is required').max(500),
  value: z.string().min(1, 'value is required'),
  category: z.enum(['persona', 'business', 'content', 'general']).optional(),
});

// ─── GET /api/memories ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authSession = await auth();
  if (!authSession?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = authSession.user.id;
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');

  const where: Record<string, unknown> = { userId };
  if (category) where.category = category;

  const [memories, total] = await Promise.all([
    prisma.memory.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.memory.count({ where }),
  ]);

  return new Response(JSON.stringify({ memories, total }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── POST /api/memories ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const authSession = await auth();
  if (!authSession?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = authSession.user.id;

  let body: { key: string; value: string; category?: string };
  try {
    const raw = await req.json();
    body = createMemorySchema.parse(raw);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request. key and value are required.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const memory = await prisma.memory.upsert({
    where: { userId_key: { userId, key: body.key } },
    update: { value: body.value, category: body.category ?? null },
    create: {
      userId,
      key: body.key,
      value: body.value,
      category: body.category ?? null,
    },
  });

  return new Response(JSON.stringify(memory), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
