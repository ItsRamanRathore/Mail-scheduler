import { Queue } from 'bullmq';
import { config } from '../config';
import { db } from '../db';
import { sendEmail } from './emailService';
import { rateLimiterService } from './rateLimiterService';
import { searchService } from './searchService';

export interface EmailJobData {
  emailId: string;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  scheduledAt: number;
  attempt?: number;
}

// Instantiate BullMQ Queue instance for Bull Board inspection
export const emailQueue = new Queue<EmailJobData>('email-scheduler-queue', {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    lazyConnect: true,
  },
});

// Durable Timer Queue for deterministic background sends
const activeTimers = new Map<string, NodeJS.Timeout>();

export function initQueue() {
  console.log(`🚀 [Queue Engine] Initialized scheduler with BullMQ queue: email-scheduler-queue`);
  recoverPendingJobsOnStartup();
}

/**
 * Schedule an email job with exact run time (Dual Delayed Queue + DB Persistence)
 */
export async function scheduleEmailJob(data: EmailJobData) {
  const now = Date.now();
  const delayMs = Math.max(0, data.scheduledAt - now);
  const jobId = `email-${data.emailId}`;

  if (!config.publicDemo) {
    try {
      await emailQueue.add('send-email', data, {
        delay: delayMs,
        jobId,
      });
    } catch (error) {
      console.warn('BullMQ dashboard enqueue failed; the scheduled email remains in SQLite.', error);
    }
  }

  if (delayMs > 0) {
    if (activeTimers.has(data.emailId)) {
      clearTimeout(activeTimers.get(data.emailId)!);
    }
    const timer = setTimeout(async () => {
      activeTimers.delete(data.emailId);
      await executeDirectEmailSend(data);
    }, delayMs);
    activeTimers.set(data.emailId, timer);
  } else {
    setImmediate(async () => {
      await executeDirectEmailSend(data);
    });
  }

  return jobId;
}

/**
 * Direct send execution ensuring idempotency, rate limiting, and persistence
 */
export async function executeDirectEmailSend(data: EmailJobData) {
  const emailRecord = db.prepare('SELECT status FROM emails WHERE id = ?').get(data.emailId) as { status: string } | undefined;
  if (!emailRecord || emailRecord.status === 'sent') {
    return;
  }

  // Check Rate Limits per sender
  const rateCheck = await rateLimiterService.checkAndIncrement(data.sender);
  if (!rateCheck.allowed && rateCheck.delayMs) {
    console.warn(`[RateLimit] Sender ${data.sender} exceeded hourly limit (${rateCheck.currentCount}/${rateCheck.limit}). Postponing send.`);
    const rescheduledTime = Date.now() + rateCheck.delayMs;
    db.prepare('UPDATE emails SET status = ?, scheduled_at = ?, updated_at = ? WHERE id = ?')
      .run('rescheduled', rescheduledTime, Date.now(), data.emailId);

    const timer = setTimeout(async () => {
      activeTimers.delete(data.emailId);
      await executeDirectEmailSend(data);
    }, rateCheck.delayMs);
    activeTimers.set(data.emailId, timer);
    return;
  }

  // Minimum delay between emails
  if (config.minDelayBetweenEmailsMs > 0) {
    await new Promise((res) => setTimeout(res, config.minDelayBetweenEmailsMs));
  }

  try {
    const sent = await sendEmail({
      from: data.sender,
      to: data.recipient,
      subject: data.subject,
      html: data.body,
    });

    const sentAt = Date.now();
    db.prepare('UPDATE emails SET status = ?, sent_at = ?, preview_url = ?, updated_at = ? WHERE id = ?')
      .run('sent', sentAt, sent.previewUrl, Date.now(), data.emailId);

    searchService.indexEmail({
      id: data.emailId,
      recipient: data.recipient,
      sender: data.sender,
      subject: data.subject,
      body: data.body,
      status: 'sent',
      scheduled_at: data.scheduledAt,
      sent_at: sentAt,
      preview_url: sent.previewUrl,
    });
    console.log(`✅ [Sent] Sent email ${data.emailId} to ${data.recipient}. Preview: ${sent.previewUrl}`);
  } catch (err: any) {
    console.error(`❌ [Error] Send failed for ${data.emailId}:`, err);
    db.prepare('UPDATE emails SET status = ?, error_message = ?, updated_at = ? WHERE id = ?')
      .run('failed', err.message, Date.now(), data.emailId);
  }
}

/**
 * Recovers all pending/scheduled emails from DB upon server reboot.
 */
export function recoverPendingJobsOnStartup() {
  const pendingEmails = db.prepare(
    "SELECT * FROM emails WHERE status IN ('scheduled', 'rescheduled') ORDER BY scheduled_at ASC"
  ).all() as any[];

  console.log(`🔄 [Recovery] Restoring ${pendingEmails.length} pending email jobs from DB...`);

  for (const email of pendingEmails) {
    scheduleEmailJob({
      emailId: email.id,
      recipient: email.recipient,
      sender: email.sender,
      subject: email.subject,
      body: email.body,
      scheduledAt: email.scheduled_at,
    });
  }
}
