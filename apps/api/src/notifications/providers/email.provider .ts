import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER, NOTIFICATIONS_DRY_RUN, type EmailProvider } from './provider.tokens';
import { dryRunEmailProvider, realEmailProvider as smtpEmailProvider } from './nodemailer.provider';
import { brevoEmailProvider, resendEmailProvider } from './http-email.provider';

/**
 * Picks the email transport. EMAIL_API = brevo | resend | smtp (default smtp).
 * Use brevo/resend on hosts that block outbound SMTP; they go out on port 443.
 */
export const emailProviderFactory = {
  provide: EMAIL_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): EmailProvider => {
    if (config.get<string>(NOTIFICATIONS_DRY_RUN, 'true') === 'true') {
      return dryRunEmailProvider();
    }
    switch (config.get<string>('EMAIL_API', 'smtp')) {
      case 'brevo':
        return brevoEmailProvider(config);
      case 'resend':
        return resendEmailProvider(config);
      default:
        return smtpEmailProvider(config);
    }
  },
};
