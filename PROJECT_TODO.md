# RivalSense Market TODO

RivalSense should become a search-first AI market intelligence product: users ask questions about AI company changes and get sourced answers, not a manual website-monitoring setup tool.

Work one item at a time. Each item gets its own small commit, push to `main`, and Vercel verification before the next item starts.

Status labels:

- `[DONE]` finished and pushed
- `[DOING]` active item
- `[TODO]` not started
- `[BLOCKED]` cannot continue without external input

## Product Thesis

RivalSense is "Perplexity for AI company changes": it tracks AI companies in the background, stores structured intelligence, and answers market questions with sources and strategic insight.

## First Buyer

Initial buyer: founders, product leaders, and strategy teams at AI startups who need to know what OpenAI, Anthropic, Google DeepMind, Perplexity, Mistral, Cohere, xAI, and adjacent competitors changed recently.

Secondary buyer later: investors and analysts who want an always-current AI company intelligence database.

## Paid Promise

"Ask RivalSense what changed across AI companies this week and get a sourced strategic brief in seconds."

## Marketable MVP

The first sellable version must do five things well:

1. Open to a simple search box.
2. Answer questions about AI company changes.
3. Show source-backed related intelligence items.
4. Track default AI companies in the background.
5. Let a user trust the answer because every claim has company, date, source URL, and strategic insight.

## Execution Rules

- No local database.
- No local dependency installs.
- Cloud-first through GitHub and Vercel.
- One item per commit.
- Push to `main`.
- Verify Vercel build/deploy after every push.
- If Vercel fails, stop feature work and fix the build first.

## Work Plan

### Track 0: Build And Release Discipline

- [DONE] 0.1 Restore a deployable checkpoint.
  - Commit: `ac6a438`
  - Vercel: success
  - Deployment: `https://vercel.com/mrhilhubs-projects/rivalsense/CYvduBHzMH1Qye6JF2BUT4WLNnPd`
- [DONE] 0.2 Keep this TODO current after every step.
- [TODO] 0.3 Add each future feature in one small commit and verify Vercel before continuing.

### Track 1: Product Positioning

- [TODO] 1.1 Remove remaining "database intelligence" and "database vendor" framing from user-facing copy.
- [TODO] 1.2 Make the homepage promise search-first AI market intelligence.
- [TODO] 1.3 Make dashboard/source language internal-facing or hide it from primary customer flows.

### Track 2: Intelligence Database Foundation

- [TODO] 2.1 Confirm existing migration `202606090001_market_intelligence_graph.sql` is safe for Supabase cloud.
- [TODO] 2.2 Add only missing cloud-safe indexes/RPCs needed for LLM retrieval.
- [TODO] 2.3 Keep existing tracking tables intact: `profiles`, `competitors`, `monitored_sources`, `snapshots`, `changes`.

### Track 3: Background AI Company Coverage

- [TODO] 3.1 Add a curated default AI company list in a small, typed config.
- [TODO] 3.2 Add idempotent seeding for default companies and sources.
- [TODO] 3.3 Verify Vercel deploys before connecting seeding to the UI.
- [TODO] 3.4 Connect seeding quietly after login only after 3.1-3.3 are green.

### Track 4: Intelligence Item Creation

- [TODO] 4.1 Update the change summarizer to return structured market intelligence fields.
- [DONE] 4.2 Store each detected source change as an `intelligence_items` row.
- [DONE] 4.3 Add defensive error handling so failed intelligence creation does not break the crawler job.
- [DOING] 4.4 Verify Vercel deploys.

### Track 5: Search And Answer Experience

- [TODO] 5.1 Add a search-first dashboard surface with suggested AI-market questions.
- [TODO] 5.2 Add a query API that searches `intelligence_items`.
- [TODO] 5.3 Return answer plus related intelligence items.
- [TODO] 5.4 Show company, observed date, source URL, and strategic insight.
- [TODO] 5.5 Verify Vercel deploys.

### Track 6: Trust And Monetization

- [TODO] 6.1 Add "sources used" to every answer.
- [TODO] 6.2 Add saved/shared brief flow.
- [TODO] 6.3 Add a simple pricing hypothesis page or paywall experiment.
- [TODO] 6.4 Define launch outreach list of 20 AI founders/product leads.

## Verification Log

- `ac6a438`: Vercel deployment completed successfully.
- `3094a22`: market TODO update pushed; Vercel verification was pending when interrupted.
- Current step: add minimal `intelligence_items` writes from detected changes, push, and verify Vercel.
