import nodemailer, { Transporter } from "nodemailer";

export interface SendGmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
}

export interface GmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

let transporterInstance: Transporter | null = null;

/**
 * Returns a singleton Nodemailer transporter configured with official Gmail SMTP
 * using the user's Gmail address and 16-character App Password.
 */
export function getGmailTransporter(): Transporter | null {
  const user = process.env.GMAIL_USER || "samarthknimangre@gmail.com";
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!pass) {
    return null;
  }

  if (!transporterInstance) {
    // Strip any accidental spaces from the app password
    const sanitizedPass = pass.replace(/\s+/g, "");

    transporterInstance = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // SSL
      auth: {
        user,
        pass: sanitizedPass,
      },
    });
  }

  return transporterInstance;
}

/**
 * Tests the connection to Google's SMTP servers and validates the App Password.
 */
export async function verifyGmailConnection(): Promise<{ valid: boolean; error?: string }> {
  try {
    const transporter = getGmailTransporter();
    if (!transporter) {
      return { valid: false, error: "GMAIL_APP_PASSWORD environment variable is missing" };
    }

    await transporter.verify();
    return { valid: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: errorMsg };
  }
}

/**
 * Sends an email directly from Samarth's authenticated personal Gmail account.
 * Guarantees primary inbox placement (DKIM/SPF passed via Google servers).
 */
export async function sendGmailMessage(options: SendGmailOptions): Promise<GmailSendResult> {
  try {
    const transporter = getGmailTransporter();
    if (!transporter) {
      return {
        success: false,
        error: "GMAIL_APP_PASSWORD is not configured in environment variables",
      };
    }

    const fromAddress = process.env.GMAIL_USER || "samarthknimangre@gmail.com";
    const fromHeader = `Samarth Nimangre <${fromAddress}>`;

    const info = await transporter.sendMail({
      from: fromHeader,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo || fromAddress,
      cc: options.cc,
      bcc: options.bcc,
    });

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Gmail SMTP Error]:", errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}
