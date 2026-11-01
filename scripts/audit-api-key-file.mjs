import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const sourcePath = process.env.API_KEYS_FILE;
if (!sourcePath) throw new Error("Thiếu API_KEYS_FILE.");

const sourceFile = statSync(sourcePath).isDirectory() ? join(sourcePath, "TXT.rtf") : sourcePath;
const source = sourceFile.endsWith(".rtf")
  ? execFileSync("textutil", ["-convert", "txt", "-stdout", sourceFile], { encoding: "utf8" })
  : readFileSync(sourceFile, "utf8");

const variables = [...source.matchAll(/^\s*export\s+([A-Z][A-Z0-9_]*)\s*=\s*["']?([^\r\n"']+)/gm)]
  .map((match) => ({ name: match[1], length: match[2].trim().length }))
  .filter((entry) => entry.length > 0);

const providers = {};
for (const entry of variables) {
  const provider = entry.name
    .replace(/_API_KEY(?:_\d+)?$/, "")
    .replace(/_KEY(?:_\d+)?$/, "");
  providers[provider] ||= { variables: 0, minimumLength: Number.POSITIVE_INFINITY, maximumLength: 0 };
  providers[provider].variables += 1;
  providers[provider].minimumLength = Math.min(providers[provider].minimumLength, entry.length);
  providers[provider].maximumLength = Math.max(providers[provider].maximumLength, entry.length);
}

process.stdout.write(`${JSON.stringify({ totalVariables: variables.length, providers }, null, 2)}\n`);
