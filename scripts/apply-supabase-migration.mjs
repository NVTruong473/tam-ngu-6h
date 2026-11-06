import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) throw new Error("Thiếu SUPABASE_PROJECT_REF.");

const token = (() => {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  try {
    return execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"], {
      encoding: "utf8",
      timeout: 10_000,
    }).trim();
  } catch {
    throw new Error("Không đọc được Supabase token trong 10 giây. Hãy mở khóa Keychain hoặc đặt SUPABASE_ACCESS_TOKEN.");
  }
})();
const migrationsDirectory = new URL("../supabase/migrations/", import.meta.url);
const statements = readdirSync(migrationsDirectory)
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort()
  .map((name) => ({ name, query: readFileSync(new URL(name, migrationsDirectory), "utf8") }));

for (const [index, migration] of statements.entries()) {
  let completed = false;
  for (let attempt = 1; attempt <= 2 && !completed; attempt += 1) {
    let response;
    try {
      response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: "POST",
        signal: AbortSignal.timeout(45_000),
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ query: migration.query, read_only: false }),
      });
    } catch (error) {
      if (attempt < 2) continue;
      throw new Error(`Migration ${migration.name} không phản hồi sau 2 lần thử: ${error instanceof Error ? error.message : "không rõ lỗi"}`);
    }
    if (response.ok) {
      completed = true;
      process.stdout.write(`✓ ${migration.name} (${index + 1}/${statements.length})\n`);
      continue;
    }
    const result = await response.json().catch(() => ({}));
    if ((response.status === 429 || response.status >= 500) && attempt < 2) continue;
    throw new Error(`Migration ${migration.name} (${index + 1}/${statements.length}) HTTP ${response.status}: ${result.message || result.error || "không rõ lỗi"}`);
  }
}

process.stdout.write(`Đã áp dụng ${statements.length} migration idempotent theo thứ tự.\n`);
