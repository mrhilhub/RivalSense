# RivalSense Product TODO

This file is the working source of truth for the pivot. Move slowly: one scoped step per commit, push to `main`, then verify the Vercel build/deploy before starting the next step.

## User Direction Captured

1. Pivot RivalSense from competitor monitoring into an AI market intelligence database plus company graph.
2. Start with the database foundation only:
   - Add `intelligence_items`.
   - Add `entities`.
   - Add `entity_relationships`.
   - Add `intelligence_item_entities`.
   - Keep existing `profiles`, `competitors`, `monitored_sources`, `snapshots`, and `changes`.
   - Add RLS, user scoping, useful indexes, vector search, and `search_intelligence_items`.
3. Do not use or install a local database. This is cloud-first and changes should flow through GitHub.
4. Add an easy way for users to query the intelligence database:
   - Search-engine style input.
   - Suggestions that help users ask good questions.
   - Query `intelligence_items`, not raw snapshots.
5. Correct product direction:
   - Track AI companies, not database vendors.
   - Keep tracking/snapshot infrastructure internal.
   - Hide tracking complexity from customers.
   - Add curated default AI companies and sources.
   - Auto-run collection jobs in the background.
   - Store findings as `intelligence_items`.
   - Main UI should be a simple search page.
   - Results should show answer, related intelligence items, company, observed date, source URL, and strategic insight.
   - Product should feel like Perplexity/Bloomberg/Google for AI company changes, not source management software.
6. Current correction:
   - The previous changes were too much at once.
   - First make this TODO list.
   - Add all prior direction to it.
   - Then tackle work one by one.
   - Verify the Vercel app builds and deploys after each step.

## Execution Rules

- Do not install dependencies locally.
- Do not set up a local database.
- Prefer tiny commits.
- Push each step to `main`.
- After each push, verify the cloud build/deploy status before continuing.
- If a build fails, stop product work and fix the build first.

## Step Plan

- [ ] Step 0: Commit this TODO file and verify Vercel deploys.
- [ ] Step 1: Confirm current `main` build status and identify the exact failing build error if still broken.
- [ ] Step 2: Fix only the build error, with the smallest possible change.
- [ ] Step 3: Verify Vercel build/deploy succeeds.
- [ ] Step 4: Audit existing migrations for cloud deploy safety.
- [ ] Step 5: Audit current UI copy and remove misleading database-vendor framing.
- [ ] Step 6: Audit automatic AI-company seeding for safety and idempotency.
- [ ] Step 7: Audit collection flow so source changes create `intelligence_items` reliably.
- [ ] Step 8: Audit search/answer flow so it queries `intelligence_items` and returns grounded answers.
- [ ] Step 9: Only after the above are green, consider incremental product/UI refinements.

## Vercel Verification Log

- Step 0: Pending.
