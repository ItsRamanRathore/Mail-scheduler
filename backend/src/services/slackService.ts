import { db } from '../db';
import { config } from '../config';

export async function sendSlackRateLimitAlert(sender: string, hourlyCount: number, limit: number, nextAvailableTime: Date) {
  const slackConfig = db.prepare('SELECT webhook_url FROM slack_config WHERE tenant_id = ?').get('default') as { webhook_url?: string } | undefined;

  const webhook = slackConfig?.webhook_url || config.slack.webhookUrl;

  const payload = {
    text: `⚠️ *Rate Limit Exceeded for Sender:* \`${sender}\``,
    attachments: [
      {
        color: '#f59e0b',
        title: 'ReachInbox Scheduler Rate Limiter Triggered',
        fields: [
          {
            title: 'Sender',
            value: sender,
            short: true,
          },
          {
            title: 'Volume in Current Hour',
            value: `${hourlyCount} / ${limit} emails`,
            short: true,
          },
          {
            title: 'Action Taken',
            value: 'Job safely deferred & rescheduled to next available hour window preserving order.',
            short: false,
          },
          {
            title: 'Next Window Available',
            value: nextAvailableTime.toLocaleTimeString(),
            short: true,
          },
        ],
        footer: 'ReachInbox Email Queue Service',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  if (!webhook) {
    console.log(`[SLACK ALERT SIMULATION] Rate limit reached for ${sender}. (Slack not connected). Payload:`, JSON.stringify(payload));
    return;
  }

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(`🔔 Live Slack notification sent for ${sender}, response: ${response.status}`);
  } catch (error) {
    console.error('Failed to dispatch Slack webhook alert:', error);
  }
}
