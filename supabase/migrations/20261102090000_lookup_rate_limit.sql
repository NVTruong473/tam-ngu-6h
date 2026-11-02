create table if not exists public.tam_ngu_lookup_usage (
  id bigint generated always as identity primary key,
  request_id uuid not null,
  scope text not null check (scope in ('device', 'network')),
  subject_hash text not null check (length(subject_hash) = 64),
  requested_at timestamptz not null default now()
);

create index if not exists idx_tam_ngu_lookup_usage_subject
  on public.tam_ngu_lookup_usage (scope, subject_hash, requested_at desc);

create index if not exists idx_tam_ngu_lookup_usage_time
  on public.tam_ngu_lookup_usage (requested_at);

alter table public.tam_ngu_lookup_usage enable row level security;
revoke all on table public.tam_ngu_lookup_usage from anon, authenticated;
grant all on table public.tam_ngu_lookup_usage to service_role;

create or replace function public.tam_ngu_take_lookup_quota(
  p_request_id uuid,
  p_device_hash text,
  p_network_hash text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_device_minute integer;
  v_device_ten_minutes integer;
  v_device_day integer;
  v_network_minute integer;
  v_network_ten_minutes integer;
  v_network_day integer;
begin
  if p_request_id is null or length(p_device_hash) <> 64 or length(p_network_hash) <> 64 then
    raise exception 'invalid lookup quota identity';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_device_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_network_hash, 1));
  delete from public.tam_ngu_lookup_usage where requested_at < v_now - interval '2 days';

  select
    count(*) filter (where requested_at >= v_now - interval '1 minute'),
    count(*) filter (where requested_at >= v_now - interval '10 minutes'),
    count(*) filter (where requested_at >= v_now - interval '24 hours')
  into v_device_minute, v_device_ten_minutes, v_device_day
  from public.tam_ngu_lookup_usage
  where scope = 'device' and subject_hash = p_device_hash;

  select
    count(*) filter (where requested_at >= v_now - interval '1 minute'),
    count(*) filter (where requested_at >= v_now - interval '10 minutes'),
    count(*) filter (where requested_at >= v_now - interval '24 hours')
  into v_network_minute, v_network_ten_minutes, v_network_day
  from public.tam_ngu_lookup_usage
  where scope = 'network' and subject_hash = p_network_hash;

  if v_device_minute >= 8 or v_network_minute >= 30 then
    return jsonb_build_object('allowed', false, 'retry_after_seconds', 60);
  end if;
  if v_device_ten_minutes >= 30 or v_network_ten_minutes >= 120 then
    return jsonb_build_object('allowed', false, 'retry_after_seconds', 600);
  end if;
  if v_device_day >= 120 or v_network_day >= 600 then
    return jsonb_build_object('allowed', false, 'retry_after_seconds', 3600);
  end if;

  insert into public.tam_ngu_lookup_usage (request_id, scope, subject_hash, requested_at)
  values
    (p_request_id, 'device', p_device_hash, v_now),
    (p_request_id, 'network', p_network_hash, v_now);

  return jsonb_build_object(
    'allowed', true,
    'daily_remaining', greatest(0, 119 - v_device_day)
  );
end;
$$;

revoke all on function public.tam_ngu_take_lookup_quota(uuid, text, text) from public, anon, authenticated;
grant execute on function public.tam_ngu_take_lookup_quota(uuid, text, text) to service_role;
notify pgrst, 'reload schema';
