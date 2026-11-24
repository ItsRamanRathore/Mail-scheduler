# 🚀 ReachInbox - Full-stack Email Job Scheduler & Dashboard

A distributed email scheduler and live monitoring dashboard built for the **ReachInbox Software Development Intern Assignment**, with local SQLite/BullMQ development and a Firebase-hosted Firestore/Cloud Tasks deployment.

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
10. [Firebase Deployment](#firebase-deployment)

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
- **Google Sign-In:** Firebase Authentication protects the deployed API with an authorized-email allowlist.
- **Batch CSV/TXT Lead Upload:** Direct drag-and-drop or file upload of email lead lists with automatic deduplication.
- **Live Monitoring:** Real-time counters for Scheduled, Delivered, and Sender Quota bars.
- **Ethereal Mailbox Previews:** Direct one-click links to view real emails rendered in Ethereal.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, TypeScript, Express.js
- **Local Queue & Database:** BullMQ/Redis and SQLite for local development
- **Hosted Queue & Database:** Cloud Tasks for durable timed jobs and Firestore for persistent records
- **Email Delivery:** Ethereal for local previews; configurable SMTP for hosted delivery
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

Copy `frontend/.env.example` to `frontend/.env.local`, fill in the Firebase Web App values, and enable Google sign-in in Firebase Authentication. Add `localhost` to Authentication's authorized domains for local sign-in.

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

## Firebase Deployment

The Firebase deployment uses Firebase Hosting for the React site, Firestore for email/sender/Slack data, Firebase Authentication for Google sign-in, and second-generation Cloud Functions with Cloud Tasks for the API and scheduled delivery. The Firestore database and functions are configured for `us-central1`. Cloud Functions and Cloud Tasks require a Firebase project on the Blaze plan; usage may incur charges.

The hosted backend is separate from the local SQLite/BullMQ backend. The migration script imports existing SQLite records into Firestore; stop the local backend before running it so its database and WAL files are stable. The import is repeatable, skips Firestore documents that already exist, does not print record contents, and queues existing scheduled emails the first time an authorized user opens the dashboard.

### 1. Create and configure the Firebase project

1. Create a Firebase project, upgrade it to the Blaze plan, and add a **Firestore Native** database in `us-central1`. Firestore's location cannot be changed after creation.
2. In **Authentication → Sign-in method**, enable Google. Add the eventual Hosting domain under **Authentication → Settings → Authorized domains**.
3. Register a Web App in **Project settings** and copy its web configuration.
4. Install the Firebase CLI and Google Cloud CLI, then sign in and select the project:

   ```powershell
   npm install -g firebase-tools
   firebase login
   firebase use --add
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   ```

5. Enable Cloud Tasks if it is not already enabled:

   ```powershell
   gcloud services enable cloudtasks.googleapis.com
   ```

The Cloud Functions runtime service account also needs the **Cloud Tasks Enqueuer** role to create scheduled tasks. If deployment succeeds but scheduling returns a permission error, grant `roles/cloudtasks.enqueuer` to the runtime service account shown for the deployed functions.

### 2. Configure client and server settings

Copy `frontend/.env.example` to `frontend/.env.production` and fill in the Firebase Web App values:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=YOUR_PROJECT_ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
VITE_FIREBASE_APP_ID=...
```

Create `functions/.env.YOUR_PROJECT_ID` with the authorized Google account(s), comma-separated:

```env
ALLOWED_EMAILS=you@example.com
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=50
MIN_DELAY_BETWEEN_EMAILS_MS=2000
```

The app is a shared workspace: every email in `ALLOWED_EMAILS` can access the same records and Slack configuration. Do not leave this list empty. Set the SMTP credentials as Firebase secrets before deployment:

```powershell
firebase functions:secrets:set SMTP_USER
firebase functions:secrets:set SMTP_PASS
```

The deployed sender uses SMTP; configure a real mail provider and permitted sender identities. The local backend's Ethereal service is only for test previews, not real delivery.

### 3. Migrate existing SQLite data

Stop the local backend, then run from the repository root. Replace the project ID with the Firebase project selected above:

```powershell
$env:GOOGLE_CLOUD_PROJECT = "YOUR_PROJECT_ID"
pnpm --dir backend install
pnpm --dir backend migrate:firestore
```

The signed-in Google account used by `gcloud auth application-default login` needs Firestore data access (for example, the **Cloud Datastore User** role). Keep a separate backup of `backend/data/scheduler.db` before migrating. Do not delete the source database until you have checked the imported counts and dashboard.

### 4. Build and deploy

From the repository root:

```powershell
pnpm --dir frontend install
pnpm --dir frontend build
pnpm --dir functions install
pnpm --dir functions build
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```

After deployment, open the Hosting URL, sign in with an email in `ALLOWED_EMAILS`, and schedule a test message to an address you control. Check the Cloud Functions and Cloud Tasks logs if the task does not run. Firebase Hosting serves `/api/*` through the authenticated API function; direct Firestore client reads and writes are denied by the deployed rules.

### Important behavior and security notes

- Cloud Tasks preserves scheduled sends across function restarts. Long delays are chained in 30-day steps.
- SMTP providers do not universally support idempotency. A process crash after a provider accepts a message but before Firestore records `sent` can leave an ambiguous delivery; verify provider-side delivery logs before manually retrying such a record.
- Full-text search scans Firestore records when a search term is supplied. This is suitable for a small project; large datasets should use a dedicated search index.
- The `.env` and project selection files are local configuration and are excluded from new commits. The existing `backend/.env` is currently tracked in Git; review it before publishing the repository and rotate any credentials it may contain.

---

## 👥 GitHub Collaborators
- Mitrajit (`Mitrajit`)
- Yadav036 (`Yadav036`)
