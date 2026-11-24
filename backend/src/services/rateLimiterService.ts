import { getRedisClient } from './redisService';
import { config } from '../config';
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
   * Generates a Redis key scoped to the current 1-hour window.
   * e.g., "ratelimit:sender:alex@reachinbox.ai:2026-11-24-13"
   */
  private getWindowKey(sender: string, timestamp: number = Date.now()): string {
    const d = new Date(timestamp);
    const windowTag = `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}-${d.getUTCHours()}`;
    return `ratelimit:sender:${sender}:${windowTag}`;
  }

  /**
   * Check if sender can send an email right now.
   * Atomic Redis counter with 1-hour TTL.
   */
  public async checkAndIncrement(sender: string): Promise<RateLimitCheckResult> {
    const redis = getRedisClient();
    const key = this.getWindowKey(sender);
    const limit = config.maxEmailsPerHourPerSender;

    try {
      // INCR is atomic across all concurrent BullMQ workers
      const count = await redis.incr(key);
      if (count === 1) {
        // Set expiry for 2 hours so it clears cleanly
        await redis.expire(key, 7200);
      }

      if (count > limit) {
        // Calculate remaining ms until the next UTC hour
        const now = new Date();
        const nextHour = new Date(now);
        nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 1, 0);
        const delayMs = Math.max(1000, nextHour.getTime() - now.getTime());

        // Dispatch Slack alert if threshold hit
        if (count === limit + 1) {
          await sendSlackRateLimitAlert(sender, count, limit, nextHour);
        }

        return {
          allowed: false,
          currentCount: count,
          limit,
          delayMs,
          nextWindowTimestamp: nextHour.getTime(),
        };
      }

      return {
        allowed: true,
        currentCount: count,
        limit,
      };
    } catch (err) {
      console.error('RateLimiter error:', err);
      // Fallback safe allow
      return { allowed: true, currentCount: 1, limit };
    }
  }

  public async getUsage(sender: string): Promise<{ count: number; limit: number }> {
    const redis = getRedisClient();
    const key = this.getWindowKey(sender);
    const val = await redis.get(key);
    return {
      count: val ? parseInt(val, 10) : 0,
      limit: config.maxEmailsPerHourPerSender,
    };
  }
}

export const rateLimiterService = new RateLimiterService();
