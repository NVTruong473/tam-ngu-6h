import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ref = process.env.SUPABASE_PROJECT_REF;
const sourcePath = process.env.API_KEYS_FILE;
const repository = process.env.GITHUB_REPOSITORY;
if (!ref) throw new Error("Thiếu SUPABASE_PROJECT_REF.");
if (!sourcePath) throw new Error("Thiếu API_KEYS_FILE chứa các GEMINI_API_KEY.");

const sourceFile = statSync(sourcePath).isDirectory() ? join(sourcePath, "TXT.rtf") : sourcePath;
const source = sourceFile.endsWith(".rtf")
  ? execFileSync("textutil", ["-convert", "txt", "-stdout", sourceFile], { encoding: "utf8" })
  : readFileSync(sourceFile, "utf8");
const keys = [...source.matchAll(/^\s*export\s+GEMINI_API_KEY(?:_\d+)?\s*=\s*[\"']?([^\"'\s]+)[\"']?\s*$/gm)]
  .map((match) => match[1])
  .filter(Boolean);
if (keys.length === 0) throw new Error("Không tìm thấy GEMINI_API_KEY trong API_KEYS_FILE.");

const token = execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"], { encoding: "utf8" }).trim();
const temporaryDirectory = mkdtempSync(join(tmpdir(), "tam-ngu-supabase-"));
const envFile = join(temporaryDirectory, "lookup.env");

try {
  // The file exists only while the CLI transmits the server-only secret, then is removed.
  writeFileSync(envFile, `GEMINI_API_KEYS=${keys.join(",")}\n`, { encoding: "utf8", mode: 0o600 });
  execFileSync(
    "npx",
    ["--yes", "supabase@latest", "secrets", "set", "--env-file", envFile, "--project-ref", ref],
    { stdio: "inherit", env: { ...process.env, SUPABASE_ACCESS_TOKEN: token } },
  );
  if (repository) {
    execFileSync(
      "gh",
      ["secret", "set", "GEMINI_API_KEYS", "--repo", repository],
      { input: keys.join(","), stdio: ["pipe", "inherit", "inherit"] },
    );
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

process.stdout.write(`Đã cấu hình ${keys.length} khóa Gemini ở Supabase${repository ? " và GitHub Actions" : ""}; không in giá trị key.\n`);
