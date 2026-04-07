// src/services/auth/infrastructure/services/email.service.ts
import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '@shared/config';
import { createLogger } from '@infrastructure/logger';

const log = createLogger('EmailService');

export interface IEmailService {
  sendVerificationEmail(to: string, token: string, name: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string, name: string): Promise<void>;
  sendWelcomeEmail(to: string, name: string): Promise<void>;
}

// ─── Email Templates ──────────────────────────────────────────────────────────
const templates = {
  verifyEmail: (name: string, link: string) => ({
    subject: 'Verify your FinTrack email',
    html: `
      <h2>Hello, ${name}!</h2>
      <p>Please verify your email address by clicking the link below:</p>
      <a href="${link}" style="background:#4F46E5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">
        Verify Email
      </a>
      <p>This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
    `,
  }),

  passwordReset: (name: string, link: string) => ({
    subject: 'Reset your FinTrack password',
    html: `
      <h2>Hello, ${name}!</h2>
      <p>You requested a password reset. Click below to set a new password:</p>
      <a href="${link}" style="background:#DC2626;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none">
        Reset Password
      </a>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `,
  }),

  welcome: (name: string) => ({
    subject: 'Welcome to FinTrack 🎉',
    html: `
      <h2>Welcome aboard, ${name}!</h2>
      <p>Your account is ready. Start tracking your finances today.</p>
    `,
  }),
};

// ─── Nodemailer Implementation ────────────────────────────────────────────────
export class EmailService implements IEmailService {
  private transporter: Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth:
        config.SMTP_USER
          ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
          : undefined,
    });
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: config.SMTP_FROM,
        to,
        subject,
        html,
      });
      log.info({ to, subject }, 'Email sent');
    } catch (err) {
      log.error({ to, subject, err }, 'Failed to send email');
      // Don't throw — email failures must not break the main flow.
      // The job queue will retry via BullMQ.
    }
  }

  async sendVerificationEmail(to: string, token: string, name: string): Promise<void> {
    const link = `${config.APP_URL}/api/v1/auth/verify-email?token=${token}`;
    const { subject, html } = templates.verifyEmail(name, link);
    await this.send(to, subject, html);
  }

  async sendPasswordResetEmail(to: string, token: string, name: string): Promise<void> {
    const link = `${config.APP_URL}/api/v1/auth/reset-password?token=${token}`;
    const { subject, html } = templates.passwordReset(name, link);
    await this.send(to, subject, html);
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const { subject, html } = templates.welcome(name);
    await this.send(to, subject, html);
  }
}

export const emailService = new EmailService();
