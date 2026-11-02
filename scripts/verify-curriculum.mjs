import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// This is deliberately a deterministic gate. It can prove the data shape,
// language-script boundaries, duplicate protection, and tone-marker alignment;
// it cannot certify that a sentence is idiomatic. The Gemini review pass in the
// generator remains the semantic/grammar safeguard for newly created lessons.
const destination = resolve("app/curriculum.json");
const curriculum = JSON.parse(readFileSync(destination, "utf8"));

const kinds = ["sentence", "message", "dialogue"];
const requiredLessonFields = ["id", "stage", "kind", "title", "context", "lines", "note", "challenge"];
const advancedFields = ["grammarFocus", "vocabulary", "wish", "nightWish"];
const textFields = ["stage", "title", "context", "note", "challenge"];
const lineTextFields = ["speaker", "english", "chinese", "pinyin", "vietnameseReading", "vietnamese"];
const notificationLimits = { english: 39, chinese: 16, vietnamese: 42 };
const PINYIN_TONE_MARKS = new Set(["ā", "á", "ǎ", "à", "ē", "é", "ě", "è", "ī", "í", "ǐ", "ì", "ō", "ó", "ǒ", "ò", "ū", "ú", "ǔ", "ù", "ǖ", "ǘ", "ǚ", "ǜ", "Ā", "Á", "Ǎ", "À", "Ē", "É", "Ě", "È", "Ī", "Í", "Ǐ", "Ì", "Ō", "Ó", "Ǒ", "Ò", "Ū", "Ú", "Ǔ", "Ù", "Ǖ", "Ǘ", "Ǚ", "Ǜ"]);
const VIETNAMESE_SOUND_MARK = /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu;
const MARKUP_OR_CONTROL = /[<>`\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;
const PINYIN_DIGRAPH = /(?:^|[^\p{L}])(?:sh|zh)[a-z]+/iu;

const failures = [];
const addFailure = (message) => failures.push(message);
const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function normalized(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("vi")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function toneCount(value) {
  return [...value].filter((character) => PINYIN_TONE_MARKS.has(character)).length;
}

function assertText(value, label, minimumLength = 1) {
  if (typeof value !== "string" || value.trim().length < minimumLength) {
    addFailure(`${label}: thiếu văn bản hợp lệ.`);
    return false;
  }
  if (MARKUP_OR_CONTROL.test(value)) {
    addFailure(`${label}: không được chứa markup, backtick hoặc ký tự điều khiển.`);
    return false;
  }
  return true;
}

function assertVietnameseReading(value, pinyin, label) {
  if (!assertText(value, `${label} / cách đọc gần Việt`, 3)) return;
  if (/\p{Script=Han}/u.test(value)) addFailure(`${label}: cách đọc gần Việt không được chứa chữ Hán.`);
  if (!VIETNAMESE_SOUND_MARK.test(value)) addFailure(`${label}: cách đọc gần Việt thiếu dấu/chữ gợi âm Việt.`);
  if (/[fjwz]/iu.test(value) || PINYIN_DIGRAPH.test(value)) {
    addFailure(`${label}: cách đọc gần Việt còn lẫn ký hiệu pinyin/Anh.`);
  }
  if (/\((?![1-4]\))[^)]*\)|\([^)]*$/u.test(value)) addFailure(`${label}: marker thanh phải là (1), (2), (3) hoặc (4).`);

  const expectedTones = toneCount(pinyin);
  const suppliedTones = (value.match(/\([1-4]\)/g) ?? []).length;
  if (expectedTones === 0) addFailure(`${label}: pinyin không có dấu thanh để đối chiếu.`);
  if (expectedTones !== suppliedTones) {
    addFailure(`${label}: số thanh pinyin (${expectedTones}) không khớp số marker đọc gần Việt (${suppliedTones}).`);
  }
}

if (!Array.isArray(curriculum) || curriculum.length === 0) {
  addFailure("Giáo trình phải là một mảng có ít nhất một bài.");
}

const seenIds = new Set();
const seenTitles = new Set();
const seenEnglish = new Set();
const seenChinese = new Set();
const seenWishes = new Set();
const seenNightWishes = new Set();

for (const [lessonIndex, lesson] of (Array.isArray(curriculum) ? curriculum : []).entries()) {
  const location = `Bài ${lessonIndex + 1}`;
  if (!lesson || typeof lesson !== "object" || Array.isArray(lesson)) {
    addFailure(`${location}: không phải object bài học.`);
    continue;
  }

  for (const field of requiredLessonFields) {
    if (!hasOwn(lesson, field)) addFailure(`${location}: thiếu trường ${field}.`);
  }

  const idMatch = typeof lesson.id === "string" && /^lesson-(\d{3,})$/.exec(lesson.id);
  if (!idMatch) {
    addFailure(`${location}: id phải có dạng lesson-001.`);
  } else {
    const ordinal = Number(idMatch[1]);
    if (ordinal !== lessonIndex + 1) addFailure(`${lesson.id}: id phải liên tiếp theo vị trí bài học.`);
    if (seenIds.has(lesson.id)) addFailure(`${lesson.id}: id bị trùng.`);
    seenIds.add(lesson.id);
  }
  const lessonId = typeof lesson.id === "string" ? lesson.id : location;

  if (!lesson.notification || typeof lesson.notification !== "object" || Array.isArray(lesson.notification)) {
    addFailure(`${lessonId}: thiếu notification gọn cho Màn hình khóa.`);
  } else {
    for (const [field, maximum] of Object.entries(notificationLimits)) {
      if (assertText(lesson.notification[field], `${lessonId} / notification.${field}`, 3)
        && [...lesson.notification[field]].length > maximum) {
        addFailure(`${lessonId}: notification.${field} vượt ${maximum} ký tự.`);
      }
    }
    if (!/\p{Script=Latin}/u.test(lesson.notification.english ?? "") || /\p{Script=Han}/u.test(lesson.notification.english ?? "")) {
      addFailure(`${lessonId}: notification English sai hệ chữ.`);
    }
    if (!/\p{Script=Han}/u.test(lesson.notification.chinese ?? "") || /[A-Za-z]/u.test(lesson.notification.chinese ?? "")) {
      addFailure(`${lessonId}: notification Chinese sai hệ chữ.`);
    }
    if (!/\p{Script=Latin}/u.test(lesson.notification.vietnamese ?? "") || /\p{Script=Han}/u.test(lesson.notification.vietnamese ?? "")) {
      addFailure(`${lessonId}: notification Vietnamese sai hệ chữ.`);
    }
  }

  for (const field of textFields) assertText(lesson[field], `${lessonId} / ${field}`, 3);
  if (!kinds.includes(lesson.kind)) addFailure(`${lessonId}: kind phải là sentence, message hoặc dialogue.`);
  const expectedKind = kinds[lessonIndex % kinds.length];
  if (lesson.kind && lesson.kind !== expectedKind) addFailure(`${lessonId}: kind không đúng nhịp sentence → message → dialogue.`);

  const normalizedTitle = normalized(lesson.title);
  if (normalizedTitle) {
    if (seenTitles.has(normalizedTitle)) addFailure(`${lessonId}: tiêu đề bị trùng.`);
    seenTitles.add(normalizedTitle);
  }

  if (!Array.isArray(lesson.lines)) {
    addFailure(`${lessonId}: lines phải là mảng.`);
  } else {
    const validLineCounts = lesson.kind === "dialogue" ? [3, 4] : [1];
    if (!validLineCounts.includes(lesson.lines.length)) {
      addFailure(`${lessonId}: ${lesson.kind || "bài"} có số dòng không hợp lệ.`);
    }

    for (const [lineIndex, line] of lesson.lines.entries()) {
      const lineLabel = `${lessonId}, dòng ${lineIndex + 1}`;
      if (!line || typeof line !== "object" || Array.isArray(line)) {
        addFailure(`${lineLabel}: không phải object dòng học.`);
        continue;
      }
      for (const field of lineTextFields) assertText(line[field], `${lineLabel} / ${field}`);

      if (!/\p{Script=Latin}/u.test(line.english ?? "") || /\p{Script=Han}/u.test(line.english ?? "")) {
        addFailure(`${lineLabel}: English phải có chữ Latin và không có chữ Hán.`);
      }
      if (!/\p{Script=Han}/u.test(line.chinese ?? "") || /[A-Za-z]/.test(line.chinese ?? "")) {
        addFailure(`${lineLabel}: Chinese phải có chữ Hán và không chèn chữ Latin.`);
      }
      if (!/\p{Script=Latin}/u.test(line.pinyin ?? "") || /\p{Script=Han}/u.test(line.pinyin ?? "")) {
        addFailure(`${lineLabel}: pinyin phải có chữ Latin và không có chữ Hán.`);
      }
      if (!/\p{Script=Latin}/u.test(line.vietnamese ?? "") || /\p{Script=Han}/u.test(line.vietnamese ?? "")) {
        addFailure(`${lineLabel}: bản dịch Việt không hợp lệ.`);
      }
      assertVietnameseReading(line.vietnameseReading, line.pinyin ?? "", lineLabel);

      if (lesson.kind === "dialogue") {
        const expectedSpeaker = lineIndex % 2 === 0 ? "A" : "B";
        if (String(line.speaker ?? "").trim().toUpperCase() !== expectedSpeaker) {
          addFailure(`${lineLabel}: hội thoại phải luân phiên speaker ${expectedSpeaker}.`);
        }
      }

      const english = normalized(line.english);
      const chinese = normalized(line.chinese);
      if (english) {
        if (seenEnglish.has(english)) addFailure(`${lineLabel}: câu tiếng Anh bị trùng.`);
        seenEnglish.add(english);
      }
      if (chinese) {
        if (seenChinese.has(chinese)) addFailure(`${lineLabel}: câu tiếng Trung bị trùng.`);
        seenChinese.add(chinese);
      }
    }
  }

  const usesAdvancedFields = advancedFields.some((field) => hasOwn(lesson, field));
  if (usesAdvancedFields) {
    for (const field of advancedFields) {
      if (!hasOwn(lesson, field)) addFailure(`${lessonId}: bài có metadata mở rộng nhưng thiếu ${field}.`);
    }
    assertText(lesson.grammarFocus, `${lessonId} / grammarFocus`, 8);
    assertText(lesson.wish, `${lessonId} / wish`, 12);
    assertText(lesson.nightWish, `${lessonId} / nightWish`, 12);
    for (const [field, value, seen] of [["wish", lesson.wish, seenWishes], ["nightWish", lesson.nightWish, seenNightWishes]]) {
      const key = normalized(value);
      if (key) {
        if (seen.has(key)) addFailure(`${lessonId}: ${field} bị trùng nguyên văn.`);
        seen.add(key);
      }
    }
    if (!Array.isArray(lesson.vocabulary) || lesson.vocabulary.length < 3 || lesson.vocabulary.length > 7) {
      addFailure(`${lessonId}: vocabulary phải có từ 3 đến 7 mục.`);
    } else {
      for (const [vocabularyIndex, entry] of lesson.vocabulary.entries()) {
        if (!assertText(entry, `${lessonId} / vocabulary ${vocabularyIndex + 1}`, 5)) continue;
        const parts = entry.split("·").map((part) => part.trim()).filter(Boolean);
        if (parts.length !== 3
          || !/\p{Script=Latin}/u.test(parts[0] ?? "")
          || /\p{Script=Han}/u.test(parts[0] ?? "")
          || !/\p{Script=Han}/u.test(parts[1] ?? "")
          || /[A-Za-z]/u.test(parts[1] ?? "")
          || !/\p{Script=Latin}/u.test(parts[2] ?? "")
          || /\p{Script=Han}/u.test(parts[2] ?? "")) {
          addFailure(`${lessonId} / vocabulary ${vocabularyIndex + 1}: phải có English · 中文 · nghĩa Việt.`);
        }
      }
    }
  }

  const hasGeneratedAt = hasOwn(lesson, "generatedAt");
  const hasGenerator = hasOwn(lesson, "generator");
  if (hasGeneratedAt !== hasGenerator) addFailure(`${lessonId}: metadata generatedAt và generator phải đi cùng nhau.`);
  if (hasGeneratedAt) {
    if (Number.isNaN(Date.parse(lesson.generatedAt))) addFailure(`${lessonId}: generatedAt không phải thời điểm ISO hợp lệ.`);
    assertText(lesson.generator, `${lessonId} / generator`, 3);
    if (!usesAdvancedFields) addFailure(`${lessonId}: bài được tạo tự động phải có metadata học mở rộng.`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`Giáo trình không qua ${failures.length} kiểm tra xác định:\n`);
  for (const failure of failures.slice(0, 40)) process.stderr.write(`- ${failure}\n`);
  if (failures.length > 40) process.stderr.write(`- … và ${failures.length - 40} lỗi khác.\n`);
  process.exitCode = 1;
} else {
  const lineCount = curriculum.reduce((sum, lesson) => sum + lesson.lines.length, 0);
  process.stdout.write(`Đã kiểm tra ${curriculum.length} bài / ${lineCount} dòng: dữ liệu cấu trúc hợp lệ.\n`);
}
