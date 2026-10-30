import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("exports an installable, private-by-default PWA", async () => {
  const [html, manifestText, serviceWorker] = await Promise.all([
    readFile(new URL("dist/client/index.html", root), "utf8"),
    readFile(new URL("dist/client/manifest.webmanifest", root), "utf8"),
    readFile(new URL("dist/client/sw.js", root), "utf8"),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.match(html, /<title>Tâm Ngữ 6H<\/title>/);
  assert.match(html, /Bài mới lúc 06:00, 12:00 và 18:00\./);
  assert.match(html, /noindex, nofollow/);
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.orientation, "portrait");
  assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512"));
  assert.match(serviceWorker, /tam-ngu-6h-v3/);
  assert.match(serviceWorker, /notificationclick/);
});

test("ships a progressive A2-to-B1 curriculum with balanced formats", async () => {
  const curriculum = JSON.parse(await readFile(new URL("app/curriculum.json", root), "utf8"));
  const counts = curriculum.reduce((result, item) => {
    result[item.kind] = (result[item.kind] ?? 0) + 1;
    return result;
  }, {});

  assert.equal(curriculum.length, 90);
  assert.deepEqual(counts, { sentence: 30, message: 30, dialogue: 30 });
  assert.match(curriculum[0].stage, /^A2\.1/);
  assert.match(curriculum.at(-1).stage, /^B1/);
  assert.ok(curriculum.every((item) => item.lines.length >= 1));
  assert.ok(curriculum.every((item) => item.lines.every((line) => line.english && line.chinese && line.pinyin && line.vietnamese)));
});

test("does not embed API credentials in the shipped application", async () => {
  const [page, generator, workflow] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("scripts/generate-curriculum.mjs", root), "utf8"),
    readFile(new URL(".github/workflows/deploy-pages.yml", root), "utf8"),
  ]);
  const source = `${page}\n${generator}\n${workflow}`;

  assert.doesNotMatch(source, /(?:AQ\.|sk-proj-|sk-or-v1-|gsk_|nvapi-)[A-Za-z0-9_-]{8,}/);
  assert.match(generator, /process\.env\.GEMINI_API_KEY/);
  assert.match(workflow, /secrets\.GEMINI_API_KEY/);
});
