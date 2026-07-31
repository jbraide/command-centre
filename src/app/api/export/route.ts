import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/export — download all user data as JSON
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;

  const [
    projects,
    savedTranscriptions,
    scripts,
    keyPrinciples,
    scriptStyles,
    serviceIntegrations,
  ] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      include: {
        tasks: true,
        notes: true,
        links: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.savedTranscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.script.findMany({
      where: { userId },
      include: { style: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.keyPrinciple.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.scriptStyle.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.serviceIntegration.findMany({
      where: { userId },
      select: {
        id: true,
        service: true,
        label: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
    projects,
    savedTranscriptions,
    scripts,
    keyPrinciples,
    scriptStyles,
    serviceIntegrations,
  };

  const date = new Date().toISOString().split('T')[0];
  const filename = `command-center-export-${date}.json`;

  const json = JSON.stringify(exportData, null, 2);

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
