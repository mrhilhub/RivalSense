alter table monitored_sources
  add column if not exists last_status text default 'not_checked';

alter table monitored_sources
  drop constraint if exists monitored_sources_type_check;

alter table monitored_sources
  add constraint monitored_sources_type_check
  check (
    type in (
      'website',
      'pricing',
      'docs',
      'changelog',
      'github',
      'schema',
      'migration',
      'incident',
      'performance',
      'benchmark',
      'release'
    )
  );

alter table monitored_sources
  drop constraint if exists monitored_sources_last_status_check;

alter table monitored_sources
  add constraint monitored_sources_last_status_check
  check (
    last_status in (
      'not_checked',
      'baseline_created',
      'unchanged',
      'changed',
      'error'
    )
  );
