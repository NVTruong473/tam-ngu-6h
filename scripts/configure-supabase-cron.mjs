import { execFileSync } from "node:child_process";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) throw new Error("Thiếu SUPABASE_PROJECT_REF.");

const token = execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"], { encoding: "utf8" }).trim();
const cronSecret = execFileSync("security", ["find-generic-password", "-s", "TamNgu6H Cron", "-w"], { encoding: "utf8" }).trim();
const endpoint = `https://${ref}.supabase.co/functions/v1/tam-ngu-api/dispatch`;

const statements = [
  { query: "create extension if not exists pg_cron" },
  { query: "create extension if not exists pg_net" },
  { query: "create extension if not exists supabase_vault" },
  {
    query: `select vault.create_secret($1, 'tam_ngu_cron_secret', 'Tam Ngữ Web Push dispatcher')
      where not exists (select 1 from vault.secrets where name = 'tam_ngu_cron_secret')`,
    parameters: [cronSecret],
  },
  {
    query: `select vault.update_secret(
      secret_id := (select id from vault.secrets where name = 'tam_ngu_cron_secret'),
      new_secret := $1,
      new_name := 'tam_ngu_cron_secret',
      new_description := 'Tam Ngữ Web Push dispatcher',
      new_key_id := null
    )`,
    parameters: [cronSecret],
  },
  {
    query: `select cron.unschedule(jobid)
      from cron.job
      where jobname in ('tam-ngu-morning', 'tam-ngu-noon', 'tam-ngu-evening')`,
  },
  {
    query: `select cron.schedule(
  'tam-ngu-morning',
  '0 23 * * *',
  $job$select net.http_post(
    url := '${endpoint}',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tam_ngu_cron_secret')
    ),
    body := '{"phase":"morning"}'::jsonb
  );$job$
);`,
  },
  {
    query: `select cron.schedule(
  'tam-ngu-noon',
  '0 5 * * *',
  $job$select net.http_post(
    url := '${endpoint}',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tam_ngu_cron_secret')
    ),
    body := '{"phase":"noon"}'::jsonb
  );$job$
);`,
  },
  {
    query: `select cron.schedule(
  'tam-ngu-evening',
  '0 11 * * *',
  $job$select net.http_post(
    url := '${endpoint}',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'tam_ngu_cron_secret')
    ),
    body := '{"phase":"evening"}'::jsonb
  );$job$
);`,
  },
];

for (const [index, statement] of statements.entries()) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ ...statement, read_only: false }),
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(
      `Supabase statement ${index + 1} HTTP ${response.status}: ${result.message || result.error || "không rõ lỗi"}`,
    );
  }
}

process.stdout.write("Đã cấu hình ba lịch Web Push trong Supabase Cron.\n");
