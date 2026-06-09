# RivalSense Database Intelligence Platform

A Vercel-ready MVP for monitoring database systems, vendors, internal platforms, and project sources. It stores snapshots, detects meaningful changes, summarizes database-relevant impact with OpenAI, and can send email alerts via Resend.

## What it does

- Supabase auth
- Database system/source dashboard
- URL crawler and boilerplate cleaner
- Snapshot hashing
- Text diffing
- OpenAI summaries focused on schema, migration, reliability, performance, release, pricing, and operational impact
- Optional Resend email alerts
- Vercel cron-compatible check endpoint

## Database intelligence sources

RivalSense can now classify monitored sources as schema, migration, incident, performance, benchmark, release, pricing, docs, changelog, GitHub, or website signals. The current implementation monitors public URLs and creates a baseline/current-state intelligence layer; database connectors can be added behind the same source/snapshot/change model.

## Quick local run

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Deploy

1. Create a Supabase project and run `supabase/schema.sql`.
2. Create a GitHub repo and push this project.
3. Import the repo into Vercel.
4. Add the environment variables from `.env.example`.
5. Deploy.
6. Add a Vercel cron job or hit `/api/check?secret=YOUR_CRON_SECRET` manually.

## MVP limitation

This version monitors normal public web pages. Some sites block crawlers or require JS rendering. Add Browserless/Playwright later for those, and add native database connectors by writing extracted metadata into `snapshots`.
