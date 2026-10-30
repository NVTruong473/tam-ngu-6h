create table if not exists public.tam_ngu_push_subscriptions (
  endpoint text primary key,
  subscription jsonb not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  routine_start_sequence bigint not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sent_at timestamptz,
  last_error text
);

create index if not exists idx_tam_ngu_push_enabled
on public.tam_ngu_push_subscriptions (enabled, updated_at desc)
where enabled = true;

comment on table public.tam_ngu_push_subscriptions is 'Isolated private Web Push state for Tam Ngu 6H.';

alter table public.tam_ngu_push_subscriptions enable row level security;
revoke all on table public.tam_ngu_push_subscriptions from anon, authenticated;
grant all on table public.tam_ngu_push_subscriptions to service_role;
