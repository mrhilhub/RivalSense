# RivalSense Migration Deployment Guide

## Status
- ✅ Migration files created in `supabase/migrations/`
- ⏳ Migrations need to be applied to Supabase production

## Migrations to Apply (In Order)

### 1. `202606090001_market_intelligence_graph.sql`
**What it does:** Creates core intelligence_items table with vector embeddings support, entities, and relationships.
**Status:** Already in schema.sql, may be applied already
**Action:** Verify table exists in Supabase

### 2. `202606090002_intelligence_items_text_search.sql`
**What it does:** Adds full-text search support, quality scoring, review tracking
**New Columns:** 
- `full_text_search` (tsvector, auto-generated)
- `source_quality_score` (numeric)
- `is_reviewed` (boolean)
- `language` (text)
- `estimated_impact` (enum-like)
- `custom_tags` (text[])

### 3. `202606090003_update_tracking_source_types.sql`
**What it does:** Adds denormalization, utility functions, and retrieval helpers
**New Columns:**
- `company_name` (denormalized from competitors)
- `source_domain` (extracted from source_url)
- `affected_entities` (text[])
**New Functions:**
- `get_intelligence_by_company()`
- `get_high_confidence_intelligence()`
- `get_recent_intelligence()`
- `search_intelligence_by_text()`

## How to Apply

### Option 1: Supabase SQL Editor (Easiest)
1. Log in to Supabase Dashboard
2. Go to **SQL Editor**
3. Create a new query for each migration file
4. Copy-paste the entire contents of each .sql file
5. Execute in order (1 → 2 → 3)

### Option 2: Supabase CLI (If Installed)
```bash
supabase link --project-ref YOUR_PROJECT_ID
supabase push
```

### Option 3: psql Direct Connection
```bash
psql postgresql://user:password@host:port/postgres < supabase/migrations/202606090002_intelligence_items_text_search.sql
psql postgresql://user:password@host:port/postgres < supabase/migrations/202606090003_update_tracking_source_types.sql
```

## Verification Checklist

After applying migrations:

```sql
-- Check if new columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'intelligence_items' 
ORDER BY column_name;

-- Check if new functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_type = 'FUNCTION' 
AND routine_schema = 'public';

-- Check indexes
SELECT indexname FROM pg_indexes 
WHERE tablename = 'intelligence_items';
```

## Next Steps
1. Apply migrations to production
2. Run backfill script to generate embeddings for existing items
3. Test end-to-end flow: Check → Embed → Store → Search
