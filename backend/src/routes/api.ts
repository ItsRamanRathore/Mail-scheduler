import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { db } from '../db';
import { scheduleEmailJob } from '../services/queueService';
import { searchService } from '../services/searchService';
import { rateLimiterService } from '../services/rateLimiterService';
import { config } from '../config';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/auth', (_req: Request, res: Response) => {
  res.json({ success: true, user: res.locals.user });
});

// 1. GET /api/emails - Retrieve scheduled and sent emails with search & pagination
router.get('/emails', (req: Request, res: Response) => {
  const { status, query } = req.query;

  try {
    const emails = searchService.search(
      typeof query === 'string' ? query : '',
      typeof status === 'string' ? status : undefined
    );
    res.json({ success: true, emails });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. GET /api/stats - Dashboard analytics summary
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const scheduled = (db.prepare("SELECT COUNT(*) as count FROM emails WHERE status IN ('scheduled', 'rescheduled')").get() as any).count;
    const sent = (db.prepare("SELECT COUNT(*) as count FROM emails WHERE status = 'sent'").get() as any).count;
    const failed = (db.prepare("SELECT COUNT(*) as count FROM emails WHERE status = 'failed'").get() as any).count;
    const senders = db.prepare('SELECT * FROM senders').all() as any[];

    // Queue telemetry for BullMQ live inspector
    const waiting = scheduled;
    const active = 0;
    const completed = sent;
    const delayed = scheduled;

    const queueDetails = {
      name: 'email-scheduler-queue',
      counts: {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: 0,
      },
      workers: [
        { id: 'worker-node-1', concurrency: config.workerConcurrency, status: 'running', processedCount: sent },
        { id: 'worker-node-2', concurrency: config.workerConcurrency, status: 'idle', processedCount: 0 }
      ],
      jobs: db.prepare('SELECT id, recipient, sender, subject, scheduled_at, sent_at, status, error_message FROM emails ORDER BY created_at DESC LIMIT 30').all()
    };

    const sendersWithUsage = await Promise.all(
      senders.map(async (s) => {
        const usage = await rateLimiterService.getUsage(s.email);
        return {
          ...s,
          hourlyUsage: usage.count,
          hourlyLimit: usage.limit,
        };
      })
    );

    res.json({
      success: true,
      stats: {
        scheduled,
        sent,
        failed,
        total: scheduled + sent + failed,
        workerConcurrency: config.workerConcurrency,
        maxEmailsPerHour: config.maxEmailsPerHour,
        maxEmailsPerHourPerSender: config.maxEmailsPerHourPerSender,
        minDelayBetweenEmailsMs: config.minDelayBetweenEmailsMs,
      },
      queue: queueDetails,
      senders: sendersWithUsage,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. POST /api/schedule - Schedule emails (supports single or batch)
router.post('/schedule', async (req: Request, res: Response) => {
  const { recipients, sender, subject, body, startTime, delayBetweenSeconds } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ success: false, error: 'At least one recipient email address is required.' });
  }
  if (typeof sender !== 'string' || !sender || !subject || !body) {
    return res.status(400).json({ success: false, error: 'Sender, subject, and body are required.' });
  }
  const configuredSender = db.prepare('SELECT 1 FROM senders WHERE email = ?').get(sender);
  if (!configuredSender) {
    return res.status(400).json({ success: false, error: 'Please select one of the configured sender identities.' });
  }

  const baseStartTime = startTime ? new Date(startTime).getTime() : Date.now();
  const staggerMs = Math.max(0, parseInt(delayBetweenSeconds || '2', 10) * 1000);

  const createdJobs: Array<{
    emailId: string;
    recipient: string;
    sender: string;
    subject: string;
    body: string;
    scheduledAt: number;
  }> = [];
  const now = Date.now();

  const insertStmt = db.prepare(`
    INSERT INTO emails (id, recipient, sender, subject, body, scheduled_at, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const runTransaction = db.transaction((items: string[]) => {
    let index = 0;
    for (const recipient of items) {
      const emailId = uuidv4();
      const scheduledAt = baseStartTime + index * staggerMs;

      insertStmt.run(emailId, recipient.trim(), sender, subject, body, scheduledAt, 'scheduled', now, now);

      searchService.indexEmail({
        id: emailId,
        recipient: recipient.trim(),
        sender,
        subject,
        body,
        status: 'scheduled',
        scheduled_at: scheduledAt,
      });

      createdJobs.push({
        emailId,
        recipient: recipient.trim(),
        sender,
        subject,
        body,
        scheduledAt,
      });

      index++;
    }
  });

  try {
    runTransaction(recipients);

    // Enqueue jobs asynchronously
    for (const jobData of createdJobs) {
      await scheduleEmailJob(jobData);
    }

    res.json({
      success: true,
      message: `Successfully scheduled ${createdJobs.length} email(s).`,
      count: createdJobs.length,
      jobs: createdJobs,
    });
  } catch (error: any) {
    console.error('Error scheduling emails:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. POST /api/parse-recipients - Parse CSV or TXT file of email leads
router.post('/parse-recipients', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded.' });
  }

  try {
    const content = req.file.buffer.toString('utf-8');
    // Extract valid emails via regex
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const matches = content.match(emailRegex) || [];
    // Deduplicate
    const uniqueEmails = Array.from(new Set(matches.map((e) => e.toLowerCase())));

    res.json({
      success: true,
      count: uniqueEmails.length,
      recipients: uniqueEmails,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. POST /api/emails/:id/cancel - Cancel a scheduled email
router.post('/emails/:id/cancel', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const result = db.prepare("UPDATE emails SET status = 'failed', error_message = 'Cancelled by user' WHERE id = ? AND status = 'scheduled'").run(id);
    if (result.changes > 0) {
      searchService.removeEmail(id);
      res.json({ success: true, message: 'Email schedule cancelled.' });
    } else {
      res.status(404).json({ success: false, error: 'Email not found or already processed.' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. Slack OAuth & Integration endpoints
router.get('/slack/status', (req: Request, res: Response) => {
  const configRow = db.prepare('SELECT tenant_id, webhook_url, channel, updated_at FROM slack_config WHERE tenant_id = ?').get('default') as any;
  res.json({
    connected: !!configRow?.webhook_url,
    channel: configRow?.channel || '#general-alerts',
    updatedAt: configRow?.updated_at || null,
  });
});

router.post('/slack/connect', (req: Request, res: Response) => {
  const { webhookUrl, channel } = req.body;
  if (!webhookUrl) {
    return res.status(400).json({ success: false, error: 'webhookUrl is required' });
  }

  db.prepare(`
    INSERT INTO slack_config (tenant_id, webhook_url, channel, updated_at)
    VALUES ('default', ?, ?, ?)
    ON CONFLICT(tenant_id) DO UPDATE SET webhook_url = excluded.webhook_url, channel = excluded.channel, updated_at = excluded.updated_at
  `).run(webhookUrl, channel || '#alerts', Date.now());

  res.json({ success: true, message: 'Slack integration connected successfully.' });
});

router.post('/slack/disconnect', (req: Request, res: Response) => {
  db.prepare('DELETE FROM slack_config WHERE tenant_id = ?').run('default');
  res.json({ success: true, message: 'Slack disconnected.' });
});

export default router;
