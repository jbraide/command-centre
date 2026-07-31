import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/services/[id] — get a single service integration with full (unmasked) config
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const integration = await prisma.serviceIntegration.findUnique({
    where: { id },
  });

  if (!integration || integration.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let parsedConfig: Record<string, unknown> = {};
  try {
    parsedConfig = JSON.parse(integration.config);
  } catch {
    // config is malformed — still return the raw string so the caller can decide
  }

  return NextResponse.json({
    id: integration.id,
    service: integration.service,
    label: integration.label,
    enabled: integration.enabled,
    config: parsedConfig,
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  });
}

// DELETE /api/services/[id] — delete a service integration
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const integration = await prisma.serviceIntegration.findUnique({
    where: { id },
  });

  if (!integration || integration.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.serviceIntegration.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

// PATCH /api/services/[id] — update a service integration (toggle enabled, update config)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const integration = await prisma.serviceIntegration.findUnique({
    where: { id },
  });

  if (!integration || integration.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (typeof body.enabled === 'boolean') {
      updateData.enabled = body.enabled;
    }

    if (body.label) {
      updateData.label = body.label;
    }

    if (body.config && typeof body.config === 'object') {
      updateData.config = JSON.stringify(body.config);
    }

    const updated = await prisma.serviceIntegration.update({
      where: { id },
      data: updateData,
    });

    let parsedConfig: Record<string, unknown> = {};
    try {
      parsedConfig = JSON.parse(updated.config);
    } catch {}

    return NextResponse.json({
      id: updated.id,
      service: updated.service,
      label: updated.label,
      enabled: updated.enabled,
      config: parsedConfig,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (error) {
    console.error('PATCH service error:', error);
    return NextResponse.json(
      { error: 'Failed to update service' },
      { status: 500 }
    );
  }
}
