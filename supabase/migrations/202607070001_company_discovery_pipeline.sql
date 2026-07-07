create table if not exists company_candidates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  domain text not null,
  website text not null,
  discovery_source text not null,
  confidence_score numeric(4,3) not null default 0,
  status text not null default 'pending' check (status in ('pending', 'promoted', 'ignored', 'rejected')),
  evidence jsonb not null default '{}'::jsonb,
  promoted_competitor_id uuid references competitors(id) on delete set null,
  promoted_at timestamptz,
  discovered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_user_id, domain)
);

create table if not exists source_candidates (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  company_candidate_id uuid not null references company_candidates(id) on delete cascade,
  type text not null,
  url text not null,
  confidence_score numeric(4,3) not null default 0,
  health_status text not null default 'unknown' check (health_status in ('healthy', 'unhealthy', 'unknown')),
  last_checked_at timestamptz,
  last_http_status int,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_candidate_id, url)
);

create index if not exists idx_company_candidates_owner_status
  on company_candidates(owner_user_id, status);

create index if not exists idx_company_candidates_discovered_at
  on company_candidates(discovered_at desc);

create index if not exists idx_source_candidates_company
  on source_candidates(company_candidate_id);

create index if not exists idx_source_candidates_health
  on source_candidates(health_status);

create or replace function set_updated_at_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_company_candidates_set_updated_at on company_candidates;
create trigger trg_company_candidates_set_updated_at
before update on company_candidates
for each row
execute procedure set_updated_at_timestamp();

drop trigger if exists trg_source_candidates_set_updated_at on source_candidates;
create trigger trg_source_candidates_set_updated_at
before update on source_candidates
for each row
execute procedure set_updated_at_timestamp();

alter table company_candidates enable row level security;
alter table source_candidates enable row level security;

create policy "company candidates owned by user"
on company_candidates
for all
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);

create policy "source candidates owned by user"
on source_candidates
for all
using (auth.uid() = owner_user_id)
with check (auth.uid() = owner_user_id);