import nodemailer from 'nodemailer';

let testAccount: nodemailer.TestAccount | null = null;
let transporter: nodemailer.Transporter | null = null;

export async function getEmailTransporter(): Promise<nodemailer.Transporter> {
  if (transporter) {
    return transporter;
  }

  try {
    testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log(`🚀 Ethereal SMTP Initialized. User: ${testAccount.user}`);
    return transporter;
  } catch (error) {
    console.error('Failed to create Ethereal test account:', error);
    // Fallback pseudo transporter for resilience
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: 'mock@ethereal.email', pass: 'mock' },
    });
    return transporter;
  }
}

export async function sendEmailViaEthereal(options: {
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const mailer = await getEmailTransporter();
  const info = await mailer.sendMail({
    from: `"${options.from.split('@')[0]}" <${options.from}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.html.replace(/<[^>]*>?/gm, ''),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  return {
    messageId: info.messageId,
    previewUrl: previewUrl || `https://ethereal.email/message/${info.messageId}`,
  };
}
