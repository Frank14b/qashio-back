export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export interface EmailSenderPort {
  send(input: SendEmailInput): Promise<void>;
}
