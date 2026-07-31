import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const smartLists = await prisma.smartList.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(smartLists);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, icon, filters } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!filters || typeof filters !== 'object') {
      return NextResponse.json({ error: 'Filters object is required' }, { status: 400 });
    }

    const smartList = await prisma.smartList.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        icon: icon || null,
        filters: JSON.stringify(filters),
      },
    });

    return NextResponse.json(smartList, { status: 201 });
  } catch (error) {
    console.error('Create smart list error:', error);
    return NextResponse.json(
      { error: 'Failed to create smart list' },
      { status: 500 }
    );
  }
}
