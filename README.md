# 🚀 ReachInbox - Full-stack Email Job Scheduler & Dashboard

A distributed email scheduler and live monitoring dashboard built for the **ReachInbox Software Development Intern Assignment**. The frontend is deployed on Vercel and the Express API runs on Railway with SQLite on a persistent volume. The API uses a shared admin password; Firebase and Google OAuth are not used.

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
- **Protected Demo Profile Picker:** Choose one of the three saved sender profiles, then sign in with the Railway admin password. Signed sessions expire after 12 hours.
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

1. **Create the backend service.** In Railway, create a project from this GitHub repository and add a service connected to the repository. Select the branch you will push deployment changes to; Railway can only build committed and pushed files.
2. **Set the service root directory.** Open the backend service's **Settings** and set **Root Directory** to `backend`. This makes Railway use `backend/package.json`, its lockfile, and its TypeScript source instead of trying to build the repository root.
3. **Configure install, build, and start.** Let Railway detect pnpm or set the install command to `pnpm install --frozen-lockfile --prefer-offline`. Set the build command to `pnpm build` and the start command to `pnpm start`. Set the health-check path to `/health`; Railway will request this endpoint after starting the service. The backend pins Node 22 and pnpm 10 in `backend/package.json`. Do not add a separate global `node-gyp` install command.
4. **Attach persistent storage.** From the Railway project canvas, create a **Volume**, connect it to this backend service, and set its **Mount Path** to `/data`. Create it in the same Railway environment (for example, Production) as the backend service. A mount makes that directory available to the running container and keeps the database files when Railway replaces the container.
5. **Point SQLite at the volume.** In the backend service's **Variables**, add `DATABASE_URL` with the exact value `/data/scheduler.db`. The app uses this as a filesystem path, not a database URL. SQLite also creates WAL files beside the database, so they persist on the same volume. Save and redeploy/restart the service after attaching the volume and setting the variable.
6. **Keep one backend replica.** SQLite is a file on one mounted volume; multiple backend replicas would not share it safely. Set the service's replica/instance count to one.
7. **Optionally add Redis.** Redis is only needed for the BullMQ queue inspector; email records and scheduled sends use SQLite and the Railway process. If you want the inspector, add a Redis service in the same Railway project, then reference its host, port, and password from the backend service as `REDIS_HOST`, `REDIS_PORT`, and `REDIS_PASSWORD`.
8. **Set the remaining backend variables.** In the backend service's **Variables** tab, add:

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

   - `RAILPACK_NODE_VERSION=22` ensures Railway uses Node 22, which is compatible with the native SQLite dependency.
   - `APP_PASSWORD` is the shared scheduler login. Use a unique password at least 16 characters long; the login screen lets you select one of the three saved sender profiles.
   - Generate `SESSION_SECRET` with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. It signs login sessions; keep it private. Sessions expire after 12 hours.
   - `FRONTEND_ORIGINS` must be the exact Vercel origin, such as `https://my-scheduler.vercel.app`, with no path. It allows the browser frontend to call the API.
   - Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, and `SMTP_PASS` to your email provider's settings for real delivery. Keep passwords in Railway Variables. Without SMTP credentials, the backend uses Ethereal test email, which is not real delivery.
   - `DATABASE_URL` must match the volume path from step 5. Do not put `APP_PASSWORD` or `SESSION_SECRET` in Vercel or in source control. The demo profile picker uses the Railway scheduler password; share it privately with trusted evaluators, never on the public login page.

### Import existing local data into Railway

Railway does not copy the local database automatically. A consistent SQLite backup for this workspace is available at `backend/data/scheduler-railway.db`; it was made with SQLite's backup API so it includes committed data from the WAL file. It passed SQLite's integrity check and contains 55 email records, the 3 example sender profiles, and 1 Slack configuration. Keep this database file private and do not commit it.

1. **Check the scheduled records before starting the imported database.** The backup has 53 sent records and 2 overdue `rescheduled` records. On startup, the backend recovers scheduled and rescheduled jobs; overdue jobs are attempted immediately. To avoid real delivery while evaluating, leave the `SMTP_*` variables unset until you have reviewed those records. Without SMTP settings, the app uses Ethereal test email. The records remain in the database, though their status may change when the jobs are attempted.
2. **Select the correct Railway volume.** In PowerShell at the repository root, run `railway login`, then `railway link` and select the Railway project and Production environment. Run `railway volume list` and identify the volume mounted at `/data`.
3. **Upload the backup without replacing an existing database.** Run this command, replacing `YOUR_VOLUME_NAME` with the volume name or ID:

   ```powershell
   railway volume files --volume YOUR_VOLUME_NAME upload .\backend\data\scheduler-railway.db /scheduler-import.db
   ```

   The remote path is relative to the volume, so `/scheduler-import.db` is available to the backend as `/data/scheduler-import.db`.
4. **Switch the backend to the imported file.** In Railway's backend service Variables, set `DATABASE_URL` to `/data/scheduler-import.db`, then let Railway restart the service. This uses a new filename rather than overwriting `/data/scheduler.db`; the previous database remains on the volume as a fallback.
5. **Verify the import.** Open the Vercel app and confirm the email history and all three sender profiles are present. The API only accepts sending identities already present in the database, so this import limits sending to those three profiles. They are sender profiles, not login accounts; select a profile and use the shared Railway scheduler password.

### 2. Deploy the frontend on Vercel

1. **Import the frontend.** Import the same GitHub repository into Vercel and select the branch containing the deployment code. Set **Root Directory** to `frontend`; this points Vercel at the React/Vite app and its lockfile.
2. **Set the build options.** Use install command `pnpm install --frozen-lockfile`, build command `pnpm build`, and output directory `dist`. The included `frontend/vercel.json` rewrites client-side routes to `index.html`, so refreshing a nested route still loads the app.
3. **Connect it to Railway.** Add this environment variable in Vercel's project settings for Production:

   ```env
   VITE_API_BASE_URL=https://YOUR-RAILWAY-DOMAIN/api
   ```

   Replace the placeholder with the public domain Railway assigns to the backend, followed by `/api` (for example, `https://scheduler-api.up.railway.app/api`). Do not add a trailing slash. This URL is public and is not a secret.
4. **Deploy in order.** Deploy the Railway backend and generate its public domain first. Set `VITE_API_BASE_URL` to that domain, then deploy or redeploy Vercel. Copy Vercel's production origin (scheme and hostname only) into Railway's `FRONTEND_ORIGINS` variable and redeploy the backend if it wasn't already set.

### 3. Verify the deployment

Open `https://YOUR-RAILWAY-DOMAIN/health`; it should return a healthy status. Sign in on Vercel by selecting a sender profile and entering the Railway scheduler password, schedule a test email to an address you control, and confirm the record remains after a Railway redeploy.

### Service sleep and scheduled sends

Railway's Free plan sleeps after roughly 5–10 minutes without outbound traffic, and the first request wakes it with a cold-start delay. This app schedules sends using timers in the backend process, so a sleeping service can delay scheduled sends. Use Railway's always-on Hobby plan for scheduled delivery; Railway currently lists it at $5/month. Vercel's static frontend does not have this backend wake-up delay. See [Railway's Free plan details](https://docs.railway.com/pricing/free-plan) and [serverless behavior](https://docs.railway.com/deployments/serverless).

SQLite data survives a deploy only when the database path is on the Railway volume. Back up the volume/database regularly; a volume is persistence, not a backup.

### Security and transition notes

- A new Railway volume starts empty; data is not automatically imported from another deployment. Use the import steps above if you need to bring over an existing local database.
- `backend/.env` was tracked previously. It is now excluded from future commits, but removing it from the latest commit does not erase older Git history. Rotate any credentials it contained before deploying or sharing the repository.

---

## 👥 GitHub Collaborators
- Mitrajit (`Mitrajit`)
- Yadav036 (`Yadav036`)
