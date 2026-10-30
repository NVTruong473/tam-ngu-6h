-- Không dán cron secret vào SQL Editor hoặc commit nó vào Git.
-- Trong môi trường dự án, dùng:
--   SUPABASE_PROJECT_REF=<project-ref> node scripts/configure-supabase-cron.mjs
-- Script lưu/đọc secret qua Supabase Vault và tạo ba lịch bên dưới.
-- Các giờ là UTC: 23:00, 05:00, 11:00 = 06:00, 12:00, 18:00 ở Việt Nam.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.schedule(
  'tam-ngu-morning',
  '0 23 * * *',
  $$select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/tam-ngu-api/dispatch',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tam_ngu_cron_secret')),
    body := '{"phase":"morning"}'::jsonb
  );$$
);

select cron.schedule(
  'tam-ngu-noon',
  '0 5 * * *',
  $$select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/tam-ngu-api/dispatch',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tam_ngu_cron_secret')),
    body := '{"phase":"noon"}'::jsonb
  );$$
);

select cron.schedule(
  'tam-ngu-evening',
  '0 11 * * *',
  $$select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/tam-ngu-api/dispatch',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tam_ngu_cron_secret')),
    body := '{"phase":"evening"}'::jsonb
  );$$
);
