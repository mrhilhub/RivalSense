alter table competitors
  add column if not exists is_system boolean not null default false;

alter table monitored_sources
  add column if not exists is_system boolean not null default false;

create or replace function prevent_system_competitor_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_system then
    raise exception 'System competitors cannot be deleted';
  end if;

  return old;
end;
$$;

create or replace function prevent_system_source_delete()
returns trigger
language plpgsql
as $$
begin
  if old.is_system then
    raise exception 'System monitored sources cannot be deleted';
  end if;

  return old;
end;
$$;

drop trigger if exists trg_prevent_system_competitor_delete on competitors;
create trigger trg_prevent_system_competitor_delete
before delete on competitors
for each row execute function prevent_system_competitor_delete();

drop trigger if exists trg_prevent_system_source_delete on monitored_sources;
create trigger trg_prevent_system_source_delete
before delete on monitored_sources
for each row execute function prevent_system_source_delete();