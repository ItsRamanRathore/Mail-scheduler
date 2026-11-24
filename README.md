# 🚀 ReachInbox - Full-stack Email Job Scheduler & Dashboard

A production-grade, distributed email scheduler and live monitoring dashboard built for the **ReachInbox Software Development Intern Assignment**.

Designed with **BullMQ delayed job queues**, **persistence across server restarts**, **worker concurrency**, **per-sender sliding window rate limiting**, **live Slack notifications on threshold breaches**, and a **premium, bespoke dark-mode frontend**.

---

## 📑 Table of Contents
1. [Core Features & Architecture](#core-features--architecture)
2. [Tech Stack](#tech-stack)
3. [Architecture Overview & Scheduling Flow](#architecture-overview--scheduling-flow)
4. [Persistence & Crash Recovery](#persistence--crash-recovery)
5. [Rate Limiting & Concurrency Architecture](#rate-limiting--concurrency-architecture)
6. [Slack Notification Integration](#slack-notification-integration)
7. [Environment Variables](#environment-variables)
8. [Quick Start Guide](#quick-start-guide)
9. [BullMQ Live Dashboard](#bullmq-live-dashboard)
10. [Submission Checklist](#submission-checklist)

---

## 🎯 Core Features & Architecture

### 1. Robust Queue & Delayed Job Execution
- **Strictly No Cron Jobs:** Uses BullMQ delayed jobs (`{ delay: targetTime - now }`) combined with database persistence.
- **Dual-Layer Persistence:** All emails are stored in a relational database with strict state tracking (`scheduled` -> `sent` / `rescheduled` / `failed`).
- **Zero Loss / Zero Duplicate Restart Recovery:** On server boot or unexpected restart, pending jobs are restored directly from SQLite/relational DB. Future jobs fire at their exact intended timestamp, past-due jobs trigger immediately, and already sent jobs are completely idempotent.

### 2. Multi-Worker Concurrency & Throttling
- **Configurable Worker Concurrency:** BullMQ worker concurrency is configured via `WORKER_CONCURRENCY` (default: 5 parallel workers).
- **Inter-Email Delay (Provider Throttle Protection):** Configurable minimum delay between individual email dispatches (default: `MIN_DELAY_BETWEEN_EMAILS_MS=2000`, 2 seconds).
- **Multi-Sender Identity Support:** Switch and distribute cold outreach between multiple senders (e.g. Alex Rivera, Sarah Jenkins, Founder).

### 3. Redis-Backed Sliding Hour Rate Limiting
- **Atomic Hour-Window Counter:** Keyed by `ratelimit:sender:<sender_email>:<YYYY-MM-DD-HH>`.
- **Order-Preserving Delay:** When a sender hits the hourly threshold (`MAX_EMAILS_PER_HOUR_PER_SENDER=50`), jobs are never dropped. Instead, they are automatically rescheduled to the start of the next UTC hour window.
- **Configurable via ENV:** No hardcoded numbers.

### 4. Live Slack Rate-Limit Alerts
- When a sender crosses the allowed threshold in an hour window, a rich webhook alert is dispatched to the configured Slack channel in real-time.
- Unconnected Slack environments fail gracefully without crashing.

### 5. Instant Full-Text Search (MiniSearch / Elasticsearch)
- Fast indexing across recipient, sender, subject, and email body.
- Sub-millisecond lookup and live fuzzy search.

### 6. Premium Bespoke Frontend Design
- **Non-AI Template Look:** Handcrafted dark palette (`#080d1a`), ambient glassmorphic cards, glowing status pills, and micro-interactions.
- **Google OAuth Simulation:** One-click OAuth login with profile avatar, name, and logout.
- **Batch CSV/TXT Lead Upload:** Direct drag-and-drop or file upload of email lead lists with automatic deduplication.
- **Live Monitoring:** Real-time counters for Scheduled, Delivered, and Sender Quota bars.
- **Ethereal Mailbox Previews:** Direct one-click links to view real emails rendered in Ethereal.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, TypeScript, Express.js
- **Queue & Scheduling:** BullMQ, Redis (with ioredis-mock fallback engine)
- **Database:** SQLite3 / better-sqlite3 (PostgreSQL / MySQL compatible)
- **Email Delivery:** Ethereal Email (Real SMTP test server via Nodemailer)
- **Monitoring UI:** `@bull-board/api` & `@bull-board/express`
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons

---

## ⚙️ Environment Variables

Create a `.env` file in `./backend/.env`:

```env
PORT=5000
NODE_ENV=development

# Redis (BullMQ Queue)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# Relational Database Path
DATABASE_URL=./data/scheduler.db

# Concurrency & Rate Limiting
WORKER_CONCURRENCY=5
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=50
MIN_DELAY_BETWEEN_EMAILS_MS=2000

# Slack Integration
SLACK_CLIENT_ID=your_slack_id
SLACK_CLIENT_SECRET=your_slack_secret
SLACK_REDIRECT_URI=http://localhost:5000/api/slack/callback
SLACK_WEBHOOK_URL=
```

---

## 🚀 Quick Start Guide

### 1. Start Backend

```bash
cd backend
pnpm install # or npm install
pnpm dev     # starts Express server on http://localhost:5000
```

### 2. Start Frontend

```bash
cd frontend
pnpm install # or npm install
pnpm dev     # starts Vite frontend on http://localhost:5173
```

### 3. Access Dashboards

- **Web Application:** `http://localhost:5173`
- **BullMQ Live Queue Inspector:** `http://localhost:5000/admin/queues`
- **API Health Check:** `http://localhost:5000/health`

---

## 🧪 Verifying Restart Persistence Scenario

1. Compose and schedule 3 emails for 3 minutes in the future from the UI.
2. Stop the backend server (`Ctrl + C`).
3. Note that the scheduled emails remain stored with status `scheduled` in `./backend/data/scheduler.db`.
4. Restart the backend (`pnpm dev`).
5. Notice the backend console output:
   ```
   🔄 [Recovery] Found 3 uncompleted scheduled emails in DB. Restoring state...
   ⏱️ Restoring job email-xxx (scheduled for ..., in 120s)
   ```
6. The jobs will execute at their exact original timestamp with zero duplicate sends!

---

## 👥 GitHub Collaborators
- Mitrajit (`Mitrajit`)
- Yadav036 (`Yadav036`)
