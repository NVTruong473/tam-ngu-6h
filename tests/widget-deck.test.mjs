import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("publishes every reviewed lesson to the native Glance Deck feed", async () => {
  const curriculum = JSON.parse(await readFile(new URL("app/curriculum.json", root), "utf8"));
  const feed = JSON.parse(await readFile(new URL("public/widget-lessons.json", root), "utf8"));
  assert.equal(feed.schemaVersion, 1);
  assert.equal(feed.lessons.length, curriculum.length);
  assert.deepEqual(feed.lessons.map((lesson) => lesson.id), curriculum.map((lesson) => lesson.id));
  for (const lesson of feed.lessons) {
    assert.ok(lesson.title && lesson.english && lesson.chinese && lesson.vietnamese);
    assert.deepEqual(Object.keys(lesson), ["id", "title", "english", "chinese", "vietnamese"]);
  }
});

test("keeps the passive deck independent from notification presentation", async () => {
  const widget = await readFile(new URL("ios/App/TamNguWidgets/TamNguWidget.swift", root), "utf8");
  assert.match(widget, /TimelineProvider/);
  assert.match(widget, /\.accessoryRectangular/);
  assert.match(widget, /\.systemMedium/);
  assert.match(widget, /NextGlanceLessonIntent/);
  assert.match(widget, /returnCacheDataElseLoad/);
  assert.match(widget, /for hour in \[6, 12, 18\]/);
  assert.doesNotMatch(widget, /UNUserNotification|showNotification|API_KEY|GEMINI/);
});
