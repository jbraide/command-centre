import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

// POST /api/export/send — email all user data as JSON
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let recipientEmail = session.user.email;
  let recipientName = session.user.name || undefined;

  // Allow specifying a custom recipient email
  try {
    const body = await req.json();
    if (body.email && typeof body.email === 'string' && body.email.includes('@')) {
      recipientEmail = body.email;
      recipientName = undefined;
    }
  } catch {
    // No body or invalid JSON — use session email
  }

  if (!recipientEmail) {
    return NextResponse.json(
      { error: 'No recipient email available. Provide one in the request body.' },
      { status: 400 }
    );
  }

  const userId = session.user.id;

  try {
    const [
      projects,
      savedTranscriptions,
      scripts,
      keyPrinciples,
      scriptStyles,
      passwordEntries,
      apiKeys,
      serviceIntegrations,
    ] = await Promise.all([
      prisma.project.findMany({
        where: { userId },
        include: { tasks: true, notes: true, links: true },
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
      prisma.passwordEntry.findMany({
        where: { userId },
        select: {
          id: true,
          website: true,
          username: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.apiKey.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
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
      passwordEntries,
      apiKeys,
      serviceIntegrations,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    const escapedJson = jsonString
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Fetch the user's Brevo config
    const brevoConfig = await prisma.serviceIntegration.findUnique({
      where: { userId_service: { userId, service: 'brevo' } },
    });

    if (!brevoConfig?.enabled) {
      return NextResponse.json(
        { error: 'Brevo is not configured or disabled. Please configure it in Settings > Integrations.' },
        { status: 400 }
      );
    }

    let emailOptions: { apiKey?: string; sender?: { email: string; name?: string } } | undefined;

    try {
      const config = JSON.parse(brevoConfig.config);
      emailOptions = {
        // sendEmail() will fall back to BREVO_API_KEY env var if apiKey is not set here
        apiKey: config.apiKey,
        sender: config.senderEmail
          ? { email: config.senderEmail, name: config.senderName || 'Command Center' }
          : undefined,
      };
    } catch {
      // malformed config — let sendEmail use env var fallback
    }

    const result = await sendEmail(
      {
        to: [{ email: recipientEmail, name: recipientName }],
        subject: 'Your Command Center Data Export',
        htmlContent: `
          <div style="font-family: system-ui, sans-serif; max-width: 640px; margin: 0 auto;">
            <h2 style="color: #7fd858;">📦 Command Center Export</h2>
            <p style="color: #ccc;">
              Here is your requested data export from <strong>Command Center</strong>.
              The full JSON is included below.
            </p>
            <hr style="border: none; border-top: 1px solid #333;" />
            <pre style="
              background: #1a1a1a;
              color: #e0e0e0;
              padding: 16px;
              border-radius: 4px;
              font-size: 12px;
              line-height: 1.5;
              overflow-x: auto;
              white-space: pre-wrap;
              word-break: break-word;
              max-height: 480px;
              overflow-y: auto;
            ">${escapedJson}</pre>
            <hr style="border: none; border-top: 1px solid #333;" />
            <p style="color: #888; font-size: 12px;">
              Exported at ${new Date().toLocaleString()}
            </p>
          </div>
        `,
      },
      emailOptions
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    return NextResponse.json({ messageId: result.messageId });
  } catch (error) {
    console.error('Export send error:', error);
    return NextResponse.json(
      { error: 'Failed to send export' },
      { status: 500 }
    );
  }
}
