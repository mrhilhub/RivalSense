-- Add full-text search support to intelligence_items
alter table intelligence_items 
  add column if not exists full_text_search tsvector generated always as (
    to_tsvector('english', title || ' ' || summary || ' ' || coalesce(strategic_insight, ''))
  ) stored;

-- Add additional tracking columns
alter table intelligence_items
  add column if not exists source_quality_score numeric(4,3) default 0.500 check (source_quality_score >= 0 and source_quality_score <= 1),
  add column if not exists is_reviewed boolean default false,
  add column if not exists reviewer_id uuid references auth.users(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists is_dismissed boolean default false,
  add column if not exists dismissed_reason text,
  add column if not exists language text default 'en',
  add column if not exists original_title text,
  add column if not exists custom_tags text[] default '{}';

-- Create GIN index for full-text search
create index if not exists intelligence_items_full_text_search_idx 
  on intelligence_items using gin(full_text_search);

-- Create index for reviewed items
create index if not exists intelligence_items_is_reviewed_idx 
  on intelligence_items(is_reviewed) 
  where is_reviewed = true;

-- Create index for dismissed items
create index if not exists intelligence_items_is_dismissed_idx 
  on intelligence_items(is_dismissed) 
  where is_dismissed = false;

-- Create index on custom tags
create index if not exists intelligence_items_custom_tags_gin_idx 
  on intelligence_items using gin(custom_tags);

-- Create index on source quality
create index if not exists intelligence_items_source_quality_idx 
  on intelligence_items(source_quality_score desc);

-- Create composite index for common queries
create index if not exists intelligence_items_user_observed_at_idx 
  on intelligence_items(user_id, observed_at desc);

-- Create index for confidence scores
create index if not exists intelligence_items_confidence_score_idx 
  on intelligence_items(confidence_score desc);

-- Add RLS policy for reviewed items (reviewers can see)
create policy "reviewed items viewable by user" on intelligence_items
  for select
  using (auth.uid() = user_id or auth.uid() = reviewer_id);
