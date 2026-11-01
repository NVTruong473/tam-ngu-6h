-- Không dán cron secret vào SQL Editor hoặc commit nó vào Git.
-- Trong môi trường dự án, dùng:
--   SUPABASE_PROJECT_REF=<project-ref> node scripts/configure-supabase-cron.mjs
-- Script lưu/đọc secret qua Supabase Vault và tạo một bộ quét bên dưới.
-- Bộ điều phối chạy mỗi phút và tự so giờ địa phương/lịch riêng của từng thiết bị.
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select cron.schedule(
  'tam-ngu-custom-schedule',
  '* * * * *',
  $$select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/tam-ngu-api/dispatch',
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tam_ngu_cron_secret')),
    body := '{"mode":"due"}'::jsonb
  );$$
);
