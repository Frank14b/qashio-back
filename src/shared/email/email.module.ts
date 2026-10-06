import { Global, Module } from '@nestjs/common';
import { EMAIL_SENDER } from './domain/ports/email-sender.port';
import { NodemailerEmailSender } from './infrastructure/nodemailer-email.sender';

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_SENDER,
      useClass: NodemailerEmailSender,
    },
  ],
  exports: [EMAIL_SENDER],
})
export class EmailModule {}
