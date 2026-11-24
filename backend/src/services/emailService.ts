import nodemailer from 'nodemailer';
import { config } from '../config';

let transporter: nodemailer.Transporter | null = null;

export async function getEmailTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) {
    return transporter;
  }

  if (config.smtp.user || config.smtp.password) {
    if (!config.smtp.user || !config.smtp.password) {
      throw new Error('Both SMTP_USER and SMTP_PASS must be configured.');
    }

    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password,
      },
    });
    return transporter;
  }

  const testAccount = await nodemailer.createTestAccount();
  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  console.log('Ethereal SMTP test account initialized.');
  return transporter;
}

export async function sendEmail(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  if (config.publicDemo) {
    return {
      messageId: `demo-${Date.now()}`,
      previewUrl: '',
    };
  }

  const mailer = await getEmailTransporter();
  const info = await mailer.sendMail({
    from: `"${options.from.split('@')[0]}" <${options.from}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.html.replace(/<[^>]*>?/gm, ''),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info) || '';
  return {
    messageId: info.messageId,
    previewUrl,
  };
}
