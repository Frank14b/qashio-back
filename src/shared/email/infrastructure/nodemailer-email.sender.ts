import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { Transporter } from 'nodemailer';
import {
  EmailSenderPort,
  SendEmailInput,
} from '../domain/ports/email-sender.port';

@Injectable()
export class NodemailerEmailSender implements EmailSenderPort {
  private readonly logger = new Logger(NodemailerEmailSender.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST', 'localhost');
    const port = Number(this.config.get<string>('SMTP_PORT', '587'));
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    this.from = this.config.get<string>('SMTP_FROM', 'noreply@qashio.local');
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass: pass ?? '' } : undefined,
    });
  }

  async send(input: SendEmailInput): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
    } catch (error) {
      const mode = (this.config.get<string>('EMAIL_OTP_MODE', 'fixed') ?? 'fixed').toLowerCase();
      const message = error instanceof Error ? error.message : String(error);
      if (mode === 'fixed') {
        this.logger.warn(
          `SMTP unavailable in fixed OTP mode; email to ${input.to} not delivered (${message}). Body: ${input.text}`,
        );
        return;
      }
      this.logger.error(`Failed to send email to ${input.to}: ${message}`);
      throw error;
    }
  }
}
