# RivalSense Database Intelligence Platform

A Vercel-ready MVP for monitoring database systems, vendors, internal platforms, and project sources. It stores snapshots, detects meaningful changes, summarizes database-relevant impact with a free-tier-friendly AI fallback, and can send email alerts via Resend.

## What it does

- Supabase auth
- Database system/source dashboard
- URL crawler and boilerplate cleaner
- Snapshot hashing
- Text diffing
- AI summaries focused on schema, migration, reliability, performance, release, pricing, and operational impact, using Groq when configured and a built-in fallback otherwise
- Optional Resend email alerts
- Vercel cron-compatible check endpoint
- Dedicated automated checks for the default AI-company universe

## Database intelligence sources

RivalSense can now classify monitored sources as schema, migration, incident, performance, benchmark, release, pricing, docs, changelog, GitHub, or website signals. The current implementation monitors public URLs and creates a baseline/current-state intelligence layer; database connectors can be added behind the same source/snapshot/change model.

## Quick local run

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Seed major AI companies

Add a broader intelligence universe for a signed-in user by seeding major AI companies and their tracked sources:

```bash
npm run seed:ai-universe -- --user-id <supabase-user-uuid>
```

This seeds the default AI company universe, tracked sources, and a small historic intelligence timeline for each company.

Use `--dry-run` first if you want to preview the competitors and sources that will be created.

## Deploy

1. Create a Supabase project and run `supabase/schema.sql`.
2. Create a GitHub repo and push this project.
3. Import the repo into Vercel.
4. Add the environment variables from `.env.example`.
5. Deploy.
6. Add a Vercel cron job or hit `/api/check` manually.

## MVP limitation

This version monitors normal public web pages. Some sites block crawlers or require JS rendering. Add Browserless/Playwright later for those, and add native database connectors by writing extracted metadata into `snapshots`.
