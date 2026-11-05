create table if not exists public.tam_ngu_service_health (
  name text primary key,
  last_seen_at timestamptz not null,
  last_delivery_success_at timestamptz,
  last_delivery_failure_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  constraint tam_ngu_service_health_name check (name in ('dispatch-cron'))
);

comment on table public.tam_ngu_service_health is
  'Private end-to-end heartbeat written only after the scheduled dispatch function completes.';

alter table public.tam_ngu_service_health enable row level security;
alter table public.tam_ngu_service_health
  add column if not exists last_delivery_success_at timestamptz,
  add column if not exists last_delivery_failure_at timestamptz;
revoke all on table public.tam_ngu_service_health from anon, authenticated;
grant all on table public.tam_ngu_service_health to service_role;

insert into public.tam_ngu_service_health (name, last_seen_at, details)
values ('dispatch-cron', now(), '{"source":"bootstrap"}'::jsonb)
on conflict (name) do nothing;
