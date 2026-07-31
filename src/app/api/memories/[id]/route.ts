import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { z } from 'zod';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const updateMemorySchema = z.object({
  key: z.string().min(1, 'key is required').max(500).optional(),
  value: z.string().min(1, 'value is required').optional(),
  category: z.enum(['persona', 'business', 'content', 'general']).nullable().optional(),
});

// ─── Helper: verify ownership ────────────────────────────────────────────────

async function getOwnedMemory(id: string, userId: string) {
  const memory = await prisma.memory.findUnique({ where: { id } });
  if (!memory || memory.userId !== userId) return null;
  return memory;
}

// ─── PATCH /api/memories/[id] ────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const authSession = await auth();
  if (!authSession?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = authSession.user.id;
  const memory = await getOwnedMemory(id, userId);
  if (!memory) {
    return new Response(JSON.stringify({ error: 'Memory not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: { key?: string; value?: string; category?: string | null };
  try {
    const raw = await req.json();
    body = updateMemorySchema.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // If key is being changed, ensure the new key doesn't conflict
  if (body.key !== undefined && body.key !== memory.key) {
    const existing = await prisma.memory.findUnique({
      where: { userId_key: { userId, key: body.key } },
    });
    if (existing) {
      return new Response(
        JSON.stringify({ error: `A memory with key "${body.key}" already exists.` }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }

  const updated = await prisma.memory.update({
    where: { id },
    data: {
      ...(body.key !== undefined && { key: body.key }),
      ...(body.value !== undefined && { value: body.value }),
      ...(body.category !== undefined && { category: body.category }),
    },
  });

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── DELETE /api/memories/[id] ───────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const authSession = await auth();
  if (!authSession?.user?.id) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = authSession.user.id;
  const memory = await getOwnedMemory(id, userId);
  if (!memory) {
    return new Response(JSON.stringify({ error: 'Memory not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await prisma.memory.delete({ where: { id } });

  return new Response(JSON.stringify({ success: true, deletedId: id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
