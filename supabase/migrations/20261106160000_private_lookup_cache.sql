create table if not exists public.tam_ngu_lookup_cache (
  query_hash text primary key check (length(query_hash) = 64),
  encrypted_result text not null check (octet_length(encrypted_result) between 32 and 16384),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_accessed_at timestamptz not null default now(),
  hit_count bigint not null default 0 check (hit_count >= 0)
);

create index if not exists idx_tam_ngu_lookup_cache_expiry
  on public.tam_ngu_lookup_cache (expires_at);

create index if not exists idx_tam_ngu_lookup_cache_lru
  on public.tam_ngu_lookup_cache (last_accessed_at desc);

comment on table public.tam_ngu_lookup_cache is
  'Bounded seven-day lookup cache. Query keys are HMACs and results are AES-GCM ciphertext; no plaintext user query is stored.';

alter table public.tam_ngu_lookup_cache enable row level security;
revoke all on table public.tam_ngu_lookup_cache from public, anon, authenticated;
grant all on table public.tam_ngu_lookup_cache to service_role;

create or replace function public.tam_ngu_get_lookup_cache(p_query_hash text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result text;
begin
  if coalesce(p_query_hash, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid lookup cache key';
  end if;

  update public.tam_ngu_lookup_cache
  set last_accessed_at = now(), hit_count = hit_count + 1
  where query_hash = p_query_hash and expires_at > now()
  returning encrypted_result into v_result;

  return v_result;
end;
$$;

create or replace function public.tam_ngu_put_lookup_cache(
  p_query_hash text,
  p_encrypted_result text
) returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(p_query_hash, '') !~ '^[0-9a-f]{64}$'
    or coalesce(octet_length(p_encrypted_result), 0) not between 32 and 16384 then
    raise exception 'invalid lookup cache value';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('tam-ngu-lookup-cache', 0));

  delete from public.tam_ngu_lookup_cache where expires_at <= now();

  insert into public.tam_ngu_lookup_cache (
    query_hash, encrypted_result, created_at, expires_at, last_accessed_at, hit_count
  ) values (
    p_query_hash, p_encrypted_result, now(), now() + interval '7 days', now(), 0
  )
  on conflict (query_hash) do update set
    encrypted_result = excluded.encrypted_result,
    created_at = excluded.created_at,
    expires_at = excluded.expires_at,
    last_accessed_at = excluded.last_accessed_at;

  delete from public.tam_ngu_lookup_cache
  where query_hash in (
    select query_hash
    from public.tam_ngu_lookup_cache
    order by last_accessed_at desc, created_at desc
    offset 2000
  );
end;
$$;

create or replace function public.tam_ngu_lookup_cache_health()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select jsonb_build_object(
    'entries', count(*),
    'active_entries', count(*) filter (where expires_at > now()),
    'total_hits', coalesce(sum(hit_count), 0),
    'maximum_entries', 2000,
    'ttl_days', 7
  )
  from public.tam_ngu_lookup_cache;
$$;

revoke all on function public.tam_ngu_get_lookup_cache(text) from public, anon, authenticated;
revoke all on function public.tam_ngu_put_lookup_cache(text, text) from public, anon, authenticated;
revoke all on function public.tam_ngu_lookup_cache_health() from public, anon, authenticated;
grant execute on function public.tam_ngu_get_lookup_cache(text) to service_role;
grant execute on function public.tam_ngu_put_lookup_cache(text, text) to service_role;
grant execute on function public.tam_ngu_lookup_cache_health() to service_role;

notify pgrst, 'reload schema';
