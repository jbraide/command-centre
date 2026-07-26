import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const SENSITIVE_FIELDS = /key|secret|password|token/i;

function maskSensitiveConfig(configJson: string): Record<string, unknown> {
  try {
    const config = JSON.parse(configJson);
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' && SENSITIVE_FIELDS.test(key)) {
        masked[key] = '••••••••';
      } else {
        masked[key] = value;
      }
    }
    return masked;
  } catch {
    return {};
  }
}

// GET /api/services — list all service integrations (config keys masked)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const integrations = await prisma.serviceIntegration.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  const result = integrations.map(({ id, service, label, config, enabled, createdAt }) => ({
    id,
    service,
    label,
    enabled,
    createdAt,
    config: maskSensitiveConfig(config),
  }));

  return NextResponse.json(result);
}

// POST /api/services — create or update a service integration (upsert)
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { service, label, config, enabled } = body;

    if (!service || typeof service !== 'string' || service.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: service' },
        { status: 400 }
      );
    }

    if (!label || typeof label !== 'string' || label.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: label' },
        { status: 400 }
      );
    }

    if (!config || typeof config !== 'object') {
      return NextResponse.json(
        { error: 'Missing required field: config' },
        { status: 400 }
      );
    }

    const integration = await prisma.serviceIntegration.upsert({
      where: {
        userId_service: {
          userId: session.user.id,
          service: service.trim(),
        },
      },
      update: {
        label: label.trim(),
        config: JSON.stringify(config),
        ...(typeof enabled === 'boolean' ? { enabled } : {}),
      },
      create: {
        userId: session.user.id,
        service: service.trim(),
        label: label.trim(),
        config: JSON.stringify(config),
        enabled: typeof enabled === 'boolean' ? enabled : true,
      },
    });

    return NextResponse.json(integration, { status: 201 });
  } catch (error) {
    console.error('Failed to upsert service integration:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
