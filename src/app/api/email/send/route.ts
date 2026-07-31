import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sendEmail, getBrevoConfig } from '@/lib/email';

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

    // Get Brevo config from the integration (API Key Store backed)
    const brevoConfig = await getBrevoConfig(session.user.id);

    let emailOptions: { apiKey?: string; sender?: { email: string; name?: string } } | undefined;

    if (brevoConfig) {
      emailOptions = {
        apiKey: brevoConfig.apiKey,
        sender: sender || brevoConfig.sender,
      };
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
