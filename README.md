# RivalSense AI Market Intelligence

A Vercel-ready MVP for tracking AI companies in the background and turning source changes into searchable market intelligence. RivalSense stores raw snapshots internally, converts meaningful changes into `intelligence_items`, and lets users ask natural-language questions with source-backed answers.

## What it does

- Supabase auth
- Curated default AI companies and sources
- Background collection through monitored sources and snapshots
- Structured `intelligence_items` for LLM-ready market intelligence
- Search-engine-style question box for AI company changes
- URL crawler and boilerplate cleaner
- Snapshot hashing
- Text diffing
- OpenAI summaries focused on product, pricing, models, agents, partnerships, platform, and strategic impact
- Optional Resend email alerts
- Vercel cron-compatible check endpoint

## Product direction

Users should not need to manually manage lots of tracking sources. The tracking infrastructure remains internal. The main product experience is asking questions like:

- What changed at Anthropic this week?
- Which AI companies changed pricing recently?
- What are competitors doing with agents?

RivalSense answers from `intelligence_items` with related companies, observed dates, source URLs, and strategic insight.

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

This version monitors normal public web pages. Some sites block crawlers or require JS rendering. Add Browserless/Playwright later for those. The user-facing product should remain search-first while collection, sources, snapshots, and changes stay behind the scenes.
