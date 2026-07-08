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

## LLM configuration

RivalSense uses an OpenAI-compatible chat-completions API for summaries and strategic answers.

Set one of these env configurations:

1. Unified config (recommended):
	- `LLM_API_KEY` (or `AI_API_KEY`)
	- `LLM_BASE_URL` (or `AI_BASE_URL`), default: `https://api.openai.com/v1`
	- `LLM_MODEL` (or `AI_MODEL`), default: `gpt-4o-mini`
	- Optional search-tier overrides:
		- `LLM_MODEL_FAST` (or `AI_MODEL_FAST`) for low-latency answers
		- `LLM_MODEL_SMART` (or `AI_MODEL_SMART`) for complex queries
		- `LLM_FORCE_FAST_SEARCH=true` to always use fast model
		- `LLM_FORCE_SMART_SEARCH=true` to always use smart model
2. Backward-compatible Groq config:
	- `GROQ_API_KEY`
	- `GROQ_MODEL` (optional)

If no provider key is configured, RivalSense falls back to its built-in local summarizer/answer logic.

Search answers now use a two-tier strategy automatically:

1. Fast model for simple queries.
2. Smart model for broad or complex cross-company queries.
3. Automatic fallback to the other tier if the primary call fails.

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
