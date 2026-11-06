import { readFile, writeFile } from "node:fs/promises";

const source = new URL("../app/curriculum.json", import.meta.url);
const destination = new URL("../public/widget-lessons.json", import.meta.url);
const curriculum = JSON.parse(await readFile(source, "utf8"));

const lessons = curriculum.map((lesson) => ({
  id: lesson.id,
  title: lesson.title,
  english: lesson.notification?.english || lesson.lines?.[0]?.english || "",
  chinese: lesson.notification?.chinese || lesson.lines?.[0]?.chinese || "",
  vietnamese: lesson.notification?.vietnamese || lesson.lines?.[0]?.vietnamese || "",
}));

if (lessons.length < 30 || lessons.some((lesson) => Object.values(lesson).some((value) => typeof value !== "string" || !value.trim()))) {
  throw new Error("Dữ liệu Glance Deck thiếu bài hoặc có trường rỗng.");
}

await writeFile(destination, `${JSON.stringify({ schemaVersion: 1, lessons }, null, 2)}\n`, "utf8");
process.stdout.write(`Đã đồng bộ ${lessons.length} bài cho widget.\n`);
