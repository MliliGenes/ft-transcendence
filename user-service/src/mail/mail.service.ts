import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import {
  passwordResetEmailTemplate,
  verificationEmailTemplate,
} from './mail.templates.js';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    const host = config.getOrThrow<string>('SMTP_HOST');
    const port = Number(config.getOrThrow<string>('SMTP_PORT'));
    const username = config.getOrThrow<string>('SMTP_USERNAME');
    const password = config.getOrThrow<string>('SMTP_PASSWORD');

    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('SMTP_PORT must be a valid port number');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user: username, pass: password },
    });
    this.from = username;
    this.frontendUrl = config
      .getOrThrow<string>('AUTH_FRONTEND_URL')
      .replace(/\/$/, '');
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Verify your email',
      text: `Verify your email by opening this link: ${link}`,
      html: verificationEmailTemplate(link),
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;

    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'Reset your password',
      text: `Reset your password by opening this link: ${link}`,
      html: passwordResetEmailTemplate(link),
    });
  }
}
