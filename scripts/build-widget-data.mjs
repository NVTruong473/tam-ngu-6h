import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const curriculum = JSON.parse(readFileSync(resolve("app/curriculum.json"), "utf8"));
const destinationDirectory = resolve("public/widget");
const destination = resolve(destinationDirectory, "lessons.json");

const lessons = curriculum.map((lesson, index) => {
  const line = lesson.lines?.[0] || {};
  return {
    id: lesson.id,
    number: index + 1,
    title: lesson.title,
    english: lesson.notification?.english || line.english || "",
    chinese: lesson.notification?.chinese || line.chinese || "",
    pinyin: line.pinyin || "",
    vietnameseReading: line.vietnameseReading || "",
    vietnamese: lesson.notification?.vietnamese || line.vietnamese || "",
    wish: lesson.wish || "Mỗi ngày thêm một chút nhé.",
  };
});

mkdirSync(destinationDirectory, { recursive: true });
writeFileSync(destination, `${JSON.stringify({ version: 1, lessons }, null, 2)}\n`, "utf8");
process.stdout.write(`Đã tạo dữ liệu cho ${lessons.length} bài trong widget.\n`);
