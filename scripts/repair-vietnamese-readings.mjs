import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pinyin, pinyin } from "pinyin";

// This is a repair tool, not a runtime dependency. It preserves the existing
// learner-friendly Vietnamese approximations whenever their syllables already
// align with the source. The pinned pinyin dictionary is used only to align
// source pinyin tones to Chinese characters deterministically. Gemini is a
// narrow fallback for the few lines whose source pinyin itself is malformed.
const destination = resolve("app/curriculum.json");
const localKeysFile = process.env.API_KEYS_FILE;
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const requestedLessonId = (process.env.REPAIR_LESSON_ID || "").trim();
const requestedLineIndex = process.env.REPAIR_LINE_INDEX;
const parsedLineIndex = requestedLineIndex === undefined ? undefined : Number(requestedLineIndex);
const dryRun = process.env.REPAIR_DRY_RUN === "1";

if (requestedLineIndex !== undefined && (!Number.isInteger(parsedLineIndex) || parsedLineIndex < 0)) {
  throw new Error("REPAIR_LINE_INDEX phải là chỉ số dòng từ 0 trở lên.");
}

function keysFromLocalFile() {
  if (!localKeysFile) return [];
  const source = readFileSync(localKeysFile, "utf8");
  return [...source.matchAll(/^\s*export\s+GEMINI_API_KEY(?:_\d+)?\s*=\s*["']?([^"'\s]+)["']?\s*$/gm)]
    .map((match) => match[1]);
}

const numberedEnvironmentKeys = Object.entries(process.env)
  .filter(([name, value]) => /^GEMINI_API_KEY_\d+$/.test(name) && value)
  .sort(([first], [second]) => first.localeCompare(second, undefined, { numeric: true }))
  .map(([, value]) => value);
const bundledKeys = (process.env.GEMINI_API_KEYS || "").split(/[\n,]+/).map((value) => value.trim()).filter(Boolean);
const keys = [...new Set([
  process.env.GEMINI_API_KEY,
  ...numberedEnvironmentKeys,
  ...bundledKeys,
  ...keysFromLocalFile(),
].filter(Boolean))];

const curriculum = JSON.parse(readFileSync(destination, "utf8"));
if (!Array.isArray(curriculum) || curriculum.length === 0) throw new Error("Giáo trình hiện tại không hợp lệ.");

const TONE_BY_MARK = new Map([
  ["ā", 1], ["á", 2], ["ǎ", 3], ["à", 4], ["ē", 1], ["é", 2], ["ě", 3], ["è", 4],
  ["ī", 1], ["í", 2], ["ǐ", 3], ["ì", 4], ["ō", 1], ["ó", 2], ["ǒ", 3], ["ò", 4],
  ["ū", 1], ["ú", 2], ["ǔ", 3], ["ù", 4], ["ǖ", 1], ["ǘ", 2], ["ǚ", 3], ["ǜ", 4],
  ["Ā", 1], ["Á", 2], ["Ǎ", 3], ["À", 4], ["Ē", 1], ["É", 2], ["Ě", 3], ["È", 4],
  ["Ī", 1], ["Í", 2], ["Ǐ", 3], ["Ì", 4], ["Ō", 1], ["Ó", 2], ["Ǒ", 3], ["Ò", 4],
  ["Ū", 1], ["Ú", 2], ["Ǔ", 3], ["Ù", 4], ["Ǖ", 1], ["Ǘ", 2], ["Ǚ", 3], ["Ǜ", 4],
]);
const VIETNAMESE_SOUND_MARK = /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu;
const NON_VIETNAMESE_LETTER = /[fjwz]/iu;
const PINYIN_DIGRAPH = /(?:^|[^\p{L}])(?:sh|zh)[a-z]+/iu;
const DIGIT_PINYIN = {
  0: ["ling"],
  1: ["yi", "yao"],
  2: ["er", "liang"],
  3: ["san"],
  4: ["si"],
  5: ["wu"],
  6: ["liu"],
  7: ["qi"],
  8: ["ba"],
  9: ["jiu"],
};
const DIGIT_PINYIN_HINTS = {
  0: ["líng"],
  1: ["yī", "yāo"],
  2: ["èr", "liǎng"],
  3: ["sān"],
  4: ["sì"],
  5: ["wǔ"],
  6: ["liù"],
  7: ["qī"],
  8: ["bā"],
  9: ["jiǔ"],
};

function basePinyinCharacter(value) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[üÜ]/g, "v")
    .toLocaleLowerCase("en-US");
}

function pinyinCharacters(value) {
  return [...String(value || "")]
    .filter((character) => /\p{Script=Latin}/u.test(character))
    .map((character) => ({ base: basePinyinCharacter(character), tone: TONE_BY_MARK.get(character) || 0 }));
}

function plainPinyin(value) {
  return pinyinCharacters(value).map((character) => character.base).join("");
}

function toneCount(value) {
  return [...String(value || "")].filter((character) => TONE_BY_MARK.has(character)).length;
}

function pronunciationUnits(chinese) {
  const units = [];
  for (const character of [...String(chinese || "")]) {
    if (/\p{Script=Han}/u.test(character)) {
      const hints = [...new Set(pinyin(character, { style: Pinyin.STYLE_TONE, heteronym: true })[0] || [])];
      const candidates = [...new Set(hints
        .map(plainPinyin)
        .filter(Boolean))];
      if (candidates.length === 0) throw new Error(`Không đọc được pinyin cho chữ ${character}.`);
      units.push({ source: character, candidates, hints });
    } else if (/^\d$/.test(character)) {
      units.push({ source: character, candidates: DIGIT_PINYIN[character] || [], hints: DIGIT_PINYIN_HINTS[character] || [] });
    }
  }
  return units;
}

function toneSlotsFor(chinese, sourcePinyin) {
  const units = pronunciationUnits(chinese);
  const characters = pinyinCharacters(sourcePinyin);
  const source = characters.map((character) => character.base).join("");
  let cursor = 0;
  const tones = [];

  for (const unit of units) {
    const candidates = [...unit.candidates].sort((first, second) => second.length - first.length);
    let candidate = candidates.find((value) => source.startsWith(value, cursor));
    // The corpus writes erhua contraction such as nǎr, while a one-character
    // dictionary naturally suggests ér. Treat the final r as the child unit.
    if (!candidate) {
      const erhuaCandidate = candidates.find((value) => value.endsWith("er") && source.startsWith("r", cursor));
      if (erhuaCandidate) candidate = "r";
    }
    if (!candidate) {
      throw new Error(`Không thể đối chiếu ${unit.source} với pinyin tại vị trí ${cursor}.`);
    }
    const segment = characters.slice(cursor, cursor + candidate.length);
    tones.push(segment.map((character) => character.tone).find(Boolean) || 0);
    cursor += candidate.length;
  }

  if (cursor !== characters.length) throw new Error("Pinyin còn phần không đối chiếu được với câu Trung.");
  if (tones.filter(Boolean).length !== toneCount(sourcePinyin)) {
    throw new Error("Số thanh sau đối chiếu không khớp pinyin nguồn.");
  }
  return { units, tones };
}

function readingProblems(value, pinyinSource) {
  const problems = [];
  if (typeof value !== "string" || value.trim().length < 3) problems.push("thiếu phiên âm Việt");
  if (/[<>`]/.test(value || "") || /\p{Script=Han}/u.test(value || "")) problems.push("có markup hoặc chữ Hán");
  if (!VIETNAMESE_SOUND_MARK.test(value || "")) problems.push("thiếu dấu/chữ gợi âm Việt");
  if (NON_VIETNAMESE_LETTER.test(value || "") || PINYIN_DIGRAPH.test(value || "")) problems.push("còn lẫn ký hiệu pinyin/Anh");
  if (/\((?![1-4]\))[^)]*\)|\([^)]*$/u.test(value || "")) problems.push("có marker thanh không hợp lệ");

  const expectedTones = toneCount(pinyinSource);
  const suppliedTones = (String(value || "").match(/\([1-4]\)/g) || []).length;
  if (expectedTones === 0) problems.push("pinyin không có dấu thanh");
  if (expectedTones !== suppliedTones) problems.push(`số thanh ${suppliedTones}/${expectedTones} không khớp`);
  return problems;
}

function tokenizeReading(value) {
  return String(value || "")
    .replace(/\([^)]*\)/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function renderReading(tokens, tones) {
  if (tokens.length !== tones.length) throw new Error("Số âm gợi đọc không khớp số đơn vị phát âm.");
  return tokens.map((token, index) => {
    const trailing = token.match(/[,.;:!?，。！？'’”]+$/u)?.[0] || "";
    const body = trailing ? token.slice(0, -trailing.length) : token;
    return `${body}${tones[index] ? `(${tones[index]})` : ""}${trailing}`;
  }).join(" ");
}

function findRepairTargets() {
  const targets = [];
  for (const lesson of curriculum) {
    if (requestedLessonId && lesson.id !== requestedLessonId) continue;
    for (const [index, line] of lesson.lines.entries()) {
      if (parsedLineIndex !== undefined && index !== parsedLineIndex) continue;
      const problems = readingProblems(line.vietnameseReading, line.pinyin);
      if (problems.length > 0) targets.push({ lesson, line, index, problems });
    }
  }
  if (requestedLessonId && !curriculum.some((lesson) => lesson.id === requestedLessonId)) throw new Error(`Không tìm thấy ${requestedLessonId}.`);
  return targets;
}

function fallbackSchema(unitCount) {
  return {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      index: { type: "INTEGER" },
      pinyin: { type: "STRING" },
      readings: {
        type: "ARRAY",
        minItems: unitCount,
        maxItems: unitCount,
        items: {
          type: "OBJECT",
          properties: { source: { type: "STRING" }, reading: { type: "STRING" } },
          required: ["source", "reading"],
        },
      },
    },
    required: ["id", "index", "pinyin", "readings"],
  };
}

function fallbackPrompt(target, units, reason) {
  return [
    "Bạn là giáo viên phát âm Quan thoại cho người Việt, đang sửa một dòng dữ liệu bị lỗi.",
    "Trả về đúng JSON theo schema; không giải thích, không markdown.",
    "Câu Trung là nguồn chuẩn. Pinyin hiện có có thể sai/thiếu: hãy trả pinyin có dấu thanh chính xác cho đúng câu Trung, gồm cả chữ số được đọc trong câu.",
    "dictionaryPinyinHints là gợi ý theo từng ký tự để phát hiện lỗi chính tả pinyin; dùng ngữ cảnh để chọn thanh biến điệu khi cần, nhưng đừng giữ một pinyin cũ nếu nó trái với gợi ý này.",
    "readings phải có đúng một mục cho mỗi source trong danh sách và theo đúng thứ tự. reading là gợi âm Việt cho đúng một âm tiết: không chữ Hán, pinyin nguyên dạng, số, ngoặc, markdown, f/j/w/z, đầu sh.../zh... hay khoảng trắng.",
    "Đây không phải pinyin bỏ dấu: dùng chữ/dấu Việt khi hợp lý. Các chuỗi kiểu bao/yi/si/wo/chi là không đạt; ví dụ 不 có thể gợi “pu”, 好 “hảo”, 意 “ý”, 思 “sư”. Hãy giữ phong cách gợi âm của currentVietnameseReading nếu nó hữu ích.",
    "Không tự thêm/bỏ source. Số thanh sẽ được chương trình suy ra từ pinyin đã sửa, nên không ghi marker thanh vào reading.",
    `Lý do cần sửa: ${reason}`,
    "Nguồn:",
    JSON.stringify({
      id: target.lesson.id,
      index: target.index,
      chinese: target.line.chinese,
      currentPinyin: target.line.pinyin,
      currentVietnameseReading: target.line.vietnameseReading,
      sourcesInOrder: units.map((unit) => unit.source),
      dictionaryPinyinHints: units.map((unit) => ({ source: unit.source, options: unit.hints })),
    }, null, 2),
  ].join("\n");
}

async function callGemini(prompt, responseSchema, targetIndex) {
  if (keys.length === 0) throw new Error("Thiếu Gemini key cho các dòng pinyin cần sửa thủ công.");
  let lastError;
  for (let offset = 0; offset < keys.length; offset += 1) {
    const keyIndex = (targetIndex + offset) % keys.length;
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: { "content-type": "application/json", "x-goog-api-key": keys[keyIndex] },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.08, responseMimeType: "application/json", responseSchema },
        }),
      });
      if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
      const responseBody = await response.json();
      const text = responseBody.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini không trả về nội dung.");
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      process.stderr.write(`Gemini, khóa ${keyIndex + 1}/${keys.length} chưa dùng được: ${error.message}\n`);
    }
  }
  throw lastError ?? new Error("Không gọi được Gemini.");
}

function validateFallback(result, target, units) {
  if (!result || typeof result !== "object") throw new Error("Gemini không trả object phiên âm.");
  if (result.id !== target.lesson.id || result.index !== target.index) throw new Error("Gemini trả sai id hoặc index dòng.");
  if (typeof result.pinyin !== "string" || result.pinyin.trim().length < 3 || /[<>`\p{Script=Han}]/u.test(result.pinyin)) {
    throw new Error("Gemini trả pinyin không hợp lệ.");
  }
  const alignment = toneSlotsFor(target.line.chinese, result.pinyin);
  if (alignment.units.length !== units.length || alignment.units.some((unit, index) => unit.source !== units[index].source)) {
    throw new Error("Pinyin sửa lại không khớp đơn vị phát âm của câu Trung.");
  }
  if (!Array.isArray(result.readings) || result.readings.length !== units.length) {
    throw new Error("Gemini không trả đủ cách đọc theo đơn vị phát âm.");
  }
  const tokens = result.readings.map((item, index) => {
    if (!item || item.source !== units[index].source || typeof item.reading !== "string") {
      throw new Error(`Cách đọc thứ ${index + 1} không khớp nguồn.`);
    }
    const reading = item.reading.trim();
    if (!reading || /\s|[()\d<>`]/.test(reading) || /\p{Script=Han}/u.test(reading) || NON_VIETNAMESE_LETTER.test(reading) || PINYIN_DIGRAPH.test(reading)) {
      throw new Error(`Cách đọc thứ ${index + 1} không phải gợi âm Việt sạch.`);
    }
    return reading;
  });
  const vietnameseReading = renderReading(tokens, alignment.tones);
  const problems = readingProblems(vietnameseReading, result.pinyin);
  if (problems.length > 0) throw new Error(`Phiên âm ghép không qua kiểm tra: ${problems.join("; ")}.`);
  return { pinyin: result.pinyin.trim(), vietnameseReading };
}

async function repairWithGemini(target, reason, targetIndex) {
  const units = pronunciationUnits(target.line.chinese);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await callGemini(
        `${fallbackPrompt(target, units, reason)}${attempt === 1 ? "" : `\nLần trước bị chặn vì: ${lastError.message}. Hãy sửa đúng lỗi đó.`}`,
        fallbackSchema(units.length),
        targetIndex,
      );
      return validateFallback(response, target, units);
    } catch (error) {
      lastError = error;
      process.stderr.write(`${target.lesson.id}, dòng ${target.index + 1}: fallback ${attempt}/3 bị chặn: ${error.message}\n`);
    }
  }
  throw lastError ?? new Error("Không tạo được pinyin/phiên âm thay thế.");
}

const targets = findRepairTargets();
if (targets.length === 0) {
  process.stdout.write("Không có dòng phiên âm lỗi phù hợp với phạm vi đã chọn.\n");
  process.exit(0);
}

let deterministic = 0;
let fallback = 0;
process.stdout.write(`Đang kiểm tra và sửa ${targets.length} dòng phiên âm…\n`);
for (const [targetIndex, target] of targets.entries()) {
  let repaired;
  try {
    const alignment = toneSlotsFor(target.line.chinese, target.line.pinyin);
    const tokens = tokenizeReading(target.line.vietnameseReading);
    if (tokens.length !== alignment.units.length) throw new Error("Số âm gợi đọc không khớp câu Trung.");
    const vietnameseReading = renderReading(tokens, alignment.tones);
    const problems = readingProblems(vietnameseReading, target.line.pinyin);
    if (problems.length > 0) throw new Error(problems.join("; "));
    repaired = { pinyin: target.line.pinyin, vietnameseReading };
    deterministic += 1;
  } catch (error) {
    repaired = await repairWithGemini(target, error.message, targetIndex);
    fallback += 1;
  }
  target.line.pinyin = repaired.pinyin;
  target.line.vietnameseReading = repaired.vietnameseReading;
}

const remaining = curriculum.flatMap((lesson) => lesson.lines.flatMap((line, index) => {
  const problems = readingProblems(line.vietnameseReading, line.pinyin);
  return problems.length ? [`${lesson.id}, dòng ${index + 1}: ${problems.join("; ")}`] : [];
}));
if (remaining.length) throw new Error(`Sau sửa vẫn còn lỗi phiên âm: ${remaining.slice(0, 3).join(" | ")}`);

process.stdout.write(`Đạt ${deterministic} dòng đối chiếu xác định và ${fallback} dòng kiểm tra lại có kiểm soát.\n`);
if (dryRun) {
  process.stdout.write("Dry run đã đạt: không ghi app/curriculum.json.\n");
  process.exit(0);
}

const temporaryDestination = `${destination}.repair-${process.pid}-${Date.now()}.tmp`;
try {
  writeFileSync(temporaryDestination, `${JSON.stringify(curriculum, null, 2)}\n`, "utf8");
  renameSync(temporaryDestination, destination);
} finally {
  if (existsSync(temporaryDestination)) unlinkSync(temporaryDestination);
}
process.stdout.write(`Đã thay thế nguyên tử ${targets.length} dòng phiên âm sau khi tất cả đều qua kiểm tra.\n`);
