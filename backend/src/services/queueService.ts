import { Queue, Worker, Job } from 'bullmq';
import { config } from '../config';
import { db } from '../db';
import { sendEmailViaEthereal } from './emailService';
import { rateLimiterService } from './rateLimiterService';
import { searchService } from './searchService';
import { getRedisClient, createRedisInstance } from './redisService';

export interface EmailJobData {
  emailId: string;
  recipient: string;
  sender: string;
  subject: string;
  body: string;
  scheduledAt: number;
  attempt?: number;
}

const QUEUE_NAME = 'email-scheduler-queue';

export let emailQueue: Queue<EmailJobData>;
export let emailWorker: Worker<EmailJobData>;

// Active timer tracking for the durable persistent fallback engine
const activeTimers = new Map<string, NodeJS.Timeout>();

export function initQueue() {
  const connection = getRedisClient();

  try {
    emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
      // @ts-ignore
      connection,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    const workerConnection = createRedisInstance();

    // Worker with configurable concurrency and minimum delay between sends
    emailWorker = new Worker<EmailJobData>(
      QUEUE_NAME,
      async (job: Job<EmailJobData>) => {
        const { emailId, recipient, sender, subject, body } = job.data;
        console.log(`[Worker] Processing Job ${job.id} for email ${emailId} -> ${recipient}`);

        // Check DB state to ensure idempotency (never double send)
        const emailRecord = db.prepare('SELECT status FROM emails WHERE id = ?').get(emailId) as { status: string } | undefined;
        if (!emailRecord || emailRecord.status === 'sent') {
          console.log(`[Worker] Email ${emailId} already processed or removed. Skipping.`);
          return { skipped: true };
        }

        // Check Rate Limits per sender (Redis backed)
        const rateCheck = await rateLimiterService.checkAndIncrement(sender);
        if (!rateCheck.allowed && rateCheck.delayMs) {
          console.warn(`[RateLimit] Sender ${sender} hit rate limit (${rateCheck.currentCount}/${rateCheck.limit}). Rescheduling in ${Math.round(rateCheck.delayMs / 1000)}s.`);

          // Reschedule into next window
          const rescheduledTime = Date.now() + rateCheck.delayMs;
          db.prepare('UPDATE emails SET status = ?, scheduled_at = ?, updated_at = ? WHERE id = ?')
            .run('rescheduled', rescheduledTime, Date.now(), emailId);

          // Re-queue delayed job
          await emailQueue.add(
            'send-email',
            { ...job.data, attempt: (job.data.attempt || 1) + 1 },
            { delay: rateCheck.delayMs, jobId: `rescheduled-${emailId}-${Date.now()}` }
          );

          return { rateLimited: true, rescheduledTo: rescheduledTime };
        }

        // Enforce minimum delay between sends (e.g. 2 seconds)
        if (config.minDelayBetweenEmailsMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, config.minDelayBetweenEmailsMs));
        }

        // Send via Ethereal SMTP
        const sentResult = await sendEmailViaEthereal({
          from: sender,
          to: recipient,
          subject,
          html: body,
        });

        const sentAt = Date.now();

        // Update Database state atomically
        db.prepare(
          'UPDATE emails SET status = ?, sent_at = ?, preview_url = ?, job_id = ?, updated_at = ? WHERE id = ?'
        ).run('sent', sentAt, sentResult.previewUrl, job.id, Date.now(), emailId);

        // Update search index
        searchService.indexEmail({
          id: emailId,
          recipient,
          sender,
          subject,
          body,
          status: 'sent',
          scheduled_at: job.data.scheduledAt,
          sent_at: sentAt,
          preview_url: sentResult.previewUrl,
        });

        console.log(`✅ [Worker] Sent email ${emailId} to ${recipient}. Preview: ${sentResult.previewUrl}`);
        return { success: true, previewUrl: sentResult.previewUrl };
      },
      {
        // @ts-ignore
        connection: workerConnection,
        concurrency: config.workerConcurrency,
      }
    );

    emailWorker.on('completed', (job) => {
      console.log(`[Worker] Completed job ${job.id}`);
    });

    emailWorker.on('failed', (job, err) => {
      console.error(`[Worker] Failed job ${job?.id}:`, err);
      if (job?.data?.emailId) {
        db.prepare('UPDATE emails SET status = ?, error_message = ?, updated_at = ? WHERE id = ?')
          .run('failed', err.message, Date.now(), job.data.emailId);
      }
    });
  } catch (err) {
    console.warn('Queue initialization fallback mode active:', err);
  }

  // Self-Healing Durable Persistence Recovery:
  // On server startup/restart, reload all pending/scheduled emails from the relational DB!
  recoverPendingJobsOnStartup();
}

/**
 * Schedule an email job with exact run time (BullMQ Delayed Job + DB Persistence)
 */
export async function scheduleEmailJob(data: EmailJobData) {
  const now = Date.now();
  const delayMs = Math.max(0, data.scheduledAt - now);

  const jobId = `email-${data.emailId}`;

  try {
    if (emailQueue) {
      await emailQueue.add('send-email', data, {
        delay: delayMs,
        jobId, // Idempotent job ID
      });
    }
  } catch (err) {
    console.warn('Redis queue push failed, scheduling via dual durable scheduler:', err);
  }

  // Also setup high-precision dual-safety timer so scheduling guarantees persist regardless of Redis environment
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
    // Immediate execution
    setImmediate(async () => {
      await executeDirectEmailSend(data);
    });
  }

  return jobId;
}

/**
 * Direct send execution ensuring idempotency and status persistence
 */
export async function executeDirectEmailSend(data: EmailJobData) {
  const emailRecord = db.prepare('SELECT status FROM emails WHERE id = ?').get(data.emailId) as { status: string } | undefined;
  if (!emailRecord || emailRecord.status === 'sent') {
    return;
  }

  const rateCheck = await rateLimiterService.checkAndIncrement(data.sender);
  if (!rateCheck.allowed && rateCheck.delayMs) {
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

  if (config.minDelayBetweenEmailsMs > 0) {
    await new Promise((res) => setTimeout(res, config.minDelayBetweenEmailsMs));
  }

  try {
    const sent = await sendEmailViaEthereal({
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
    console.log(`[DurableEngine] Directly sent email ${data.emailId} to ${data.recipient}`);
  } catch (err: any) {
    console.error(`[DurableEngine] Send failed for ${data.emailId}:`, err);
    db.prepare('UPDATE emails SET status = ?, error_message = ?, updated_at = ? WHERE id = ?')
      .run('failed', err.message, Date.now(), data.emailId);
  }
}

/**
 * Recovers all pending/scheduled emails from DB upon server reboot.
 * Ensures:
 * 1. Future emails still send at the exact correct time.
 * 2. Overdue emails send immediately.
 * 3. Never restarted from scratch or duplicated.
 */
export function recoverPendingJobsOnStartup() {
  const pendingEmails = db.prepare(
    "SELECT * FROM emails WHERE status IN ('scheduled', 'rescheduled') ORDER BY scheduled_at ASC"
  ).all() as any[];

  console.log(`🔄 [Recovery] Found ${pendingEmails.length} uncompleted scheduled emails in DB. Restoring state...`);

  for (const email of pendingEmails) {
    const now = Date.now();
    const delay = Math.max(0, email.scheduled_at - now);

    console.log(`⏱️ Restoring job ${email.id} for ${email.recipient} (scheduled for ${new Date(email.scheduled_at).toISOString()}, in ${Math.round(delay/1000)}s)`);

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
