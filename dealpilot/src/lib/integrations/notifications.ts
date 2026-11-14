import nodemailer from "nodemailer";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<void>;
}

/**
 * SMTP works with any transactional email service (Postmark, SES, Resend, SendGrid all offer SMTP)
 * and with Mailpit locally. Configure with SMTP_URL, e.g. smtps://user:pass@smtp.example.com:465.
 */
export function smtpEmailProvider(url: string, from: string): EmailProvider {
  const transport = nodemailer.createTransport(url);
  return {
    name: `smtp:${new URL(url).hostname}`,
    async send(msg) {
      await transport.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text });
    },
  };
}

/** No email configured: in-app notifications only. */
export const noEmailProvider: EmailProvider = {
  name: "none",
  async send() {
    throw new Error("Email is not configured");
  },
};
