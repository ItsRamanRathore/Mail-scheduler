# ReachInbox Mail Scheduler

A React dashboard and Express API for composing, scheduling, tracking, and searching email jobs. The frontend is hosted on Vercel; the API and SQLite databases run on Railway.

## Live application

- **Protected production app:** [https://mail-scheduler-jet.vercel.app/](https://mail-scheduler-jet.vercel.app/)
- **Password-free public demo:** [https://mail-scheduler-jet.vercel.app/demo](https://mail-scheduler-jet.vercel.app/demo)
- **Production API health:** [https://mail-scheduler-production.up.railway.app/health](https://mail-scheduler-production.up.railway.app/health)
- **Demo API health:** [https://mail-scheduler-public-demo-production.up.railway.app/health](https://mail-scheduler-public-demo-production.up.railway.app/health)

The production app requires the private scheduler password. Selecting a sender profile chooses the sending identity; it does not replace the password. The `/demo` route uses three one-click demo profiles and never sends real email.

## Features

### Backend

- Express API for login, email scheduling, history, status, search, recipient parsing, cancellation, and statistics.
- SQLite persistence with write-ahead logging (WAL); MiniSearch rebuilds its in-memory full-text index from SQLite at startup.
- Restart recovery for records in `scheduled` or `rescheduled` state.
- Per-sender rolling-hour rate limiting based on successful send timestamps.
- Optional Slack webhook alerts when a sender reaches its hourly limit.
- Password-protected Bull Board queue-inspection route at `/admin/queues`.
- `/health` endpoint for Railway health checks.

### Frontend

- Password-protected production login and a separate one-click demo profile picker.
- Scheduled and sent email views, summary statistics, search, and queue information.
- Compose and schedule emails, parse recipient lists from CSV/TXT uploads, and cancel pending scheduled records.
- Slack controls are shown only in the protected production app.
- The public demo labels its simulated delivery and disables Slack.

## Architecture and scheduling

```text
Browser (React/Vite on Vercel)
  /       -> protected production API on Railway -> production SQLite volume
  /demo   -> isolated demo API on Railway        -> demo SQLite volume

Express API -> SQLite/WAL
            -> Node.js timers for scheduled sends
            -> optional Redis/BullMQ queue records for inspection
```

1. The API validates the sender and request, then inserts email records into SQLite in a transaction.
2. The scheduler creates a Node.js timer for each scheduled record. At the due time, it checks the sender's rate limit and calls the email transport.
3. If the sender is at the limit, the record is moved to `rescheduled` until capacity is available.
4. On startup, the service reads pending records from SQLite and recreates their timers.

SQLite is the durable source of truth. The Railway volume keeps the database and its WAL files across deployments and restarts. The backend must be running for timers to execute; after a restart, pending timers are reconstructed from the database.

**Delivery guarantee:** this is not exactly-once email delivery. If the process stops after the provider accepts a message but before SQLite records it as sent, a recovered job could be sent again.

## Rate limits, Redis, and concurrency

- `MAX_EMAILS_PER_HOUR_PER_SENDER` controls the enforced per-sender rolling-hour limit. The default in [`backend/.env.example`](./backend/.env.example) is 50. Counts are read from successful SQLite send records; an over-limit job is deferred until the earliest send falls outside the hour.
- `MIN_DELAY_BETWEEN_EMAILS_MS` controls the delay before each dispatch; the example default is 2,000 ms.
- Public demo scheduling is capped at 10 recipients per request and 25 recipients per IP per hour. The IP counter is held in process memory and resets when the demo service restarts.
- Redis is not needed for timer-based scheduling. In non-demo mode, the API also attempts to add delayed BullMQ queue records when Redis is reachable. The timer performs the actual dispatch; this codebase does not create a BullMQ `Worker`.
- `WORKER_CONCURRENCY` and `MAX_EMAILS_PER_HOUR` are currently returned in API statistics but do not enforce a worker pool or global send limit. Do not treat the displayed worker rows as actual BullMQ workers.
- SQLite is local to one mounted volume, so each Railway API service is configured for one replica.

## Email and Slack behavior

- **Local development without `SMTP_USER` and `SMTP_PASS`:** Nodemailer creates an Ethereal test account. Messages are test-only; use the preview URL in the API response or backend logs to view them.
- **Configured SMTP:** when both `SMTP_USER` and `SMTP_PASS` are set, the backend sends through the configured SMTP host and port.
- **Public demo:** sending is simulated in the API. It does not connect to Ethereal or SMTP, and no message is delivered.
- **Slack:** the protected service can send rate-limit alerts to a configured webhook. The public demo disables Slack.

## Local development

Requirements: Node.js 22 and pnpm 10.

1. Create `backend/.env` from [`backend/.env.example`](./backend/.env.example). Set `APP_PASSWORD` to a private password of at least 16 characters and `SESSION_SECRET` to a random value of at least 32 characters. Keep `.env` out of source control.

   Generate a session secret with:

   ```sh
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. In one terminal, install and start the API:

   ```sh
   cd backend
   pnpm install --frozen-lockfile
   pnpm dev
   ```

   The API listens on `http://localhost:5000`; its default database is `backend/data/scheduler.db`.

3. In a second terminal, install and start the frontend:

   ```sh
   cd frontend
   pnpm install --frozen-lockfile
   pnpm dev
   ```

   Open `http://localhost:5173`. In development, the frontend uses `http://localhost:5000/api` automatically; no frontend `.env` file is needed.

Redis is optional for local timer-based scheduling. To use the BullMQ queue inspector, run Redis and set `REDIS_HOST`, `REDIS_PORT`, and, if required, `REDIS_PASSWORD`. The production login requires the configured scheduler password. The local demo mode should only be enabled with a separate local database.

Build either application from its directory with `pnpm build`.

## Environment variables

Use the example files for local values: [`backend/.env.example`](./backend/.env.example) and [`frontend/.env.example`](./frontend/.env.example). Never put passwords or session secrets in the frontend or README.

| Variable | Purpose |
| --- | --- |
| `PORT` | Express listen port; defaults to `5000`. |
| `NODE_ENV` | Set to `production` on Railway. |
| `RAILPACK_NODE_VERSION` | Railway Node version; deployed services use `22`. |
| `DATABASE_URL` | SQLite **filesystem path** (not a network URL). Production uses `/data/scheduler.db`; demo uses `/data/scheduler-demo.db`. |
| `PUBLIC_DEMO_MODE` | `true` only on the isolated demo service. |
| `APP_PASSWORD` | Private shared password for production login; do not set it on the public demo. |
| `SESSION_SECRET` | Private signing key for 12-hour API sessions; at least 32 characters. |
| `FRONTEND_ORIGINS` | Comma-separated allowed browser origins. The deployed Vercel origin is `https://mail-scheduler-jet.vercel.app`. |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Optional Redis connection for BullMQ queue inspection. |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | Enforced rolling-hour limit per sender. |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | Delay before each email dispatch. |
| `WORKER_CONCURRENCY`, `MAX_EMAILS_PER_HOUR` | Currently reported in statistics; not enforced by a worker/global limiter. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` | SMTP transport settings. Both user and password are required to use configured SMTP. |
| `SLACK_WEBHOOK_URL` | Optional webhook for production rate-limit alerts; disabled in demo mode. |
| `VITE_API_BASE_URL` | Frontend API base URL for the protected production service, ending in `/api`. |
| `VITE_DEMO_API_BASE_URL` | Frontend API base URL for the isolated demo service, ending in `/api`. |

## Deployed configuration

### Vercel

- Project: `mail-scheduler`
- Root directory: `frontend`
- Production site: [https://mail-scheduler-jet.vercel.app](https://mail-scheduler-jet.vercel.app)
- Public demo route: [https://mail-scheduler-jet.vercel.app/demo](https://mail-scheduler-jet.vercel.app/demo)
- Production environment variables:
  - `VITE_API_BASE_URL=https://mail-scheduler-production.up.railway.app/api`
  - `VITE_DEMO_API_BASE_URL=https://mail-scheduler-public-demo-production.up.railway.app/api`

### Railway production service

- Service: `Mail-scheduler`
- API: [https://mail-scheduler-production.up.railway.app](https://mail-scheduler-production.up.railway.app)
- Root directory: `backend`
- Node.js: 22
- Build command: `pnpm build`
- Start command: `pnpm start`
- Health-check path: `/health`
- Volume: `mail-scheduler-volume-Hcsv`, mounted at `/data`
- Database path: `/data/scheduler.db`
- Replica count: one
- `APP_PASSWORD` and `SESSION_SECRET` are stored as private Railway variables and are intentionally not listed here.

### Railway public demo service

- Service: `Mail-scheduler-public-demo`
- API: [https://mail-scheduler-public-demo-production.up.railway.app](https://mail-scheduler-public-demo-production.up.railway.app)
- Root directory: `backend`
- Node.js: 22
- Build command: `pnpm build`
- Start command: `pnpm start`
- Health-check path: `/health`
- Volume: `mail-scheduler-public-demo-volume`, mounted at `/data`
- Database path: `/data/scheduler-demo.db`
- Replica count: one
- `PUBLIC_DEMO_MODE=true`; no `APP_PASSWORD`, SMTP credentials, or Slack credentials are configured.
- The isolated demo database contains the 55-record mock history and three sender profiles. Demo sends are simulated, and Slack endpoints are disabled.

## Operational notes

- Check service health at the two `/health` links above. The demo health response reports `mode: "demo"`.
- SQLite volume persistence is not a backup. Keep separate database backups before making manual database changes.
- Keep the Railway services awake for on-time scheduled processing; timers run inside the API process.
- The demo and production use different Railway services, volumes, database files, and browser session keys. Do not point the demo service at the production volume or database.
