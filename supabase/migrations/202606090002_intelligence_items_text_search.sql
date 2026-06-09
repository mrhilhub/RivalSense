alter table intelligence_items
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(strategic_insight, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(category, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(topics, ' '), '')), 'C') ||
    setweight(to_tsvector('english', coalesce(source_url, '')), 'D') ||
    setweight(to_tsvector('english', coalesce(metadata::text, '')), 'D')
  ) stored;

create index if not exists intelligence_items_search_vector_idx
  on intelligence_items using gin(search_vector);

create or replace function search_intelligence_items_text(
  search_query text,
  match_count int default 10
)
returns table (
  id uuid,
  user_id uuid,
  company_id uuid,
  source_id uuid,
  change_id uuid,
  title text,
  summary text,
  strategic_insight text,
  category text,
  topics text[],
  source_url text,
  observed_at timestamptz,
  confidence_score numeric,
  metadata jsonb,
  created_at timestamptz,
  rank real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    intelligence_items.id,
    intelligence_items.user_id,
    intelligence_items.company_id,
    intelligence_items.source_id,
    intelligence_items.change_id,
    intelligence_items.title,
    intelligence_items.summary,
    intelligence_items.strategic_insight,
    intelligence_items.category,
    intelligence_items.topics,
    intelligence_items.source_url,
    intelligence_items.observed_at,
    intelligence_items.confidence_score,
    intelligence_items.metadata,
    intelligence_items.created_at,
    ts_rank(
      intelligence_items.search_vector,
      websearch_to_tsquery('english', search_query)
    ) as rank
  from intelligence_items
  where intelligence_items.user_id = auth.uid()
    and intelligence_items.search_vector @@ websearch_to_tsquery('english', search_query)
  order by rank desc, intelligence_items.observed_at desc
  limit greatest(1, least(coalesce(match_count, 10), 50));
$$;
