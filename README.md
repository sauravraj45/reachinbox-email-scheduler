# 📧 ReachInbox Email Scheduler

A full-stack email scheduling system built with **Next.js, Express.js, PostgreSQL, Redis, BullMQ, Elasticsearch, and Ethereal Email**.

---

## ⚙️ Backend Setup

### Prerequisites

- Node.js
- Docker Desktop
- Docker Compose

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file inside the `backend` directory:

```env
PORT=4000
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:4000

DATABASE_URL=postgres://reachinbox:reachinbox@localhost:5433/reachinbox
REDIS_URL=redis://localhost:6380

ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=emails

JWT_SECRET=change-me-to-a-long-random-string

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=

ETHEREAL_SENDERS=
ETHEREAL_SENDER_COUNT=3

WORKER_CONCURRENCY=5
MIN_DELAY_BETWEEN_SENDS_MS=2000
MAX_EMAILS_PER_HOUR_PER_SENDER=200
DEFAULT_CAMPAIGN_HOURLY_LIMIT=100
JOB_ATTEMPTS=5

BULL_BOARD_USER=
BULL_BOARD_PASS=
```

### 3. Start Database, Redis and Elasticsearch

From the project root:

```bash
docker compose up -d
```

The Docker environment starts:

- 🐘 PostgreSQL
- 🔴 Redis
- 🔎 Elasticsearch

### 4. Start Express Backend

```bash
cd backend
npm run dev
```

Backend API:

```text
http://localhost:4000
```

### 5. Start BullMQ Worker

Open another terminal:

```bash
cd backend
npm run dev:worker
```

The worker consumes scheduled jobs from the BullMQ queue and processes email delivery.

---

## 🖥️ Frontend Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Configure Frontend Environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
BACKEND_ORIGIN=http://localhost:4000
```

### 3. Start Frontend

```bash
npm run dev
```

Frontend:

```text
http://localhost:3000
```

---

## 📧 Ethereal Email Setup

The project uses **Ethereal Email** for development and testing.

No external production email account is required for local testing.

By default, the backend automatically creates Ethereal sender accounts when the application starts:

```env
ETHEREAL_SENDERS=
ETHEREAL_SENDER_COUNT=3
```

The generated sender accounts are stored in PostgreSQL and reused by the application.

Alternatively, existing Ethereal sender accounts can be provided through `ETHEREAL_SENDERS` as a JSON array:

```env
ETHEREAL_SENDERS=[{"name":"Alice","user":"alice@ethereal.email","pass":"your-password"}]
```

After an email is sent, Nodemailer generates an **Ethereal preview URL**, which can be used to view the test email.

---

# 🏗️ Architecture Overview

## 📅 How Scheduling Works

1. The user creates a campaign from the frontend.
2. The frontend sends the campaign details and recipient list to the Express API.
3. The backend removes duplicate recipient emails.
4. The campaign and individual email records are stored in PostgreSQL.
5. A BullMQ delayed job is created for each email.
6. Each email receives a deterministic BullMQ job ID based on its database ID.
7. BullMQ releases each job according to its scheduled time and configured delay.
8. The BullMQ worker processes the job.
9. The worker applies rate limits and sender delay rules.
10. The email is sent through Ethereal SMTP.
11. The email status is updated in PostgreSQL.

The system uses **BullMQ delayed jobs instead of cron jobs**.

---

## 🔄 Persistence on Restart

PostgreSQL stores the permanent application and email state.

Redis is configured with **AOF persistence**, so BullMQ delayed jobs can survive a Redis restart.

The database acts as the source of truth for pending emails.

When the worker starts:

1. Database migrations are executed.
2. Elasticsearch is initialized.
3. Pending emails are checked.
4. Missing BullMQ jobs are automatically recreated.
5. Already-sent emails are not scheduled again.

Each BullMQ job uses the email ID as its deterministic job ID, which prevents duplicate jobs from being created during retries or recovery.

This allows scheduled emails to continue after API, worker, or Redis restarts without starting the campaign again from the beginning.

---

## 🚦 Rate Limiting & Concurrency

### Rate Limiting

The system implements two hourly limits:

- **Per-sender hourly limit**
- **Per-campaign hourly limit**

Redis counters are used to track the number of emails sent within the current hourly window.

The reservation operation is performed atomically using a Redis Lua script, making the rate limiter safe when multiple workers process jobs concurrently.

When an hourly limit is reached:

- The email is not dropped.
- The job is moved to the next available hourly window.
- Remaining emails continue in their original order.
- A Slack notification can be sent when the configured limit is reached.

### ⏱️ Minimum Send Delay

The system supports a configurable minimum delay between emails from the same sender:

```env
MIN_DELAY_BETWEEN_SENDS_MS=2000
```

This prevents multiple concurrent workers from sending emails from the same sender too quickly.

### 👷 Worker Concurrency

Worker concurrency is configurable:

```env
WORKER_CONCURRENCY=5
```

BullMQ can process multiple email jobs concurrently while Redis-based rate limiting and sender-gap controls keep email delivery within the configured limits.

---

# ✅ Features Implemented

## 🔧 Backend Features

- Express.js REST API
- PostgreSQL database
- Redis integration
- BullMQ email scheduler
- Dedicated BullMQ worker
- Delayed email jobs
- Persistent scheduled emails
- Startup job reconciliation
- Duplicate job prevention
- Configurable worker concurrency
- Minimum delay between sends
- Per-sender hourly rate limiting
- Per-campaign hourly rate limiting
- Automatic rescheduling after rate-limit exhaustion
- Retry handling with exponential backoff
- Email status tracking
- Ethereal SMTP email delivery
- Elasticsearch email indexing and search
- BullMQ dashboard
- Google OAuth authentication
- Slack OAuth integration
- Slack notifications when rate limits are reached
- Email attachments

## 🎨 Frontend Features

- 🔐 Google OAuth login
- 📊 Dashboard
- ✉️ Email compose interface
- 👥 Recipient/lead management
- 📄 CSV/text recipient input
- ⏰ Send Later scheduling
- ⚡ Configurable delay between emails
- 🚦 Configurable hourly limit
- 📎 Email attachments
- 📅 Scheduled Emails table
- 📤 Sent Emails table
- 📈 Email status tracking
- 🔎 Email search and filtering
- ⭐ Email starring
- 📧 Email details view
- 💬 Slack connection interface
- 📱 Responsive Next.js interface