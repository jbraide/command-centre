/**
 * Email sending via Brevo.
 * Config comes from the Brevo service integration (API Key Store backed),
 * falling back to BREVO_API_KEY env var.
 */

import { prisma } from '@/lib/db';

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const DEFAULT_SENDER = {
  email: 'command-center@yourdomain.com',
  name: 'Command Center',
};

export interface SendEmailParams {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  sender?: { email: string; name?: string };
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface BrevoConfig {
  apiKey: string;
  sender?: { email: string; name?: string };
}

/**
 * Fetch the Brevo config for a user from the integration settings.
 * Returns { apiKey, sender } or null if not configured.
 */
export async function getBrevoConfig(userId: string): Promise<BrevoConfig | null> {
  try {
    const integration = await prisma.serviceIntegration.findUnique({
      where: { userId_service: { userId, service: 'brevo' } },
    });

    if (integration?.enabled && integration.config) {
      const config = JSON.parse(integration.config);

      // API key from the API Key Store (server-side encrypted)
      if (config.apiKeyId) {
        const apiKeyRecord = await prisma.apiKey.findUnique({
          where: { id: config.apiKeyId },
        });
        if (apiKeyRecord && apiKeyRecord.serverEncryptedKey && apiKeyRecord.serverIv) {
          const { decryptApiKey } = await import('@/lib/api-key-crypto');
          const apiKey = decryptApiKey(apiKeyRecord.serverEncryptedKey, apiKeyRecord.serverIv);
          return {
            apiKey,
            sender: config.senderEmail
              ? { email: config.senderEmail, name: config.senderName || undefined }
              : undefined,
          };
        }
      }
    }
  } catch {
    // Fall through to env fallback
  }

  if (process.env.BREVO_API_KEY) {
    return {
      apiKey: process.env.BREVO_API_KEY,
      sender: process.env.BREVO_SENDER_EMAIL
        ? { email: process.env.BREVO_SENDER_EMAIL, name: process.env.BREVO_SENDER_NAME }
        : undefined,
    };
  }

  return null;
}

export async function sendEmail(
  params: SendEmailParams,
  options?: { apiKey?: string; sender?: { email: string; name?: string } }
): Promise<SendEmailResult> {
  const apiKey = options?.apiKey ?? process.env.BREVO_API_KEY;

  if (!apiKey) {
    return { success: false, error: 'Brevo API key is not configured' };
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        sender: options?.sender ?? params.sender ?? DEFAULT_SENDER,
        to: params.to,
        subject: params.subject,
        htmlContent: params.htmlContent,
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: body.message ?? `Brevo API returned status ${response.status}`,
      };
    }

    return {
      success: true,
      messageId: body.messageId,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error sending email',
    };
  }
}
