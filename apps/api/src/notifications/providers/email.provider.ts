import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER, NOTIFICATIONS_DRY_RUN, type EmailProvider } from './provider.tokens';
import { dryRunEmailProvider, realEmailProvider as smtpEmailProvider } from './nodemailer.provider';
import { brevoEmailProvider, resendEmailProvider } from './http-email.provider';

/**
 * Picks the email transport. EMAIL_API = brevo | resend | smtp (default smtp).
 * Use brevo/resend on hosts that block outbound SMTP; they go out on port 443.
 *
 * Matching is case-insensitive with surrounding whitespace ignored, so
 * `Brevo`, `BREVO `, etc. all work. When EMAIL_API is unset and exactly one
 * of BREVO_API_KEY / RESEND_API_KEY is present, that provider is auto-picked
 * so a missing EMAIL_API doesn't silently fall back to SMTP and crash on
 * missing SMTP_* vars.
 */
export const emailProviderFactory = {
  provide: EMAIL_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): EmailProvider => {
    if (isDryRun(config)) {
      return dryRunEmailProvider();
    }
    const raw = config.get<string>('EMAIL_API', '');
    const normalized = (raw ?? '').trim().toLowerCase();
    switch (normalized) {
      case 'brevo':
        return brevoEmailProvider(config);
      case 'resend':
        return resendEmailProvider(config);
      case 'smtp':
      case '':
        break;
      default:
        throw new Error(
          `Unknown EMAIL_API=${JSON.stringify(raw)} — expected one of brevo|resend|smtp.`,
        );
    }
    // EMAIL_API unset (or explicitly smtp): auto-detect an HTTPS provider when
    // its key is the only credential present, otherwise fall through to SMTP
    // (which throws its own missing-var error listing SMTP_*).
    if (!normalized) {
      const hasBrevo = hasValue(config.get<string>('BREVO_API_KEY'));
      const hasResend = hasValue(config.get<string>('RESEND_API_KEY'));
      if (hasBrevo && !hasResend) return brevoEmailProvider(config);
      if (hasResend && !hasBrevo) return resendEmailProvider(config);
    }
    return smtpEmailProvider(config);
  },
};

function isDryRun(config: ConfigService): boolean {
  const raw = config.get<string>(NOTIFICATIONS_DRY_RUN, 'true');
  return (raw ?? 'true').trim().toLowerCase() !== 'false';
}

function hasValue(value: string | undefined): boolean {
  return (value ?? '').trim().length > 0;
}
