import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

const dbDir = path.dirname(path.resolve(config.dbPath));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(path.resolve(config.dbPath));

// Initialize Schema
export function initDB() {
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS emails (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      sender TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      scheduled_at INTEGER NOT NULL,
      sent_at INTEGER,
      status TEXT NOT NULL CHECK(status IN ('scheduled', 'sent', 'failed', 'rescheduled')),
      job_id TEXT,
      preview_url TEXT,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
    CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at ON emails(scheduled_at);
    CREATE INDEX IF NOT EXISTS idx_emails_recipient ON emails(recipient);
    CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender);

    CREATE TABLE IF NOT EXISTS slack_config (
      tenant_id TEXT PRIMARY KEY,
      webhook_url TEXT,
      access_token TEXT,
      channel TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS senders (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  // Seed default senders if empty
  const count = db.prepare('SELECT count(*) as count FROM senders').get() as { count: number };
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO senders (id, email, display_name, created_at) VALUES (?, ?, ?, ?)');
    insert.run('sender-1', 'alex.outreach@reachinbox.ai', 'Alex Rivera (Growth)', Date.now());
    insert.run('sender-2', 'sarah.sales@reachinbox.ai', 'Sarah Jenkins (Partnerships)', Date.now());
    insert.run('sender-3', 'founder@reachinbox.ai', 'ReachInbox Executive Desk', Date.now());
  }
}
