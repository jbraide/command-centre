const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const DEFAULT_SENDER = {
  email: "command-center@yourdomain.com",
  name: "Command Center",
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

export async function sendEmail(
  params: SendEmailParams,
  options?: { apiKey?: string; sender?: { email: string; name?: string } }
): Promise<SendEmailResult> {
  const apiKey = options?.apiKey ?? process.env.BREVO_API_KEY;

  if (!apiKey) {
    return { success: false, error: "Brevo API key is not configured" };
  }

  try {
    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        Accept: "application/json",
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
      error: err instanceof Error ? err.message : "Unknown error sending email",
    };
  }
}
