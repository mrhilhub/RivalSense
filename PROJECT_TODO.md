# RivalSense Market TODO

---

## Session Changelog — 2026-07-07

This documents every engineering change made in the 2026-07-07 work session.

### Search Answer Improvements
- Broadened search answers so pricing and other cross-company queries summarize the spread across companies instead of collapsing into one vendor.
- Improved evidence selection so answer context prefers distinct companies and more varied claims.
- Added contextual follow-up questions so users can drill into the previous answer and result set without starting over.
- Replaced numeric confidence percentages in the evidence cards with Low / Medium / High confidence tiers.

### LLM Provider Flexibility
- Added configurable OpenAI-compatible LLM support via `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL`.
- Kept Groq support as a backward-compatible option.
- Added automatic fast/smart search model tiers so simple questions can use a low-latency model while broad questions escalate to a stronger model.

### Shared Dataset Rollout
- Routed dashboard and source reads/writes through a shared owner so the best tsp.today@gmail.com experience can be the live experience for everyone.
- Added a shared-owner resolver helper to keep the production experience consistent across users.

### Bootstrap Resilience
- Hardened `bootstrapAiUniverseForUser()` against duplicate competitor/source rows so onboarding refreshes no longer fail with PGRST116.

### Dashboard UX Cleanup
- Consolidated the refresh actions into a single `Refresh database` button.
- Moved `Current intelligence` into a collapsible dropdown panel.
- Turned the dashboard into a more search-first experience with cleaner evidence cards.

### Documentation / Action File
- Added `ACTIONABLE_STEPS.txt` with concrete next steps for the current project state.

## Session Changelog — 2026-06-30

This documents every engineering change made in the 2026-06-30 work session.

### AI Provider Migration
- Replaced hard OpenAI dependency with a **Groq-first, local-fallback** AI path.
- App now works without an OpenAI key. Groq is used when `GROQ_API_KEY` is set; otherwise a deterministic local summarizer and a 1536-dim embedding generator are used.

### Embedding Backfill Fix
- Fixed CLI argument parsing in `scripts/backfill-embeddings.ts` (`--limit`, `--batch-size`, `--dry-run`, `--user-id`).
- Aligned local embedding dimensions to 1536 to match the pgvector column.
- Verified backfill runs and updates rows without failures.

### Search Authentication Fix
- Fixed `app/api/search-intelligence/route.ts` to use the user's auth context correctly.
- Semantic search now returns results scoped to the signed-in user instead of returning empty results.

### Hybrid Search
- `app/api/search-intelligence` now runs semantic vector search first, falls back to full-text search, and detects stale/placeholder summaries and refreshes them live before returning.

### Default AI Company Universe
- Added `lib/aiCompanyUniverse.ts` — typed catalog of 11 major AI companies with tracked sources (website, docs, pricing, changelog, release, incident, GitHub).
- Added `lib/bootstrapAiUniverse.ts` — idempotent per-user bootstrap that creates competitors and sources marked `is_system` (delete-protected).
- Added `app/api/bootstrap-ai-universe/route.ts` — authenticated POST endpoint; called on dashboard load.
- Added `supabase/migrations/202606300001_system_ai_universe.sql` — adds `is_system` column to competitors and monitored_sources, and a trigger that prevents deletion of system rows.
- Updated `app/dashboard/page.tsx` and `app/dashboard/sources/page.tsx` to block deletion of system companies and sources in the UI.

### Larger Source Catalog
- Expanded every default company's tracked source list to include more signal types: status pages, additional docs subsections, GitHub orgs, and secondary release feeds.
- Each company now tracks between 4–7 sources instead of 3–4.

### Historic Intelligence Seeding
- Added `lib/historicIntelligenceSeeds.ts` — curated catalog of 3 dated intelligence items per company (33 total), covering product launches, pricing moves, and documentation maturity.
- Wired historic seeding into `bootstrapAiUniverseForUser()` so every new user automatically gets a pre-populated intelligence timeline on first login.
- Seeds are idempotent — re-running bootstrap never duplicates a row (keyed by `metadata.seed_key`).
- Updated `scripts/seed-ai-universe.ts` to seed companies, sources, and historic intelligence in a single command.
- Updated `app/api/bootstrap-ai-universe/route.ts` to use the service-role client for writes after verifying the user token.

### Automated Default-Company Checks
- Extracted all crawl/snapshot/diff/summarize/embed logic into `lib/runSourceChecks.ts` with a `scope` param (`'all'` or `'system'`).
- `app/api/check/route.ts` now delegates to the shared runner (scope `'all'`); the manual Run Check button on the dashboard still sweeps every active source.
- Added `app/api/check-default-companies/route.ts` (scope `'system'`) — dedicated cron endpoint for the seeded universe only.
- Updated `vercel.json` cron to hit `/api/check-default-companies` daily at 13:00 UTC instead of the general check.
- Previous source limit of 25 is gone; the runner pages through all matching rows in batches of 50.

### Dashboard — Automation Visibility
- Added a **Default-company cron** metric card to the main dashboard showing the last time the automation ran, how many system sources were checked, and how many failed.
- Added the same three-card automation summary to the sources management page.
- Both pages derive this from the `is_system` flag and `last_checked_at` on monitored_sources — no new storage required.

### Build Hygiene
- Fixed `useEffect` exhaustive-deps lint warning in `app/dashboard/sources/page.tsx` by wrapping `load` in `useCallback`.
- Removed deprecated TypeScript `baseUrl` and `ignoreDeprecations` compiler options from `tsconfig.json`.
- Build now passes with **zero warnings and zero errors**.

### Hotfix — Search client crash + missing migration guard (2026-06-30)
- `search-intelligence` was not including `topics` in the response; dashboard called `result.topics.length` on undefined → full-page client-side exception on every search
- Added `topics: item.topics || []` to the search-intelligence response serialization
- Added `(result.topics || [])` guard in dashboard renderer as a second safety net
- Bootstrap `getOrCreateCompetitor` was querying `is_system` column before migration was applied, causing silent insert failures; removed the column from the SELECT and made `trySetSystemFlag` a fire-and-forget best-effort call

---


| File | Change |
|---|---|
| `lib/ai.ts` | Groq + local fallback for summaries and embeddings |
| `lib/summarize.ts` | Re-exports summarizeChange from lib/ai |
| `lib/embeddings.ts` | 1536-dim local embeddings; backfill orchestration |
| `lib/aiCompanyUniverse.ts` | Default 11-company catalog (new file) |
| `lib/bootstrapAiUniverse.ts` | Idempotent per-user bootstrap + historic seed (new file) |
| `lib/historicIntelligenceSeeds.ts` | 33 curated historic intelligence items (new file) |
| `lib/runSourceChecks.ts` | Shared crawler/diff/AI/embed pipeline (new file) |
| `app/api/check/route.ts` | Delegates to shared runner |
| `app/api/check-default-companies/route.ts` | Cron-targeted system-only check (new file) |
| `app/api/bootstrap-ai-universe/route.ts` | Authenticated bootstrap + historic seed (new file) |
| `app/api/search-intelligence/route.ts` | Hybrid search + stale row refresh |
| `app/dashboard/page.tsx` | Bootstrap on load; automation metric card; system-source guard |
| `app/dashboard/sources/page.tsx` | Automation summary; system delete guards; useCallback fix |
| `lib/sharedOwner.ts` | Shared-owner helper for production-wide dataset routing (new file) |
| `scripts/seed-ai-universe.ts` | Seeds companies + sources + historic intelligence |
| `scripts/backfill-embeddings.ts` | Fixed CLI arg parsing |
| `supabase/migrations/202606300001_system_ai_universe.sql` | is_system columns + delete-prevention trigger |
| `vercel.json` | Cron points at /api/check-default-companies |
| `tsconfig.json` | Removed deprecated baseUrl and ignoreDeprecations |
| `package.json` | Added seed:ai-universe script |
| `README.md` | Updated operator docs |
| `ACTIONABLE_STEPS.txt` | Plain-text action checklist for the current state (new file) |

---

## Next Session — Where to Start

### Immediate operational steps (do these first)
1. **Verify the latest Vercel deploy** from `main` and confirm the shared-owner dataset is live for every login.
2. **Run a broad pricing search** like "Show pricing changes from the last month" and verify the answer summarizes multiple companies when applicable.
3. **Test a follow-up question** from the answer card and confirm the previous answer and top results are used as context.
4. **Check the evidence cards** and confirm confidence is shown as Low / Medium / High instead of percentages.
5. **Watch for latency** on the new fast/smart model routing and tighten thresholds only if the broad path feels too slow.

### Known remaining gaps
- **Embeddings on historic seed items** — the 33 seeded intelligence items don't have vector embeddings yet, so semantic search won't surface them; only text search will. Fix: run `npx ts-node scripts/backfill-embeddings.ts --user-id <uuid>` after seeding, or wire the backfill into the bootstrap flow.
- **Search answer latency** — the stronger model improves quality but can be slower; the current fast/smart routing is the workaround, and thresholds may still need tuning.
- **query-intelligence route still exists** — it's no longer used by the dashboard but the endpoint is still live. Can be removed or repurposed.

### Next product features (priority order)
1. **Embed historic seeds on bootstrap** — call `generateIntelligenceEmbedding` for each seed item during `bootstrapAiUniverseForUser` so semantic search works immediately.
2. **Company intelligence profiles** — a `/dashboard/company/[name]` page showing timeline, recent changes, pricing history, and source status for a single company.
3. **Email digest** — weekly summary of the most important changes across all tracked companies, sent to the user's email.

---

## Current Priorities
- ✅ Maintain green local `npm run build` before every push
- ✅ Maintain green Vercel deploy after every push
- ✅ Keep messaging search-first and intelligence-first
- ✅ Apply Track 2 migrations to Supabase
- ✅ Backfill embeddings for existing intelligence_items
- ✅ Test end-to-end flow: Check → Embed → Store → Search
- ✅ Multi-company search answers are live
- ✅ Contextual follow-up questions are live
- ✅ Tiered confidence labels are live
- ✅ Shared-owner dataset routing is live
- Future: Add deployment protection or access control to `/api/check` endpoint

**ACTION ITEMS FOR DA BOSS:**

1. **Apply Migrations** (5 minutes)
   - Go to Supabase Dashboard → SQL Editor
   - Copy contents from `supabase/migrations/202606090002_intelligence_items_text_search.sql`
   - Execute in SQL Editor
   - Repeat for `supabase/migrations/202606090003_update_tracking_source_types.sql`
   - See `docs/MIGRATION_DEPLOYMENT.md` for detailed steps

2. **Backfill Embeddings** (10-30 minutes depending on data size)
   - Run: `npx ts-node scripts/backfill-embeddings.ts --limit 100`
   - Or dry-run first: `npx ts-node scripts/backfill-embeddings.ts --limit 100 --dry-run`
   - Monitor console output for success/failure counts

3. **Run E2E Tests** (5 minutes)
   - Run dev server: `npm run dev`
   - In another terminal: `npx ts-node scripts/test-e2e.ts`
   - All tests should pass

Status labels for implementation items:

- `[DONE]` completed
- `[DOING]` active
- `[TODO]` not started
- `[BLOCKED]` waiting on external input

## Vision
RivalSense is building the historical intelligence layer for the AI industry.

The long-term asset is not monitoring infrastructure.

The long-term asset is a proprietary intelligence database containing:

- AI company changes
- Product launches
- Pricing changes
- Documentation evolution
- Strategic shifts
- Technology adoption
- Market trends

Users should be able to ask:

- What changed at Anthropic this week?
- Which AI companies are investing in agents?
- What pricing changes happened this month?
- Which companies are increasing enterprise focus?

And receive sourced answers instantly.

---

# Product Thesis
RivalSense automatically collects public intelligence from AI companies, structures it into a searchable database, and generates strategic insights.

The product should feel like:

- AI Market Intelligence
- Bloomberg for AI
- Search for AI company intelligence

The product should NOT feel like:

- Website monitoring
- Change tracking software
- Source management software

---

# First Customer
Primary:

- AI startup founders
- Product leaders
- Competitive intelligence teams
- Product marketers

Secondary:

- Investors
- Analysts
- Consultants
- Agencies

---

# Core Promise
"Ask RivalSense what changed across AI companies and receive a sourced strategic brief in seconds."

---

# MVP Success Criteria
A user should be able to:

1. Open RivalSense
2. Ask a question
3. Receive a useful answer
4. See supporting evidence
5. Trust the answer

Every answer should include:

- Company
- Date observed
- Source URL
- Summary
- Strategic insight

---

# Engineering Rules

- GitHub is source of truth
- main branch must remain deployable
- Feature branches for development
- One feature per PR
- Verify Vercel deployment before merge
- Fix build failures immediately
- Run local build before pushing

Required before every push:

```
npm run build
```

---

# Track 0: Build Discipline
**✅ COMPLETE** - Restored deployable state, verified build process, confirmed Vercel deployment, updated roadmap with security task for access control on `/api/check`

- ✅ Restore deployable checkpoint
- ✅ Keep roadmap current
- ✅ Verify build before every push
- ✅ Verify Vercel deployment after every merge
- ✅ Maintain stable production deployment

---

# Track 1: Product Positioning
**✅ COMPLETE** - Repositioned product from database monitoring to AI company intelligence. Updated homepage, dashboard, and sources pages with intelligence-first messaging. Removed database-specific language throughout the app.

- ✅ Update homepage messaging - "The intelligence layer for the AI industry"
- ✅ Remove monitoring-first language - Replaced "monitor" with "analyze" and "continuously analyze"
- ✅ Remove tracking-first language - Changed "Start tracking systems" to "Start Searching"
- ✅ Replace source-management focus with intelligence focus - Updated dashboard headline to "Stay ahead of the AI industry"
- ✅ Add search-first product narrative - Emphasized asking questions and discovering intelligence

Homepage now communicates:

"Understand what AI companies are doing, before everyone else."

Not:

"Monitor competitor websites."

---

# Track 2: Intelligence Database Foundation
**[DOING]** - Building solid intelligence database. Created migration files with embeddings, text search, and utility functions. Integrated embedding generation into /api/check, added a search API endpoint, and verified the flow end to end.

**Completed:**
- ✅ Created migration 202606090002_intelligence_items_text_search.sql - Full-text search, review tracking, quality scoring
- ✅ Created migration 202606090003_update_tracking_source_types.sql - Company denormalization, impact assessment, utility functions
- ✅ Implemented generateEmbedding() and generateIntelligenceEmbedding() in lib/embeddings.ts
- ✅ Updated /api/check to generate embeddings when creating intelligence_items
- ✅ Added new fields: source_quality_score, is_reviewed, language, estimated_impact, affected_entities
- ✅ Created /api/search-intelligence endpoint with semantic + text search fallback
- ✅ Switched AI generation to a free-tier-friendly path: Groq when configured, deterministic local fallback otherwise
- ✅ Fixed and verified backfill embeddings for existing intelligence_items against Supabase (2 items updated, 0 failures)
- ✅ Fixed authenticated semantic search routing so the endpoint respects the logged-in user and returns live results
- ✅ Verified build and live API behavior on 2026-06-30

**Completed:**
- ✅ Deploy migrations to Supabase production
- ✅ Verify intelligence_items table has all new columns
- ✅ Test end-to-end embedding generation and retrieval

**In Progress:**
- 🔄 Backfill embeddings for existing intelligence_items
- 🔄 Create admin API for backfilling missing embeddings

**Next Steps:**
- Add confidence scoring refinement
- Build entity extraction pipeline for companies, people, and topics
- Validate backfilled embeddings support semantic search results
- Harden `/api/check` protection and deployment safety

**Database Schema Added:**
- `intelligence_items.full_text_search` - Generated tsvector for FTS
- `intelligence_items.source_quality_score` - 0-1 quality rating of source
- `intelligence_items.is_reviewed` - Manual review flag
- `intelligence_items.language` - Language detection (default 'en')
- `intelligence_items.estimated_impact` - high/medium/low impact assessment
- `intelligence_items.affected_entities` - Array of affected company/product names
- `intelligence_items.company_name` - Denormalized for faster queries

**New Functions:**
- `search_intelligence_items()` - Vector semantic search
- `search_intelligence_by_text()` - Full-text search
- `get_intelligence_by_company()` - Retrieve by company name
- `get_high_confidence_intelligence()` - Filter by confidence threshold
- `get_recent_intelligence()` - Time-based retrieval
- `update_intelligence_item_company_name()` - Trigger for denormalization

Keep existing tables:

- profiles
- competitors
- monitored_sources
- snapshots
- changes

Do not remove working infrastructure.

---

# Track 3: AI Company Coverage
Create a default intelligence universe.

Initial companies:

- OpenAI
- Anthropic
- Google DeepMind
- Mistral
- Cohere
- xAI
- Perplexity
- Create typed company configuration
- Create default source configuration
- Build idempotent seeding
- Auto-seed after onboarding
- Verify deployments

Status update:
- ✅ Added a reusable AI-company universe config with major public sources
- ✅ Added an idempotent seed script for user-specific competitor/source setup
- ✅ Expanded the default source catalog for each company
- ✅ Added historic intelligence seeding so new users start with useful backfill data
- ✅ Added automated default-company checks via cron
- 🔄 Run the seed script for existing users and then backfill/check to start growing historic coverage

Users should not manually configure dozens of sources.

---

# Track 4: Intelligence Item Creation
Every meaningful change should become an intelligence item.

- [DONE] Convert source changes into intelligence_items
- [TODO] Generate AI summaries
- [TODO] Generate strategic insights
- [TODO] Add topic extraction
- [TODO] Add category classification
- [TODO] Add confidence scoring
- [DONE] Add defensive error handling

Outputs:

- title
- summary
- strategic_insight
- category
- topics
- source
- observed_at

---

# Track 5: Search Experience
Search becomes the primary product experience.

- Create Ask RivalSense page
- Add suggested questions
- Add intelligence search API
- Add semantic retrieval
- Generate AI answers
- Show supporting intelligence items
- Show sources used
- Show company references
- Show strategic insights

Success metric:

Users arrive and search immediately.

---

# Track 6: Customer Discovery
Before building advanced features:

- Interview 10 AI founders
- Interview 5 product marketers
- Interview 5 consultants
- Collect top 50 intelligence questions
- Rank most valuable questions
- Prioritize roadmap around customer demand

Goal:

Learn what people actually pay to know.

---

# Track 7: Trust & Monetization

- Add source citations
- Add answer confidence indicators
- Add saved searches
- Add saved briefs
- Add shareable intelligence reports
- Create pricing page
- Test subscription plans
- Build launch list of 20 prospects

Initial pricing hypothesis:

- Starter: $49/month
- Growth: $149/month
- Pro: $299/month

---

# Track 8: Company Intelligence Profiles
Create dedicated intelligence pages.

Examples:

- OpenAI
- Anthropic
- Google DeepMind
- Mistral
- Cohere
- xAI

Each profile should show:

- Current strategic focus
- Recent changes
- Product launches
- Pricing history
- Timeline
- Technologies
- Sources

Goal:

A user can understand a company in under 60 seconds.

---

# Track 9: Proprietary Data Asset
This is the moat.

- Preserve historical intelligence
- Store all intelligence indefinitely

Current direction:
- Grow the source universe first, then accumulate history through repeated checks and backfills
- Build company timelines
- Build topic timelines
- Build pricing history
- Build launch history
- Build trend detection
- Build strategic shift detection
- Build market reports

Question:

"What data becomes more valuable every day?"

Answer:

The intelligence database.

---

# Track 10: AI Company Graph
Build after search and customer validation.

Entities:

- Companies
- Products
- Technologies
- People
- Investors
- Events

Relationships:

- launched
- acquired
- partnered_with
- invests_in
- competes_with
- supports
- Build entities table
- Build relationship extraction
- Build graph search
- Build trend relationships
- Build graph visualization

Graph is not the product.

Graph supports better intelligence answers.

---

# Success Milestones

## Phase 1

- First paying customer

## Phase 2

- $1,000 MRR

## Phase 3

- $10,000 MRR

## Phase 4

- 100+ active intelligence users

## Phase 5

- Recognized source of AI market intelligence

## Phase 6

- Valuable proprietary intelligence asset

## Phase 7

- Strategic acquisition conversations

Focus on:

1. Customer value
2. Retention
3. Proprietary data
4. Revenue

Not engineering perfection.
