alter table public.tam_ngu_push_subscriptions
  add column if not exists schedule_times text[] not null default array['06:00', '12:00', '18:00']::text[],
  add column if not exists lesson_cursor bigint,
  add column if not exists last_dispatch_key text;

comment on column public.tam_ngu_push_subscriptions.schedule_times is 'Sorted local HH:MM notification times, 1 to 24 entries.';
comment on column public.tam_ngu_push_subscriptions.lesson_cursor is 'Next curriculum item to send for this device.';
comment on column public.tam_ngu_push_subscriptions.last_dispatch_key is 'Local date and minute most recently dispatched, used for idempotency.';

notify pgrst, 'reload schema';
