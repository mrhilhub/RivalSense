# RivalSense Market TODO

## Current Priorities
- ✅ Maintain green local `npm run build` before every push
- ✅ Maintain green Vercel deploy after every push
- ✅ Keep messaging search-first and intelligence-first
- **[URGENT]** Apply Track 2 migrations to Supabase
- **[URGENT]** Backfill embeddings for existing intelligence_items
- **[URGENT]** Test end-to-end flow: Check → Embed → Store → Search
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
**[DOING]** - Building solid intelligence database. Created migration files with embeddings, text search, and utility functions. Integrated OpenAI embeddings into /api/check. Added new search API endpoint.

**Completed:**
- ✅ Created migration 202606090002_intelligence_items_text_search.sql - Full-text search, review tracking, quality scoring
- ✅ Created migration 202606090003_update_tracking_source_types.sql - Company denormalization, impact assessment, utility functions
- ✅ Implemented generateEmbedding() and generateIntelligenceEmbedding() in lib/embeddings.ts
- ✅ Updated /api/check to generate embeddings when creating intelligence_items
- ✅ Added new fields: source_quality_score, is_reviewed, language, estimated_impact, affected_entities
- ✅ Created /api/search-intelligence endpoint with semantic + text search fallback

**In Progress:**
- 🔄 Deploy migrations to Supabase production
- 🔄 Verify intelligence_items table has all new columns
- 🔄 Test end-to-end embedding generation and retrieval

**TODO:**
- Entity extraction pipeline (extract companies, people, topics from summaries)
- Add confidence scoring refinement
- Batch embeddings generation for backfill
- Create admin API for backfilling missing embeddings

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
