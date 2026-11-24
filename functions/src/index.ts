import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import MiniSearch from 'minisearch';
import nodemailer from 'nodemailer';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Query } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { onTaskDispatched } from 'firebase-functions/v2/tasks';
import { setGlobalOptions } from 'firebase-functions/v2';
import { createHash, randomUUID } from 'node:crypto';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

if (getApps().length === 0) {
  initializeApp({ credential: applicationDefault() });
}

const firestore = getFirestore();
const emailCollection = firestore.collection('emails');
const smtpUser = defineSecret('SMTP_USER');
const smtpPassword = defineSecret('SMTP_PASS');
const upload = multer({ storage: multer.memoryStorage() });
const oneHourMs = 60 * 60 * 1000;
const maxTaskDelaySeconds = 30 * 24 * 60 * 60;

function getRateReservationRef(sender: string) {
  const senderKey = createHash('sha256').update(sender.toLowerCase()).digest('hex');
  return firestore.collection('rate_limit_reservations').doc(senderKey);
}

interface EmailRecord {
  id: string;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  scheduled_at: number;
  sent_at?: number | null;
  status: 'scheduled' | 'sent' | 'failed' | 'rescheduled' | 'sending';
  task_enqueued?: boolean;
  task_enqueue_claim_until?: number;
  sending_at?: number;
  job_id?: string;
  preview_url?: string | null;
  error_message?: string | null;
  created_at: number;
  updated_at: number;
}

function configNumber(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeConfigNumber(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const maxEmailsPerHour = configNumber('MAX_EMAILS_PER_HOUR', 200);
const maxEmailsPerHourPerSender = configNumber('MAX_EMAILS_PER_HOUR_PER_SENDER', 50);
const minDelayBetweenEmailsMs = nonNegativeConfigNumber('MIN_DELAY_BETWEEN_EMAILS_MS', 2000);

function normalizeEmailRecord(data: FirebaseFirestore.DocumentData): EmailRecord {
  return { ...data, id: data.id || '' } as EmailRecord;
}

async function enqueueEmail(emailId: string, scheduledAt: number): Promise<void> {
  const delaySeconds = Math.min(
    maxTaskDelaySeconds,
    Math.max(0, Math.ceil((scheduledAt - Date.now()) / 1000)),
  );
  const { getFunctions } = await import('firebase-admin/functions');
  await getFunctions().taskQueue('sendScheduledEmail').enqueue(
    { emailId },
    delaySeconds > 0 ? { scheduleDelaySeconds: delaySeconds } : {},
  );
}

async function recoverPendingEmailTasks(): Promise<void> {
  const pending = await emailCollection
    .where('task_enqueued', '==', false)
    .where('status', 'in', ['scheduled', 'rescheduled'])
    .orderBy('scheduled_at', 'asc')
    .limit(100)
    .get();

  for (const document of pending.docs) {
    const emailRef = document.ref;
    const email = await firestore.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(emailRef);
      if (!currentSnapshot.exists) return null;
      const current = normalizeEmailRecord(currentSnapshot.data()!);
      const claimUntil = current.task_enqueue_claim_until || 0;
      if (
        current.task_enqueued ||
        (current.status !== 'scheduled' && current.status !== 'rescheduled') ||
        claimUntil > Date.now()
      ) {
        return null;
      }

      transaction.update(emailRef, { task_enqueue_claim_until: Date.now() + 60_000 });
      return current;
    });

    if (!email) continue;

    try {
      await enqueueEmail(email.id, email.scheduled_at);
      await emailRef.update({ task_enqueued: true, task_enqueue_claim_until: 0 });
    } catch (error) {
      await emailRef.update({ task_enqueue_claim_until: 0 });
      throw error;
    }
  }
}

async function verifyUser(req: Request, res: Response, next: NextFunction) {
  const authorization = req.header('authorization') || '';
  const match = authorization.match(/^Bearer (.+)$/i);
  if (!match) {
    res.status(401).json({ success: false, error: 'Sign in is required.' });
    return;
  }

  try {
    const token = await getAuth().verifyIdToken(match[1]);
    const allowedEmails = (process.env.ALLOWED_EMAILS || '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    if (
      !token.email ||
      !token.email_verified ||
      !allowedEmails.includes(token.email.toLowerCase())
    ) {
      res.status(403).json({ success: false, error: 'This Google account is not authorized.' });
      return;
    }

    next();
  } catch (error) {
    console.error('Firebase ID token verification failed:', error);
    res.status(401).json({ success: false, error: 'Your sign-in has expired. Please sign in again.' });
  }
}

async function ensureDefaultSenders(): Promise<void> {
  const senders = [
    { id: 'sender-1', email: 'alex.outreach@reachinbox.ai', display_name: 'Alex Rivera (Growth)' },
    { id: 'sender-2', email: 'sarah.sales@reachinbox.ai', display_name: 'Sarah Jenkins (Partnerships)' },
    { id: 'sender-3', email: 'founder@reachinbox.ai', display_name: 'ReachInbox Executive Desk' },
  ];
  const snapshot = await firestore.collection('senders').limit(1).get();
  if (!snapshot.empty) return;

  const batch = firestore.batch();
  for (const sender of senders) {
    batch.set(firestore.collection('senders').doc(sender.id), {
      ...sender,
      created_at: Date.now(),
    });
  }
  await batch.commit();
}

async function findEmails(status?: string, searchQuery = ''): Promise<EmailRecord[]> {
  let query: Query = emailCollection;
  if (status === 'scheduled') {
    query = query.where('status', 'in', ['scheduled', 'rescheduled']);
  } else if (status) {
    query = query.where('status', '==', status);
  }

  if (!searchQuery.trim()) {
    const snapshot = await query.orderBy('scheduled_at', 'desc').limit(100).get();
    return snapshot.docs.map((document) => normalizeEmailRecord(document.data()));
  }

  const snapshot = await query.get();
  const documents = snapshot.docs.map((document) => normalizeEmailRecord(document.data()));
  const search = new MiniSearch<EmailRecord>({
    fields: ['recipient', 'sender', 'subject', 'body', 'status'],
    storeFields: ['id', 'recipient', 'sender', 'subject', 'body', 'status', 'scheduled_at', 'sent_at', 'preview_url'],
    searchOptions: { boost: { subject: 2, recipient: 1.5 }, fuzzy: 0.2, prefix: true },
  });
  if (documents.length) search.addAll(documents);
  return search.search(searchQuery).map((result) => result as unknown as EmailRecord);
}

async function sendSlackRateLimitAlert(
  sender: string,
  hourlyCount: number,
  limit: number,
  nextAvailableTime: Date,
): Promise<void> {
  const configSnapshot = await firestore.collection('settings').doc('slack').get();
  const webhook = configSnapshot.get('webhook_url') as string | undefined;
  if (!webhook) return;

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Rate limit exceeded for sender ${sender}: ${hourlyCount}/${limit}. Deferred until ${nextAvailableTime.toISOString()}.`,
      }),
    });
    if (!response.ok) {
      console.error(`Slack webhook returned HTTP ${response.status}`);
    }
  } catch (error) {
    console.error('Slack rate-limit alert failed:', error);
  }
}

async function deliverEmail(email: EmailRecord): Promise<{ previewUrl: string }> {
  const user = smtpUser.value();
  const password = smtpPassword.value();
  if (!user || !password) {
    throw new Error('SMTP_USER and SMTP_PASS must be configured before email delivery is enabled.');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: configNumber('SMTP_PORT', 587),
    secure: configNumber('SMTP_PORT', 587) === 465,
    auth: { user, pass: password },
  });
  const info = await transporter.sendMail({
    from: email.sender,
    to: email.recipient,
    subject: email.subject,
    html: email.body,
    text: email.body.replace(/<[^>]*>?/gm, ''),
  });
  return {
    previewUrl: nodemailer.getTestMessageUrl(info) || '',
  };
}

async function finalizeDelivery(
  emailId: string,
  sender: string,
  emailUpdate: Record<string, unknown>,
): Promise<void> {
  const emailRef = emailCollection.doc(emailId);
  const reservationRef = getRateReservationRef(sender);
  await firestore.runTransaction(async (transaction) => {
    const [emailSnapshot, reservationSnapshot] = await Promise.all([
      transaction.get(emailRef),
      transaction.get(reservationRef),
    ]);
    if (!emailSnapshot.exists || emailSnapshot.get('status') !== 'sending') return;

    const reservations = {
      ...((reservationSnapshot.get('reservations') || {}) as Record<string, number>),
    };
    delete reservations[emailId];
    transaction.update(emailRef, emailUpdate);
    transaction.set(reservationRef, {
      reservations,
      updated_at: Date.now(),
    }, { merge: true });
  });
}

async function dispatchEmail(emailId: string): Promise<void> {
  const emailRef = emailCollection.doc(emailId);
  const emailSnapshot = await emailRef.get();
  if (!emailSnapshot.exists) return;

  const email = normalizeEmailRecord(emailSnapshot.data()!);
  if (
    email.status !== 'scheduled' &&
    email.status !== 'rescheduled' &&
    email.status !== 'sending'
  ) return;

  const remainingMs = email.scheduled_at - Date.now();
  if (email.status !== 'sending' && remainingMs > 0) {
    await enqueueEmail(emailId, email.scheduled_at);
    return;
  }

  let result:
    | { state: 'claimed'; email: EmailRecord }
    | { state: 'rescheduled'; nextAt: number; count: number }
    | { state: 'in_progress'; retryAt: number }
    | { state: 'skipped' };

  result = await firestore.runTransaction(async (transaction) => {
    const currentSnapshot = await transaction.get(emailRef);
    if (!currentSnapshot.exists) return { state: 'skipped' as const };
    const current = normalizeEmailRecord(currentSnapshot.data()!);
    if (current.status === 'sending') {
      const sendingAt = current.sending_at || Date.now();
      if (!current.sending_at) {
        transaction.update(emailRef, { sending_at: sendingAt });
      }
      if (sendingAt + 15 * 60 * 1000 > Date.now()) {
        return { state: 'in_progress' as const, retryAt: sendingAt + 15 * 60 * 1000 + 1000 };
      }
    } else if (current.status !== 'scheduled' && current.status !== 'rescheduled') {
      return { state: 'skipped' as const };
    }

    const hourAgo = Date.now() - oneHourMs;
    const reservationRef = getRateReservationRef(current.sender);
    const reservationSnapshot = await transaction.get(reservationRef);
    const reservations = (reservationSnapshot.get('reservations') || {}) as Record<string, number>;
    const otherReservations = Object.fromEntries(
      Object.entries(reservations).filter(([reservedEmailId, reservedAt]) =>
        reservedEmailId !== emailId && typeof reservedAt === 'number' && reservedAt >= hourAgo,
      ),
    ) as Record<string, number>;
    const sentQuery = emailCollection
      .where('sender', '==', current.sender)
      .where('status', '==', 'sent')
      .where('sent_at', '>=', hourAgo)
      .orderBy('sent_at', 'asc')
      .limit(maxEmailsPerHourPerSender + 1);
    const sentSnapshot = await transaction.get(sentQuery);
    const currentCount = sentSnapshot.size + Object.keys(otherReservations).length;
    if (currentCount >= maxEmailsPerHourPerSender) {
      const releaseTimes = [
        ...sentSnapshot.docs.map((document) => document.get('sent_at') as number | undefined),
        ...Object.values(otherReservations),
      ].filter((sentAt): sentAt is number => typeof sentAt === 'number');
      const nextAt = Math.min(...releaseTimes.map((sentAt) => sentAt + oneHourMs + 1000));
      transaction.set(reservationRef, {
        reservations: otherReservations,
        updated_at: Date.now(),
      }, { merge: true });
      transaction.update(emailRef, {
        status: 'rescheduled',
        scheduled_at: nextAt,
        updated_at: Date.now(),
      });
      return { state: 'rescheduled' as const, nextAt, count: currentCount };
    }

    const reservedAt = Date.now();
    transaction.set(reservationRef, {
      reservations: { ...otherReservations, [emailId]: reservedAt },
      updated_at: reservedAt,
    }, { merge: true });
    transaction.update(emailRef, {
      status: 'sending',
      sending_at: reservedAt,
      updated_at: reservedAt,
    });
    return { state: 'claimed' as const, email: current };
  });

  if (result.state === 'skipped') return;
  if (result.state === 'in_progress') {
    await enqueueEmail(emailId, result.retryAt);
    return;
  }
  if (result.state === 'rescheduled') {
    await sendSlackRateLimitAlert(
      email.sender,
      result.count,
      maxEmailsPerHourPerSender,
      new Date(result.nextAt),
    );
    await enqueueEmail(emailId, result.nextAt);
    return;
  }

  if (minDelayBetweenEmailsMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, minDelayBetweenEmailsMs));
  }

  try {
    const delivery = await deliverEmail(result.email);
    const sentAt = Date.now();
    await finalizeDelivery(emailId, result.email.sender, {
      status: 'sent',
      sent_at: sentAt,
      preview_url: delivery.previewUrl || null,
      error_message: null,
      sending_at: null,
      updated_at: sentAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Email delivery failed.';
    await finalizeDelivery(emailId, result.email.sender, {
      status: 'failed',
      error_message: message,
      sending_at: null,
      updated_at: Date.now(),
    });
    console.error(`Email ${emailId} delivery failed:`, error);
  }
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/api', verifyUser);

app.get('/api/auth', (_req, res) => {
  res.json({ success: true });
});

app.get('/api/emails', async (req, res) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const query = typeof req.query.query === 'string' ? req.query.query : '';
    const emails = await findEmails(status, query);
    res.json({ success: true, emails });
  } catch (error) {
    console.error('Email query failed:', error);
    res.status(500).json({ success: false, error: 'Could not load email records.' });
  }
});

app.get('/api/stats', async (_req, res) => {
  try {
    await ensureDefaultSenders();
    await recoverPendingEmailTasks();
    const [
      scheduledCount,
      rescheduledCount,
      sentCount,
      failedCount,
      sendingCount,
      sendersSnapshot,
      recentSnapshot,
    ] = await Promise.all([
      emailCollection.where('status', 'in', ['scheduled', 'rescheduled']).count().get(),
      emailCollection.where('status', '==', 'rescheduled').count().get(),
      emailCollection.where('status', '==', 'sent').count().get(),
      emailCollection.where('status', '==', 'failed').count().get(),
      emailCollection.where('status', '==', 'sending').count().get(),
      firestore.collection('senders').get(),
      emailCollection.orderBy('created_at', 'desc').limit(30).get(),
    ]);

    const scheduled = scheduledCount.data().count;
    const sent = sentCount.data().count;
    const failed = failedCount.data().count;
    const senders = await Promise.all(sendersSnapshot.docs.map(async (document) => {
      const sender = document.data();
      const usage = await emailCollection
        .where('sender', '==', sender.email)
        .where('status', '==', 'sent')
        .where('sent_at', '>=', Date.now() - oneHourMs)
        .count()
        .get();
      return {
        ...sender,
        hourlyUsage: usage.data().count,
        hourlyLimit: maxEmailsPerHourPerSender,
      };
    }));

    res.json({
      success: true,
      stats: {
        scheduled,
        sent,
        failed,
        total: scheduled + sent + failed,
        workerConcurrency: 5,
        maxEmailsPerHour,
        maxEmailsPerHourPerSender,
        minDelayBetweenEmailsMs,
      },
      queue: {
        name: 'sendScheduledEmail',
        counts: {
          waiting: scheduled,
          active: sendingCount.data().count,
          completed: sent,
          failed,
          delayed: rescheduledCount.data().count,
          paused: 0,
        },
        maxConcurrentDispatches: 5,
        workers: [],
        jobs: recentSnapshot.docs.map((document) => document.data()),
      },
      senders,
    });
  } catch (error) {
    console.error('Dashboard stats query failed:', error);
    res.status(500).json({ success: false, error: 'Could not load dashboard statistics.' });
  }
});

app.post('/api/schedule', async (req, res) => {
  const { recipients, sender, subject, body, startTime, delayBetweenSeconds } = req.body;
  if (!Array.isArray(recipients) || recipients.length === 0) {
    res.status(400).json({ success: false, error: 'At least one recipient email address is required.' });
    return;
  }
  if (!sender || !subject || !body) {
    res.status(400).json({ success: false, error: 'Sender, subject, and body are required.' });
    return;
  }

  const baseStartTime = startTime ? new Date(startTime).getTime() : Date.now();
  const delaySeconds = Number.parseInt(String(delayBetweenSeconds ?? '2'), 10);
  const staggerMs = Math.max(0, Number.isFinite(delaySeconds) ? delaySeconds : 2) * 1000;
  if (!Number.isFinite(baseStartTime)) {
    res.status(400).json({ success: false, error: 'startTime must be a valid date.' });
    return;
  }

  const now = Date.now();
  const jobs = recipients.map((recipient: unknown, index: number) => {
    const emailId = randomUUID();
    const cleanRecipient = String(recipient).trim();
    const scheduledAt = baseStartTime + index * staggerMs;
    const email: EmailRecord = {
      id: emailId,
      recipient: cleanRecipient,
      sender: String(sender),
      subject: String(subject),
      body: String(body),
      scheduled_at: scheduledAt,
      status: 'scheduled',
      task_enqueued: false,
      task_enqueue_claim_until: 0,
      job_id: `email-${emailId}`,
      created_at: now,
      updated_at: now,
    };
    return email;
  }).filter((email: EmailRecord) => email.recipient);

  try {
    for (let offset = 0; offset < jobs.length; offset += 400) {
      const batch = firestore.batch();
      for (const email of jobs.slice(offset, offset + 400)) {
        batch.create(emailCollection.doc(email.id), email);
      }
      await batch.commit();
    }

    for (let offset = 0; offset < jobs.length; offset += 100) {
      await Promise.all(jobs.slice(offset, offset + 100).map((email: EmailRecord) =>
        enqueueEmail(email.id, email.scheduled_at),
      ));
      const batch = firestore.batch();
      for (const email of jobs.slice(offset, offset + 100)) {
        batch.update(emailCollection.doc(email.id), { task_enqueued: true });
      }
      await batch.commit();
    }

    res.json({
      success: true,
      message: `Successfully scheduled ${jobs.length} email(s).`,
      count: jobs.length,
      jobs: jobs.map(({ id, recipient, sender: from, subject: title, body: content, scheduled_at }) => ({
        emailId: id,
        recipient,
        sender: from,
        subject: title,
        body: content,
        scheduledAt: scheduled_at,
      })),
    });
  } catch (error) {
    console.error('Email scheduling failed:', error);
    for (let offset = 0; offset < jobs.length; offset += 400) {
      const batch = firestore.batch();
      for (const email of jobs.slice(offset, offset + 400)) {
        batch.delete(emailCollection.doc(email.id));
      }
      try {
        await batch.commit();
      } catch (rollbackError) {
        console.error('Could not roll back a partially scheduled batch:', rollbackError);
      }
    }
    res.status(500).json({ success: false, error: 'Could not schedule all emails. Check Cloud Tasks and Firestore configuration.' });
  }
});

app.post('/api/parse-recipients', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded.' });
    return;
  }
  const content = req.file.buffer.toString('utf-8');
  const matches = content.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/gi) || [];
  const recipients = Array.from(new Set(matches.map((email) => email.toLowerCase())));
  res.json({ success: true, count: recipients.length, recipients });
});

app.post('/api/emails/:id/cancel', async (req, res) => {
  try {
    const emailRef = emailCollection.doc(req.params.id);
    const cancelled = await firestore.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(emailRef);
      if (!snapshot.exists || (snapshot.get('status') !== 'scheduled' && snapshot.get('status') !== 'rescheduled')) {
        return false;
      }
      transaction.update(emailRef, {
        status: 'failed',
        error_message: 'Cancelled by user',
        updated_at: Date.now(),
      });
      return true;
    });
    if (!cancelled) {
      res.status(404).json({ success: false, error: 'Email not found or already processed.' });
      return;
    }
    res.json({ success: true, message: 'Email schedule cancelled.' });
  } catch (error) {
    console.error('Email cancellation failed:', error);
    res.status(500).json({ success: false, error: 'Could not cancel this email.' });
  }
});

app.get('/api/slack/status', async (_req, res) => {
  try {
    const snapshot = await firestore.collection('settings').doc('slack').get();
    res.json({
      connected: Boolean(snapshot.get('webhook_url')),
      channel: snapshot.get('channel') || '#general-alerts',
      updatedAt: snapshot.get('updated_at') || null,
    });
  } catch (error) {
    console.error('Slack status query failed:', error);
    res.status(500).json({ success: false, error: 'Could not load Slack status.' });
  }
});

app.post('/api/slack/connect', async (req, res) => {
  const { webhookUrl, channel } = req.body;
  let parsedWebhook: URL;
  try {
    parsedWebhook = new URL(webhookUrl);
  } catch {
    res.status(400).json({ success: false, error: 'A valid Slack webhook URL is required.' });
    return;
  }
  if (
    parsedWebhook.protocol !== 'https:' ||
    !['hooks.slack.com', 'hooks.slack-gov.com'].includes(parsedWebhook.hostname) ||
    !/^\/(services|triggers)\//.test(parsedWebhook.pathname)
  ) {
    res.status(400).json({ success: false, error: 'A valid Slack HTTPS webhook URL is required.' });
    return;
  }
  try {
    await firestore.collection('settings').doc('slack').set({
      webhook_url: webhookUrl,
      channel: channel || '#alerts',
      updated_at: Date.now(),
    });
    res.json({ success: true, message: 'Slack integration connected successfully.' });
  } catch (error) {
    console.error('Slack configuration update failed:', error);
    res.status(500).json({ success: false, error: 'Could not save Slack configuration.' });
  }
});

app.post('/api/slack/disconnect', async (_req, res) => {
  try {
    await firestore.collection('settings').doc('slack').delete();
    res.json({ success: true, message: 'Slack disconnected.' });
  } catch (error) {
    console.error('Slack disconnection failed:', error);
    res.status(500).json({ success: false, error: 'Could not disconnect Slack.' });
  }
});

export const api = onRequest({ cors: true, maxInstances: 10 }, app);

export const sendScheduledEmail = onTaskDispatched(
  {
    retryConfig: { maxAttempts: 3, minBackoffSeconds: 30, maxBackoffSeconds: 300 },
    rateLimits: {
      maxConcurrentDispatches: 5,
      maxDispatchesPerSecond: minDelayBetweenEmailsMs === 0
        ? 500
        : Math.min(500, 1000 / minDelayBetweenEmailsMs),
    },
    secrets: [smtpUser, smtpPassword],
  },
  async (request) => {
    const emailId = request.data?.emailId;
    if (typeof emailId !== 'string' || !emailId) {
      throw new Error('Cloud Task payload must include an emailId.');
    }
    await dispatchEmail(emailId);
  },
);
