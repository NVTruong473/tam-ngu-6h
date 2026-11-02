alter table public.tam_ngu_push_subscriptions
  add column if not exists install_hash text;

create unique index if not exists idx_tam_ngu_push_install_hash
  on public.tam_ngu_push_subscriptions (install_hash)
  where install_hash is not null;

comment on column public.tam_ngu_push_subscriptions.install_hash is
  'Salted installation identifier used only to replace a rotated Push endpoint.';

notify pgrst, 'reload schema';
