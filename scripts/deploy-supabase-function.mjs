import { execFileSync } from "node:child_process";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) throw new Error("Thiếu SUPABASE_PROJECT_REF.");

const token = execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"], { encoding: "utf8" }).trim();
execFileSync(
  "npx",
  ["--yes", "supabase@latest", "functions", "deploy", "tam-ngu-api", "--project-ref", ref, "--no-verify-jwt", "--use-api"],
  { stdio: "inherit", env: { ...process.env, SUPABASE_ACCESS_TOKEN: token } },
);

process.stdout.write("Đã triển khai tam-ngu-api.\n");
