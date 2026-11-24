import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  dbPath: process.env.DATABASE_URL || './data/scheduler.db',
  auth: {
    password: process.env.APP_PASSWORD || '',
    sessionSecret: process.env.SESSION_SECRET || '',
  },
  publicDemo: process.env.PUBLIC_DEMO_MODE === 'true',
  maxDemoEmailsPerRequest: 10,
  maxDemoEmailsPerIpPerHour: 25,
  frontendOrigins: (process.env.FRONTEND_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : parseInt(process.env.SMTP_PORT || '587', 10) === 465,
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASS || '',
  },
  elasticsearchNode: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  maxEmailsPerHour: parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10),
  maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50', 10),
  minDelayBetweenEmailsMs: parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000', 10),
  slack: {
    clientId: process.env.SLACK_CLIENT_ID || '',
    clientSecret: process.env.SLACK_CLIENT_SECRET || '',
    redirectUri: process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/slack/callback',
    webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  }
};

export function assertSafeDemoConfiguration() {
  if (!config.publicDemo) return;

  if (config.nodeEnv === 'production' && config.dbPath !== '/data/scheduler-demo.db') {
    throw new Error('Public demo mode requires DATABASE_URL=/data/scheduler-demo.db on its dedicated Railway volume.');
  }
  if (config.nodeEnv === 'production' && config.auth.password) {
    throw new Error('Do not set APP_PASSWORD when PUBLIC_DEMO_MODE is enabled.');
  }
  if (config.auth.sessionSecret.length < 32) {
    throw new Error('Public demo mode requires a SESSION_SECRET of at least 32 characters.');
  }
  if (config.smtp.user || config.smtp.password) {
    throw new Error('Remove SMTP_USER and SMTP_PASS when PUBLIC_DEMO_MODE is enabled.');
  }
  if (config.slack.webhookUrl || config.slack.clientId || config.slack.clientSecret) {
    throw new Error('Remove Slack credentials when PUBLIC_DEMO_MODE is enabled.');
  }
}
