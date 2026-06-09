# RivalSense Market TODO

RivalSense should become a search-first AI market intelligence product: users ask questions about AI company changes and get sourced answers, not a manual website-monitoring setup tool.

Work one item at a time. Each item gets its own small commit, push to `main`, and Vercel verification before the next item starts.

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

- [x] 0.1 Restore a deployable checkpoint.
  - Commit: `ac6a438`
  - Vercel: success
  - Deployment: `https://vercel.com/mrhilhubs-projects/rivalsense/CYvduBHzMH1Qye6JF2BUT4WLNnPd`
- [ ] 0.2 Keep this TODO current after every step.
- [ ] 0.3 Add each future feature in one small commit and verify Vercel before continuing.

### Track 1: Product Positioning

- [ ] 1.1 Remove remaining "database intelligence" and "database vendor" framing from user-facing copy.
- [ ] 1.2 Make the homepage promise search-first AI market intelligence.
- [ ] 1.3 Make dashboard/source language internal-facing or hide it from primary customer flows.

### Track 2: Intelligence Database Foundation

- [ ] 2.1 Confirm existing migration `202606090001_market_intelligence_graph.sql` is safe for Supabase cloud.
- [ ] 2.2 Add only missing cloud-safe indexes/RPCs needed for LLM retrieval.
- [ ] 2.3 Keep existing tracking tables intact: `profiles`, `competitors`, `monitored_sources`, `snapshots`, `changes`.

### Track 3: Background AI Company Coverage

- [ ] 3.1 Add a curated default AI company list in a small, typed config.
- [ ] 3.2 Add idempotent seeding for default companies and sources.
- [ ] 3.3 Verify Vercel deploys before connecting seeding to the UI.
- [ ] 3.4 Connect seeding quietly after login only after 3.1-3.3 are green.

### Track 4: Intelligence Item Creation

- [ ] 4.1 Update the change summarizer to return structured market intelligence fields.
- [ ] 4.2 Store each detected source change as an `intelligence_items` row.
- [ ] 4.3 Add defensive error handling so failed intelligence creation does not break the crawler job.
- [ ] 4.4 Verify Vercel deploys.

### Track 5: Search And Answer Experience

- [ ] 5.1 Add a search-first dashboard surface with suggested AI-market questions.
- [ ] 5.2 Add a query API that searches `intelligence_items`.
- [ ] 5.3 Return answer plus related intelligence items.
- [ ] 5.4 Show company, observed date, source URL, and strategic insight.
- [ ] 5.5 Verify Vercel deploys.

### Track 6: Trust And Monetization

- [ ] 6.1 Add "sources used" to every answer.
- [ ] 6.2 Add saved/shared brief flow.
- [ ] 6.3 Add a simple pricing hypothesis page or paywall experiment.
- [ ] 6.4 Define launch outreach list of 20 AI founders/product leads.

## Verification Log

- `ac6a438`: Vercel deployment completed successfully.
- Next step: commit this updated market TODO, push it, and verify Vercel again before touching product code.
