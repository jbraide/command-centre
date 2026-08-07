import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/calendar-events?from=...&to=... — list events in a date range
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');

    const events = await prisma.calendarEvent.findMany({
      where: {
        userId: session.user.id,
        ...(from || to
          ? {
              start: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { start: 'asc' },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('List calendar events error:', error);
    return NextResponse.json(
      { error: 'Failed to load calendar events' },
      { status: 500 }
    );
  }
}

// POST /api/calendar-events — create an event
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { title, description, start, end, allDay, color } =
      await request.json();

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!start) {
      return NextResponse.json({ error: 'Start time is required' }, { status: 400 });
    }

    const event = await prisma.calendarEvent.create({
      data: {
        userId: session.user.id,
        title: title.trim(),
        description: description || null,
        start: new Date(start),
        end: end ? new Date(end) : null,
        allDay: allDay ?? false,
        color: color || undefined,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error('Create calendar event error:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}
