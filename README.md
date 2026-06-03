# Competitor Monitor for AI Companies

A Vercel-ready MVP for monitoring competitor pricing pages, docs, changelogs, websites, and GitHub release pages. It stores snapshots, detects meaningful changes, summarizes them with OpenAI, and can send email alerts via Resend.

## What it does

- Supabase auth
- Competitor/source dashboard
- URL crawler and boilerplate cleaner
- Snapshot hashing
- Text diffing
- OpenAI summaries
- Optional Resend email alerts
- Vercel cron-compatible check endpoint

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

This version monitors normal public web pages. Some sites block crawlers or require JS rendering. Add Browserless/Playwright later for those.
