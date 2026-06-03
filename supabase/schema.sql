create extension if not exists pgcrypto;

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan text default 'free',
  created_at timestamptz default now()
);

create table competitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  website text,
  created_at timestamptz default now()
);

create table monitored_sources (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid not null references competitors(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('website','pricing','docs','changelog','github')),
  url text not null,
  active boolean default true,
  last_checked_at timestamptz,
  created_at timestamptz default now()
);

create table snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references monitored_sources(id) on delete cascade,
  content_hash text not null,
  raw_text text not null,
  created_at timestamptz default now()
);

create table changes (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references monitored_sources(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_snapshot_id uuid references snapshots(id) on delete set null,
  current_snapshot_id uuid references snapshots(id) on delete set null,
  summary text not null,
  diff_excerpt text,
  importance_score int default 3,
  emailed_at timestamptz,
  created_at timestamptz default now()
);

alter table competitors enable row level security;
alter table monitored_sources enable row level security;
alter table snapshots enable row level security;
alter table changes enable row level security;

create policy "competitors owned by user" on competitors for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sources owned by user" on monitored_sources for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "changes owned by user" on changes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "snapshots readable via source ownership" on snapshots for select using (
  exists (select 1 from monitored_sources s where s.id = snapshots.source_id and s.user_id = auth.uid())
);
