import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

async function findOwnedEvent(id: string, userId: string) {
  const event = await prisma.calendarEvent.findUnique({ where: { id } });
  if (!event || event.userId !== userId) return null;
  return event;
}

// PATCH /api/calendar-events/[id] — update an event
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = await findOwnedEvent(id, session.user.id);
  if (!event) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const { title, description, start, end, allDay, color } = await request.json();

    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(start !== undefined ? { start: new Date(start) } : {}),
        ...(end !== undefined ? { end: end ? new Date(end) : null } : {}),
        ...(allDay !== undefined ? { allDay } : {}),
        ...(color !== undefined ? { color } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update calendar event error:', error);
    return NextResponse.json(
      { error: 'Failed to update calendar event' },
      { status: 500 }
    );
  }
}

// DELETE /api/calendar-events/[id] — delete an event
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const event = await findOwnedEvent(id, session.user.id);
  if (!event) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.calendarEvent.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
