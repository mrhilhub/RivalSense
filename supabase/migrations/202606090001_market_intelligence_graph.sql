create extension if not exists pgcrypto;
create extension if not exists vector;

create table intelligence_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references competitors(id) on delete set null,
  source_id uuid references monitored_sources(id) on delete set null,
  change_id uuid references changes(id) on delete set null,
  title text not null,
  summary text not null,
  strategic_insight text,
  category text not null,
  topics text[] default '{}',
  source_url text,
  observed_at timestamptz not null default now(),
  confidence_score numeric(4,3) default 0.500 check (confidence_score >= 0 and confidence_score <= 1),
  metadata jsonb default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz default now()
);

create table entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null check (
    type in (
      'company',
      'product',
      'technology',
      'topic',
      'person',
      'investor',
      'event'
    )
  ),
  description text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table entity_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_entity_id uuid not null references entities(id) on delete cascade,
  target_entity_id uuid not null references entities(id) on delete cascade,
  relationship_type text not null,
  confidence_score numeric(4,3) default 0.500 check (confidence_score >= 0 and confidence_score <= 1),
  evidence_intelligence_item_id uuid references intelligence_items(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  created_at timestamptz default now(),
  check (source_entity_id <> target_entity_id)
);

create table intelligence_item_entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  intelligence_item_id uuid not null references intelligence_items(id) on delete cascade,
  entity_id uuid not null references entities(id) on delete cascade,
  relevance_score numeric(4,3) default 0.500 check (relevance_score >= 0 and relevance_score <= 1),
  created_at timestamptz default now()
);

alter table intelligence_items enable row level security;
alter table entities enable row level security;
alter table entity_relationships enable row level security;
alter table intelligence_item_entities enable row level security;

create policy "intelligence items owned by user"
  on intelligence_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "entities owned by user"
  on entities
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "entity relationships owned by user"
  on entity_relationships
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "intelligence item entities owned by user"
  on intelligence_item_entities
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index intelligence_items_user_id_idx on intelligence_items(user_id);
create index intelligence_items_company_id_idx on intelligence_items(company_id);
create index intelligence_items_source_id_idx on intelligence_items(source_id);
create index intelligence_items_change_id_idx on intelligence_items(change_id);
create index intelligence_items_observed_at_idx on intelligence_items(observed_at desc);
create index intelligence_items_category_idx on intelligence_items(category);
create index intelligence_items_topics_gin_idx on intelligence_items using gin(topics);
create index intelligence_items_metadata_gin_idx on intelligence_items using gin(metadata);
create index intelligence_items_embedding_idx
  on intelligence_items
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100)
  where embedding is not null;

create index entities_user_id_idx on entities(user_id);
create index entities_name_idx on entities(name);
create index entities_type_idx on entities(type);
create index entities_metadata_gin_idx on entities using gin(metadata);
create unique index entities_user_type_lower_name_idx on entities(user_id, type, lower(name));

create index entity_relationships_user_id_idx on entity_relationships(user_id);
create index entity_relationships_source_entity_id_idx on entity_relationships(source_entity_id);
create index entity_relationships_target_entity_id_idx on entity_relationships(target_entity_id);
create index entity_relationships_relationship_type_idx on entity_relationships(relationship_type);
create index entity_relationships_observed_at_idx on entity_relationships(observed_at desc);
create index entity_relationships_metadata_gin_idx on entity_relationships using gin(metadata);

create index intelligence_item_entities_user_id_idx on intelligence_item_entities(user_id);
create index intelligence_item_entities_intelligence_item_id_idx on intelligence_item_entities(intelligence_item_id);
create index intelligence_item_entities_entity_id_idx on intelligence_item_entities(entity_id);
create unique index intelligence_item_entities_item_entity_idx
  on intelligence_item_entities(intelligence_item_id, entity_id);

create or replace function search_intelligence_items(
  query_embedding vector(1536),
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
  similarity double precision
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
    1 - (intelligence_items.embedding <=> query_embedding) as similarity
  from intelligence_items
  where intelligence_items.user_id = auth.uid()
    and intelligence_items.embedding is not null
  order by intelligence_items.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 10), 100));
$$;
