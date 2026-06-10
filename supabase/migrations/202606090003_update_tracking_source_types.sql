-- Add company name denormalization to intelligence_items for faster queries
alter table intelligence_items
  add column if not exists company_name text;

-- Add source domain extraction for analytics
alter table intelligence_items
  add column if not exists source_domain text;

-- Add impact assessment fields
alter table intelligence_items
  add column if not exists estimated_impact text check (estimated_impact in ('high', 'medium', 'low', 'unknown')),
  add column if not exists affected_entities text[] default '{}';

-- Update table to denormalize company names
create or replace function update_intelligence_item_company_name()
returns trigger as $$
begin
  new.company_name := (
    select name from competitors 
    where id = new.company_id 
    limit 1
  );
  new.source_domain := (
    case 
      when new.source_url is not null 
      then (regexp_match(new.source_url, 'https?://([^/]+)', 'i'))[1]
      else null
    end
  );
  return new;
end;
$$ language plpgsql;

create trigger intelligence_items_company_name_trigger
  before insert or update on intelligence_items
  for each row
  execute function update_intelligence_item_company_name();

-- Create indexes for denormalized columns
create index if not exists intelligence_items_company_name_idx 
  on intelligence_items(company_name);

create index if not exists intelligence_items_source_domain_idx 
  on intelligence_items(source_domain);

create index if not exists intelligence_items_estimated_impact_idx 
  on intelligence_items(estimated_impact);

create index if not exists intelligence_items_affected_entities_gin_idx 
  on intelligence_items using gin(affected_entities);

-- Create function to get intelligence items by company name
create or replace function get_intelligence_by_company(
  p_user_id uuid,
  p_company_name text,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id uuid,
  title text,
  summary text,
  strategic_insight text,
  category text,
  observed_at timestamptz,
  confidence_score numeric,
  source_url text
) as $$
begin
  return query
  select
    i.id,
    i.title,
    i.summary,
    i.strategic_insight,
    i.category,
    i.observed_at,
    i.confidence_score,
    i.source_url
  from intelligence_items i
  where i.user_id = p_user_id
    and i.company_name ilike p_company_name
    and not i.is_dismissed
  order by i.observed_at desc
  limit p_limit
  offset p_offset;
end;
$$ language plpgsql;

-- Create function to get high-confidence items
create or replace function get_high_confidence_intelligence(
  p_user_id uuid,
  p_min_confidence numeric default 0.700,
  p_limit int default 20
)
returns table (
  id uuid,
  title text,
  summary text,
  category text,
  company_name text,
  observed_at timestamptz,
  confidence_score numeric,
  source_url text
) as $$
begin
  return query
  select
    i.id,
    i.title,
    i.summary,
    i.category,
    i.company_name,
    i.observed_at,
    i.confidence_score,
    i.source_url
  from intelligence_items i
  where i.user_id = p_user_id
    and i.confidence_score >= p_min_confidence
    and not i.is_dismissed
  order by i.confidence_score desc, i.observed_at desc
  limit p_limit;
end;
$$ language plpgsql;

-- Create function to get recent intelligence items
create or replace function get_recent_intelligence(
  p_user_id uuid,
  p_days int default 7,
  p_limit int default 20
)
returns table (
  id uuid,
  title text,
  summary text,
  category text,
  company_name text,
  observed_at timestamptz,
  source_url text
) as $$
begin
  return query
  select
    i.id,
    i.title,
    i.summary,
    i.category,
    i.company_name,
    i.observed_at,
    i.source_url
  from intelligence_items i
  where i.user_id = p_user_id
    and i.observed_at >= now() - (p_days || ' days')::interval
    and not i.is_dismissed
  order by i.observed_at desc
  limit p_limit;
end;
$$ language plpgsql;

-- Create function to perform full-text search on intelligence items
create or replace function search_intelligence_by_text(
  p_user_id uuid,
  p_query text,
  p_limit int default 20
)
returns table (
  id uuid,
  title text,
  summary text,
  category text,
  company_name text,
  observed_at timestamptz,
  confidence_score numeric,
  source_url text
) as $$
begin
  return query
  select
    i.id,
    i.title,
    i.summary,
    i.category,
    i.company_name,
    i.observed_at,
    i.confidence_score,
    i.source_url
  from intelligence_items i
  where i.user_id = p_user_id
    and i.full_text_search @@ to_tsquery('english', p_query)
    and not i.is_dismissed
  order by ts_rank(i.full_text_search, to_tsquery('english', p_query)) desc,
           i.observed_at desc
  limit p_limit;
end;
$$ language plpgsql;
