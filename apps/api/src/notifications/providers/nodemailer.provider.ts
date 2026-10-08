// import { promises as dns } from 'node:dns';
// import { Logger } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import nodemailer, { type Transporter } from 'nodemailer';
// import {
//   EMAIL_PROVIDER,
//   NOTIFICATIONS_DRY_RUN,
//   type EmailProvider,
// } from './provider.tokens';

// /**
//  * Email dispatch over plain SMTP (Nodemailer). Works with any SMTP host —
//  * Gmail (app password), Outlook, or a managed relay — instead of a
//  * vendor-specific API, and stays dry-run by default like the SMS provider.
//  *
//  * Required when NOTIFICATIONS_DRY_RUN=false: SMTP_HOST, SMTP_PORT,
//  * SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL. SMTP_FROM_NAME, SMTP_SECURE and
//  * SMTP_FAMILY are optional.
//  */
// const realEmailProvider = (config: ConfigService): EmailProvider => {
//   const host = config.get<string>('SMTP_HOST') as string;
//   const port = Number(config.get<string>('SMTP_PORT') ?? '587');
//   const user = config.get<string>('SMTP_USER') as string;
//   const pass = config.get<string>('SMTP_PASS') as string;
//   const fromEmail = config.get<string>('SMTP_FROM_EMAIL') as string;
//   const fromName = config.get<string>('SMTP_FROM_NAME', 'bsafe');
//   const secure = config.get<string>('SMTP_SECURE', 'false') === 'true';
//   const family = Number(config.get<string>('SMTP_FAMILY', '4'));

//   if (!host || !user || !pass || !fromEmail) {
//     throw new Error(
//       'SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM_EMAIL are required to send ' +
//         'email (or set NOTIFICATIONS_DRY_RUN=true). SMTP_PORT defaults to 587.',
//     );
//   }

//   const logger = new Logger('EmailProvider');
//   const from = `${fromName} <${fromEmail}>`;

//   /**
//    * Nodemailer resolves the hostname itself (IPv4 *and* IPv6, then falls back
//    * to an AAAA address), so its `family` option is ignored and hosts without
//    * IPv6 egress — Render included — die with ENETUNREACH. Resolve an IPv4
//    * address ourselves and connect to that, while passing `servername` so TLS
//    * still sends SNI and validates the certificate against the real hostname.
//    */
//   let transporter: Promise<Transporter> | null = null;
//   const getTransporter = (): Promise<Transporter> => {
//     transporter ??= (async () => {
//       let connectHost = host;
//       if (family === 4) {
//         try {
//           const [address] = await dns.resolve4(host);
//           if (address) connectHost = address;
//         } catch {
//           // No A record — let Nodemailer resolve it as before.
//         }
//       }
//       return nodemailer.createTransport({
//         host: connectHost,  
//         servername: host,
//         port,
//         secure,
//         auth: { user, pass },
//       } as Parameters<typeof nodemailer.createTransport>[0]);
//     })();
//     return transporter;
//   };

//   return {
//     name: 'nodemailer',
//     async sendEmail(to, subject, html) {
//       const info = await (await getTransporter()).sendMail({ from, to, subject, html });
//       logger.log(`email queued: id=${info.messageId} to=${to}`);
//     },
//   };
// };

// const dryRunEmailProvider = (): EmailProvider => {
//   const logger = new Logger('EmailProvider(dry-run)');
//   return {
//     name: 'nodemailer-dry-run',
//     async sendEmail(to, subject) {
//       logger.log(`[dry-run] would email ${to} (subject: ${subject})`);
//     },
//   };
// };

// export const emailProviderFactory = {
//   provide: EMAIL_PROVIDER,
//   inject: [ConfigService],
//   useFactory: (config: ConfigService): EmailProvider =>
//     config.get<string>(NOTIFICATIONS_DRY_RUN, 'true') === 'true'
//       ? dryRunEmailProvider()
//       : realEmailProvider(config),
// };


import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

import {
  EMAIL_PROVIDER,
  NOTIFICATIONS_DRY_RUN,
  type EmailProvider,
} from './provider.tokens';

/**
 * Email dispatch over SMTP using Nodemailer.
 *
 * Required when NOTIFICATIONS_DRY_RUN=false:
 * SMTP_HOST
 * SMTP_PORT
 * SMTP_USER
 * SMTP_PASS
 * SMTP_FROM_EMAIL
 *
 * Optional:
 * SMTP_FROM_NAME
 * SMTP_SECURE
 */
const realEmailProvider = (config: ConfigService): EmailProvider => {
  const host = config.get<string>('SMTP_HOST');
  const port = Number(config.get<string>('SMTP_PORT') ?? '587');
  const user = config.get<string>('SMTP_USER');
  const pass = config.get<string>('SMTP_PASS');
  const fromEmail = config.get<string>('SMTP_FROM_EMAIL');
  const fromName = config.get<string>('SMTP_FROM_NAME', 'bsafe');
  const secure = config.get<string>('SMTP_SECURE', 'false') === 'true';

  if (!host || !user || !pass || !fromEmail) {
    throw new Error(
      'SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM_EMAIL are required ' +
        'to send email (or set NOTIFICATIONS_DRY_RUN=true).',
    );
  }

  const logger = new Logger('EmailProvider');
  const from = `${fromName} <${fromEmail}>`;

  let transporter: Transporter | null = null;

  const getTransporter = (): Transporter => {
    if (!transporter) {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure,

        auth: {
          user,
          pass,
        },

        // Timeouts prevent a notification worker from hanging forever.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,

        // Useful for debugging SMTP problems.
        logger: false,
      });
    }

    return transporter;
  };

  return {
    name: 'nodemailer',

    async sendEmail(to, subject, html) {
      const transport = getTransporter();

      const info = await transport.sendMail({
        from,
        to,
        subject,
        html,
      });

      logger.log(`email sent: id=${info.messageId} to=${to}`);
    },
  };
};

const dryRunEmailProvider = (): EmailProvider => {
  const logger = new Logger('EmailProvider(dry-run)');

  return {
    name: 'nodemailer-dry-run',

    async sendEmail(to, subject) {
      logger.log(
        `[dry-run] would email ${to} (subject: ${subject})`,
      );
    },
  };
};

export const emailProviderFactory = {
  provide: EMAIL_PROVIDER,

  inject: [ConfigService],

  useFactory: (config: ConfigService): EmailProvider => {
    const dryRun =
      config.get<string>(NOTIFICATIONS_DRY_RUN, 'true') === 'true';

    return dryRun
      ? dryRunEmailProvider()
      : realEmailProvider(config);
  },
};