# 🚀 ReachInbox - Full-stack Email Job Scheduler & Dashboard

A distributed email scheduler and live monitoring dashboard built for the **ReachInbox Software Development Intern Assignment**. The frontend is deployed on Vercel and the Express API runs on Railway with SQLite on a persistent volume. The scheduler is protected by an admin password; Firebase is not used.

Designed with **scheduled email delivery**, **SQLite restart recovery**, **per-sender sliding-window rate limiting**, **live Slack notifications on threshold breaches**, and a **premium, bespoke dark-mode frontend**.

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
10. [Railway and Vercel Deployment](#railway-and-vercel-deployment)

---

## 🎯 Core Features & Architecture

### 1. Scheduled Email Delivery
- Email records and pending schedule times are stored in SQLite.
- The Railway service runs timers for scheduled sends and reconstructs pending sends from SQLite after a restart. Use an always-on service plan; scheduled sends cannot run while a sleeping service is stopped.

### 2. Throttling
- **Configurable Worker Concurrency:** `WORKER_CONCURRENCY` is retained as a scheduler setting.
- **Inter-Email Delay (Provider Throttle Protection):** Configurable minimum delay between individual email dispatches (default: `MIN_DELAY_BETWEEN_EMAILS_MS=2000`, 2 seconds).
- **Multi-Sender Identity Support:** Switch and distribute cold outreach between multiple senders (e.g. Alex Rivera, Sarah Jenkins, Founder).

### 3. SQLite-Backed Sliding Hour Rate Limiting
- The sender limit is calculated from successfully sent records in the previous hour.
- When a sender hits the hourly threshold (`MAX_EMAILS_PER_HOUR_PER_SENDER=50`), a pending email is rescheduled until quota is available.
- **Configurable via ENV:** No hardcoded numbers.

### 4. Live Slack Rate-Limit Alerts
- When a sender crosses the allowed threshold in an hour window, a rich webhook alert is dispatched to the configured Slack channel in real-time.
- Unconnected Slack environments fail gracefully without crashing.

### 5. Instant Full-Text Search (MiniSearch / Elasticsearch)
- Fast indexing across recipient, sender, subject, and email body.
- Sub-millisecond lookup and live fuzzy search.

### 6. Premium Bespoke Frontend Design
- **Non-AI Template Look:** Handcrafted dark palette (`#080d1a`), ambient glassmorphic cards, glowing status pills, and micro-interactions.
- **Admin Password:** A Railway-configured password protects the API; signed sessions expire after 12 hours.
- **Batch CSV/TXT Lead Upload:** Direct drag-and-drop or file upload of email lead lists with automatic deduplication.
- **Live Monitoring:** Real-time counters for Scheduled, Delivered, and Sender Quota bars.
- **Ethereal Mailbox Previews:** Direct one-click links to view real emails rendered in Ethereal.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, TypeScript, Express.js
- **Local Queue & Database:** BullMQ/Redis and SQLite for local development
- **Deployment:** Railway for the Express API; SQLite on a Railway persistent volume
- **Authentication:** Shared admin password and signed API sessions
- **Email Delivery:** Ethereal for local previews; configurable SMTP for hosted delivery
- **Monitoring UI:** `@bull-board/api` & `@bull-board/express`
- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons

---

## ⚙️ Environment Variables

Use `backend/.env.example` as a reference and set the variables in `backend/.env` for local development. Set the same variables in Railway's service settings for deployment. Do not overwrite an existing `.env` file.

```env
PORT=5000
NODE_ENV=development
DATABASE_URL=./data/scheduler.db
FRONTEND_ORIGINS=http://localhost:5173
APP_PASSWORD=replace-with-a-long-random-password
SESSION_SECRET=replace-with-at-least-32-random-bytes

# Redis (BullMQ Queue)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

# Concurrency & Rate Limiting
WORKER_CONCURRENCY=5
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=50
MIN_DELAY_BETWEEN_EMAILS_MS=2000

# SMTP (optional locally; required for real email delivery)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=

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

Ensure `backend/.env` contains `APP_PASSWORD` and `SESSION_SECRET`, using `backend/.env.example` as a reference. The frontend uses the local API automatically in development; no frontend environment file is required.

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

## Railway and Vercel Deployment

This deployment uses Vercel for the React frontend and Railway for the Express API, SQLite database, and scheduled-send process. It does not use Firebase.

### 1. Deploy the API on Railway

1. Create a Railway project from this GitHub repository and add a service for it.
2. Set the service **Root Directory** to `backend`.
3. Let Railway install dependencies with `pnpm install --frozen-lockfile --prefer-offline` (or its detected pnpm install command). Set the build command to `pnpm build`, start command to `pnpm start`, and health-check path to `/health`. Do not add a separate global `node-gyp` install command.
4. Add a Railway volume mounted at `/data`. Set `DATABASE_URL=/data/scheduler.db` so SQLite and its WAL files persist across deployments and restarts.
5. Keep the service to one replica because SQLite is local to the mounted volume.
6. Add a Redis service if you want the BullMQ queue inspector, then map its host, port, and password to `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD`.
7. Set the Railway service variables:

   ```env
   NODE_ENV=production
   RAILPACK_NODE_VERSION=22
   DATABASE_URL=/data/scheduler.db
   APP_PASSWORD=use-a-unique-password-of-at-least-16-characters
   SESSION_SECRET=use-a-random-secret-of-at-least-32-characters
   FRONTEND_ORIGINS=https://YOUR_VERCEL_DOMAIN
   SMTP_HOST=your-smtp-host
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-smtp-user
   SMTP_PASS=your-smtp-password
   ```

   Generate a session secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Keep both password and session secret in Railway variables, never in the frontend or source control. The API rate-limits failed sign-in attempts and expires sessions after 12 hours. Configure SMTP for real delivery; without SMTP credentials, local development uses Ethereal test email.

### 2. Deploy the frontend on Vercel

1. Import the repository into Vercel and set **Root Directory** to `frontend`.
2. Use Vercel's Vite defaults: `pnpm install --frozen-lockfile`, build `pnpm build`, output directory `dist`. The included `frontend/vercel.json` routes frontend paths to the SPA entry point.
3. Add this Vercel environment variable for Production:

   ```env
   VITE_API_BASE_URL=https://YOUR-RAILWAY-DOMAIN/api
   ```

4. Deploy the Railway API first, then set `VITE_API_BASE_URL` to its public domain and deploy or redeploy Vercel.

### 3. Verify the deployment

Open `https://YOUR-RAILWAY-DOMAIN/health`; it should return a healthy status. Sign in on Vercel with the admin password, schedule a test email to an address you control, and confirm the record remains after a Railway redeploy.

### Service sleep and scheduled sends

Railway's Free plan sleeps after roughly 5–10 minutes without outbound traffic, and the first request wakes it with a cold-start delay. This app schedules sends using timers in the backend process, so a sleeping service can delay scheduled sends. Use Railway's always-on Hobby plan for scheduled delivery; Railway currently lists it at $5/month. Vercel's static frontend does not have this backend wake-up delay. See [Railway's Free plan details](https://docs.railway.com/pricing/free-plan) and [serverless behavior](https://docs.railway.com/deployments/serverless).

SQLite data survives a deploy only when the database path is on the Railway volume. Back up the volume/database regularly; a volume is persistence, not a backup.

### Security and transition notes

- SQLite starts empty on the Railway volume; data is not automatically imported from another deployment.
- `backend/.env` was tracked previously. It is now excluded from future commits, but removing it from the latest commit does not erase older Git history. Rotate any credentials it contained before deploying or sharing the repository.

---

## 👥 GitHub Collaborators
- Mitrajit (`Mitrajit`)
- Yadav036 (`Yadav036`)
