import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const destination = resolve("app/curriculum.json");
const localKeysFile = process.env.API_KEYS_FILE;
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const requestedBatchSize = Number(process.env.PRONUNCIATION_BATCH_SIZE || 12);
const batchSize = Number.isInteger(requestedBatchSize) && requestedBatchSize > 0 && requestedBatchSize <= 15
  ? requestedBatchSize
  : 12;
const refreshAll = process.env.REFRESH_PRONUNCIATION === "1";

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

if (keys.length === 0) throw new Error("Thiếu GEMINI_API_KEY, GEMINI_API_KEYS hoặc API_KEYS_FILE.");

const curriculum = JSON.parse(readFileSync(destination, "utf8"));
if (!Array.isArray(curriculum) || curriculum.length === 0) throw new Error("Giáo trình hiện tại không hợp lệ.");

const responseSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      readings: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            index: { type: "INTEGER" },
            vietnameseReading: { type: "STRING" },
          },
          required: ["index", "vietnameseReading"],
        },
      },
    },
    required: ["id", "readings"],
  },
};

async function callGemini(prompt) {
  let lastError;
  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: { "content-type": "application/json", "x-goog-api-key": keys[attempt] },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.18,
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
      });
      if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini không trả về nội dung.");
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
      process.stderr.write(`Khóa Gemini ${attempt + 1}/${keys.length} chưa dùng được: ${error.message}\n`);
    }
  }
  throw lastError ?? new Error("Không gọi được Gemini.");
}

const PINYIN_TONE_MARKS = new Set([..."āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ"]);
const VIETNAMESE_SOUND_MARK = /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu;
const NON_VIETNAMESE_LETTER = /[fjwz]/iu;
const PINYIN_DIGRAPH = /(?:^|\s)(?:sh|zh)[a-z]+/iu;

function normalizeReading(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/\(\s*[05]\s*\)/g, "")
    .replace(/(^|[\s,;:])zh/giu, "$1tr")
    .replace(/(^|[\s,;:])sh/giu, "$1s")
    .replace(/(^|[\s,;:])j/giu, "$1ch")
    .replace(/(^|[\s,;:])q/giu, "$1ch")
    .replace(/(^|[\s,;:])w/giu, "$1u")
    .replace(/(^|[\s,;:])z/giu, "$1d")
    .replace(/(^|[\s,;:])f/giu, "$1ph")
    .replace(/\s+/g, " ")
    .trim();
}

function toneCount(value) {
  return [...value].filter((character) => PINYIN_TONE_MARKS.has(character)).length;
}

function assertReading(value, pinyin, lessonId, index) {
  if (typeof value !== "string" || value.trim().length < 3) throw new Error(`Thiếu phiên âm Việt tại ${lessonId}, dòng ${index + 1}.`);
  if (/[<>]/.test(value) || /\p{Script=Han}/u.test(value)) throw new Error(`Phiên âm Việt không sạch tại ${lessonId}, dòng ${index + 1}.`);
  if (!VIETNAMESE_SOUND_MARK.test(value) || NON_VIETNAMESE_LETTER.test(value) || PINYIN_DIGRAPH.test(value)) {
    throw new Error(`Phiên âm Việt còn giống pinyin/Anh tại ${lessonId}, dòng ${index + 1} (${value}).`);
  }
  if (/\((?![1-4]\))[^)]*\)|\([^)]*$/u.test(value)) throw new Error(`Phiên âm Việt dùng marker thanh không hợp lệ tại ${lessonId}, dòng ${index + 1}.`);
  const expectedTones = toneCount(pinyin);
  const suppliedTones = (value.match(/\([1-4]\)/g) || []).length;
  if (expectedTones !== suppliedTones) {
    throw new Error(`Số thanh pinyin (${expectedTones}) không khớp marker đọc gần Việt (${suppliedTones}) tại ${lessonId}, dòng ${index + 1} (${value}).`);
  }
}

function validateBatch(output, batch) {
  if (!Array.isArray(output) || output.length !== batch.length) throw new Error("Gemini không trả đúng số bài cần bổ sung.");
  const outputById = new Map(output.map((item) => [item?.id, item]));
  const expectedIds = new Set(batch.map((lesson) => lesson.id));
  if (outputById.size !== batch.length || [...outputById.keys()].some((id) => !expectedIds.has(id))) {
    throw new Error("Gemini trả về sai id bài học.");
  }

  return batch.map((lesson) => {
    const result = outputById.get(lesson.id);
    if (!Array.isArray(result.readings) || result.readings.length !== lesson.lines.length) {
      throw new Error(`Sai số dòng phiên âm ở ${lesson.id}.`);
    }
    const readingsByIndex = new Map(result.readings.map((reading) => [reading?.index, reading?.vietnameseReading]));
    if (readingsByIndex.size !== lesson.lines.length) throw new Error(`Trùng hoặc thiếu index ở ${lesson.id}.`);
    return lesson.lines.map((line, index) => {
      const vietnameseReading = normalizeReading(readingsByIndex.get(index));
      assertReading(vietnameseReading, line.pinyin, lesson.id, index);
      return { line, vietnameseReading: vietnameseReading.trim() };
    });
  });
}

const targets = refreshAll ? curriculum : curriculum.filter((lesson) => lesson.lines.some((line) => !line.vietnameseReading));
if (targets.length === 0) {
  process.stdout.write("Toàn bộ bài đã có cách đọc gần tiếng Việt.\n");
  process.exit(0);
}

for (let start = 0; start < targets.length; start += batchSize) {
  const batch = targets.slice(start, start + batchSize);
  const source = batch.map((lesson) => ({
    id: lesson.id,
    lines: lesson.lines.map((line, index) => ({
      index,
      chinese: line.chinese,
      pinyin: line.pinyin,
      requiredToneMarkers: toneCount(line.pinyin),
    })),
  }));
  const basePrompt = [
    "Bạn là giáo viên phát âm Quan thoại rất giỏi, đang giúp người Việt mới học tiếng Trung.",
    "Với từng dòng dưới đây, hãy tạo vietnameseReading — cách đọc GẦN tiếng Việt của đúng pinyin, để người mới có thể đọc theo trước khi nghe giọng chuẩn.",
    "Quy tắc bắt buộc:",
    "- Không dùng âm Hán-Việt và không dịch nghĩa. Đây là gợi âm tiếng Quan thoại bằng chữ Việt.",
    "- Giữ mỗi âm tiết Quan thoại thành một cụm dễ đọc, cách nhau bằng dấu cách.",
    "- Sau mỗi âm tiết có thanh, ghi chính xác (1), (2), (3) hoặc (4). Thanh nhẹ có thể không ghi số.",
    "- Mỗi dòng có requiredToneMarkers. Số lượng chuỗi (1), (2), (3), (4) trong vietnameseReading PHẢI bằng đúng số đó; đếm kỹ trước khi trả lời.",
    "- Đây tuyệt đối KHÔNG phải pinyin viết lại bằng chữ thường. Phải dùng lối gợi âm người Việt dễ đọc, ví dụ wǒmen gần “uổ(3) mần”, xīng gần “xỉnh(1)” tùy âm; dùng các chữ Việt như ă, â, đ, ê, ô, ơ, ư và dấu Việt khi có ích.",
    "- Không được dùng các ký tự f, j, w, z; không dùng các cụm pinyin kiểu sh... hoặc zh.... Không được trả chuỗi toàn pinyin như “wo men neng”. Mỗi câu phải có ít nhất một chữ cái/dấu đặc trưng Việt như ô, ơ, ư, â, ê, đ hoặc dấu thanh Việt.",
    "- Dấu Việt chỉ để gợi âm; thanh Quan thoại vẫn phải ghi bằng số (1)–(4) trong ngoặc. Không dùng (0), (5) hay số khác.",
    "- Các âm khó chỉ cần gần đúng, nhất quán và dễ hiểu; không thêm giải thích, markdown hay chữ Hán.",
    "- Tôn trọng thứ tự id và index tuyệt đối. Trả về đúng JSON theo schema.",
    "Nguồn cần xử lý:",
    JSON.stringify(source, null, 2),
  ].join("\n");

  process.stdout.write(`Đang ${refreshAll ? "làm mới" : "thêm"} cách đọc gần Việt cho ${start + 1}–${start + batch.length}/${targets.length} bài…\n`);
  let validated;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const retry = attempt === 1 ? "" : "\nLần trước không qua kiểm tra. Hãy trả đúng toàn bộ id/index, không chữ Hán/pinyin/Anh, không có f/j/w/z hoặc sh.../zh..., mỗi câu phải có dấu/chữ Việt và có đúng số marker (1)–(4) như requiredToneMarkers.";
      validated = validateBatch(await callGemini(`${basePrompt}${retry}`), batch);
      break;
    } catch (error) {
      lastError = error;
      process.stderr.write(`Lô phiên âm ${attempt}/3 bị chặn: ${error.message}\n`);
    }
  }
  if (!validated) throw lastError ?? new Error("Không tạo được phiên âm Việt.");
  for (const lessonLines of validated) {
    for (const { line, vietnameseReading } of lessonLines) line.vietnameseReading = vietnameseReading;
  }
}

// Commit the refreshed corpus only after every batch has passed validation.
// A failed late batch therefore never leaves a half-updated curriculum behind.
writeFileSync(destination, `${JSON.stringify(curriculum, null, 2)}\n`, "utf8");
process.stdout.write(`Đã ${refreshAll ? "làm mới" : "thêm"} cách đọc gần tiếng Việt cho ${targets.length} bài.\n`);
