import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) throw new Error("Thiếu SUPABASE_PROJECT_REF.");

const token = process.env.SUPABASE_ACCESS_TOKEN || execFileSync(
  "security",
  ["find-generic-password", "-s", "Supabase CLI", "-w"],
  { encoding: "utf8", timeout: 5_000 },
).trim();
const lookupRateLimitMigration = readFileSync(new URL("../supabase/migrations/20261102090000_lookup_rate_limit.sql", import.meta.url), "utf8");
const pushInstallDedupeMigration = readFileSync(new URL("../supabase/migrations/20261102103000_push_install_dedupe.sql", import.meta.url), "utf8");
const dispatchHeartbeatMigration = readFileSync(new URL("../supabase/migrations/20261106143000_dispatch_heartbeat.sql", import.meta.url), "utf8");
const statements = [
  `create table if not exists public.tam_ngu_push_subscriptions (
    endpoint text primary key,
    subscription jsonb not null,
    timezone text not null default 'Asia/Ho_Chi_Minh',
    routine_start_sequence bigint not null,
    enabled boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    last_sent_at timestamptz,
    last_error text
  )`,
  `create index if not exists idx_tam_ngu_push_enabled
    on public.tam_ngu_push_subscriptions (enabled, updated_at desc)
    where enabled = true`,
  `alter table public.tam_ngu_push_subscriptions
    add column if not exists schedule_times text[] not null default array['06:00', '12:00', '18:00']::text[],
    add column if not exists lesson_cursor bigint,
    add column if not exists last_dispatch_key text`,
  "comment on table public.tam_ngu_push_subscriptions is 'Isolated private Web Push state for Tam Ngu 6H.'",
  "alter table public.tam_ngu_push_subscriptions enable row level security",
  "revoke all on table public.tam_ngu_push_subscriptions from anon, authenticated",
  "grant all on table public.tam_ngu_push_subscriptions to service_role",
  lookupRateLimitMigration,
  pushInstallDedupeMigration,
  dispatchHeartbeatMigration,
  "notify pgrst, 'reload schema'",
];

for (const [index, query] of statements.entries()) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query, read_only: false }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(`Migration statement ${index + 1} HTTP ${response.status}: ${result.message || result.error || "không rõ lỗi"}`);
  }
}

process.stdout.write("Đã cập nhật Web Push, lịch tùy chỉnh, Tra nhanh và nhịp tim bộ lập lịch.\n");
