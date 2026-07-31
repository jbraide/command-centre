import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { to, subject, htmlContent, sender } = await req.json();

    if (!to || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json(
        { error: 'Recipient(s) are required' },
        { status: 400 }
      );
    }

    if (!subject || !htmlContent) {
      return NextResponse.json(
        { error: 'Subject and htmlContent are required' },
        { status: 400 }
      );
    }

    // Try to get Brevo config from database (user-configured in Settings)
    const brevoConfig = await prisma.serviceIntegration.findUnique({
      where: { userId_service: { userId: session.user.id, service: 'brevo' } },
    });

    let emailOptions: { apiKey?: string; sender?: { email: string; name?: string } } | undefined;

    if (brevoConfig?.enabled) {
      try {
        const config = JSON.parse(brevoConfig.config);
        emailOptions = {
          apiKey: config.apiKey,
          sender: sender || (config.senderEmail ? { email: config.senderEmail, name: config.senderName } : undefined),
        };
      } catch {
        // malformed config — fall through to env var
      }
    }

    const result = await sendEmail(
      { to, subject, htmlContent, sender: sender || emailOptions?.sender },
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
    console.error('Email send error:', error);
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}
