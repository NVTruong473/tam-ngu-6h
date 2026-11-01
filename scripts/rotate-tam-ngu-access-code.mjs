import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) throw new Error("Thiếu SUPABASE_PROJECT_REF.");

const accessCode = String(randomInt(10_000_000, 100_000_000));
const token = execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"], { encoding: "utf8" }).trim();
const temporaryDirectory = mkdtempSync(join(tmpdir(), "tam-ngu-access-"));
const envFile = join(temporaryDirectory, "access.env");

try {
  writeFileSync(envFile, `TAM_NGU_INVITE_CODE=${accessCode}\n`, { encoding: "utf8", mode: 0o600 });
  execFileSync(
    "npx",
    ["--yes", "supabase@latest", "secrets", "set", "--env-file", envFile, "--project-ref", ref],
    { stdio: "inherit", env: { ...process.env, SUPABASE_ACCESS_TOKEN: token } },
  );
  execFileSync("security", [
    "add-generic-password",
    "-U",
    "-a", "NVTruong473",
    "-s", "TamNgu6H Invite",
    "-w", accessCode,
  ]);
  execFileSync("pbcopy", [], { input: accessCode });
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

process.stdout.write(`Đã tạo, cấu hình và chép mã mở Tra nhanh vào clipboard: ${accessCode}\n`);
