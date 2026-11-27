import ejs from 'ejs';
import nodemailer from 'nodemailer';
import { fileURLToPath } from 'node:url';

const templatePath = fileURLToPath(
  new URL(
    '../../../../mails/email_order_recovery.html',
    import.meta.url
  )
);

function createTransporter() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    EMAIL_USER,
    EMAIL_PASS
  } = process.env;

  const port = Number(SMTP_PORT || 465);

  if (
    !SMTP_HOST ||
    !EMAIL_USER ||
    !EMAIL_PASS ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error('Invalid recovery SMTP configuration');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    tls: {
      rejectUnauthorized: true
    }
  });
}

export function createOrderRecoveryEmailSender({
  transporterFactory = createTransporter
} = {}) {
  return async function sendOrderRecoveryEmail(recovery) {
    try {
      const {
        orderId,
        recipient,
        language,
        trackingUrl
      } = recovery || {};

      if (
        !Number.isSafeInteger(orderId) ||
        orderId <= 0 ||
        typeof recipient !== 'string' ||
        !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient) ||
        typeof trackingUrl !== 'string'
      ) {
        return { success: false };
      }

      const url = new URL(trackingUrl);
      const frontend = new URL(process.env.URL_FRONTEND || '');

      if (
        url.origin !== frontend.origin ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !['http:', 'https:'].includes(url.protocol) ||
        (
          process.env.NODE_ENV === 'production' &&
          url.protocol !== 'https:'
        )
      ) {
        return { success: false };
      }

      const lang = language === 'es' ? 'es' : 'en';
      const brandName = process.env.STORE_NAME || 'LUJANDEV';
      const supportEmail = process.env.EMAIL_SUPPORT || null;

      const html = await ejs.renderFile(templatePath, {
        language: lang,
        brandName,
        supportEmail,
        orderId,
        trackingUrl
      });

      const subject = lang === 'es'
        ? `Recupera el acceso a tu pedido #${orderId}`
        : `Recover access to your order #${orderId}`;

      const text = lang === 'es'
        ? `Consulta tu pedido #${orderId}: ${trackingUrl}\n\nNo compartas este enlace. Si no lo has solicitado, ignora este correo.`
        : `View your order #${orderId}: ${trackingUrl}\n\nDo not share this link. If you did not request it, ignore this email.`;

      const transporter = transporterFactory();

      const result = await transporter.sendMail({
        from: {
          name: brandName,
          address: process.env.EMAIL_USER
        },
        to: recipient,
        subject,
        html,
        text,
        disableFileAccess: true,
        disableUrlAccess: true
      });

      return {
        success: Array.isArray(result.accepted) &&
          result.accepted.length === 1
      };

    } catch {
      console.error('[OrderRecoveryEmail] Delivery failed');

      return { success: false };
    }
  };
}

export const sendOrderRecoveryEmail =
  createOrderRecoveryEmailSender();
