import { config } from '../config';
import { db } from '../db';
import { sendSlackRateLimitAlert } from './slackService';

export interface RateLimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  delayMs?: number;
  nextWindowTimestamp?: number;
}

export class RateLimiterService {
  /**
   * Calculates the exact number of emails actually sent by this sender in the rolling 1-hour window (past 3,600,000 ms)
   * backed by SQLite for 100% precision.
   */
  public async getUsage(sender: string): Promise<{ count: number; limit: number }> {
    const oneHourAgo = Date.now() - 3600 * 1000;
    const row = db.prepare(
      "SELECT COUNT(*) as count FROM emails WHERE sender = ? AND status = 'sent' AND sent_at >= ?"
    ).get(sender, oneHourAgo) as { count: number };

    return {
      count: row ? row.count : 0,
      limit: config.maxEmailsPerHourPerSender,
    };
  }

  /**
   * Atomic check before allowing an email to be sent.
   * If sender has already sent >= limit in the rolling hour, immediately block and postpone to next available window.
   */
  public async checkAndIncrement(sender: string): Promise<RateLimitCheckResult> {
    const limit = config.maxEmailsPerHourPerSender;
    const oneHourAgo = Date.now() - 3600 * 1000;

    // Fetch the earliest sent email in this 1-hour window to calculate the exact millisecond when the quota frees up
    const stats = db.prepare(
      "SELECT COUNT(*) as count, MIN(sent_at) as oldestSentAt FROM emails WHERE sender = ? AND status = 'sent' AND sent_at >= ?"
    ).get(sender, oneHourAgo) as { count: number; oldestSentAt: number | null };

    const currentCount = stats ? stats.count : 0;

    // Strict limit: If count has reached limit (50), DO NOT allow 51st email!
    if (currentCount >= limit) {
      // The earliest sent email will fall out of the 1-hour window at oldestSentAt + 3600000 ms
      const earliestFreeTime = (stats.oldestSentAt ? stats.oldestSentAt + 3600 * 1000 : Date.now() + 60 * 1000) + 1000;
      const delayMs = Math.max(2000, earliestFreeTime - Date.now());
      const nextHour = new Date(earliestFreeTime);

      // Trigger Slack notification
      await sendSlackRateLimitAlert(sender, currentCount, limit, nextHour);

      return {
        allowed: false,
        currentCount,
        limit,
        delayMs,
        nextWindowTimestamp: earliestFreeTime,
      };
    }

    return {
      allowed: true,
      currentCount: currentCount + 1,
      limit,
    };
  }
}

export const rateLimiterService = new RateLimiterService();
