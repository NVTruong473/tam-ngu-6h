import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const destination = resolve("app/curriculum.json");
const localKeysFile = process.env.API_KEYS_FILE;
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const requestedCount = Number(process.env.APPEND_LESSON_COUNT || 3);
const lessonCount = Number.isInteger(requestedCount) && requestedCount > 0 && requestedCount <= 12
  ? requestedCount
  : 3;

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

if (keys.length === 0) {
  throw new Error("Thiếu GEMINI_API_KEY, GEMINI_API_KEYS hoặc API_KEYS_FILE.");
}

const curriculum = JSON.parse(readFileSync(destination, "utf8"));
if (!Array.isArray(curriculum) || curriculum.length < 1) throw new Error("Giáo trình hiện tại không hợp lệ.");

const kindCycle = ["sentence", "message", "dialogue"];
const phaseByKind = { sentence: "buổi sáng", message: "buổi trưa", dialogue: "buổi tối" };

function stageFor(sequence) {
  if (sequence <= 120) return "B1 · Phản xạ trong đời sống";
  if (sequence <= 270) return "B1+ · Diễn đạt linh hoạt";
  if (sequence <= 540) return "B2 · Giao tiếp độc lập";
  if (sequence <= 810) return "B2+ · Sắc thái và lập luận";
  return "C1 · Tự nhiên và tinh tế";
}

const lineSchema = {
  type: "OBJECT",
  properties: {
    speaker: { type: "STRING" },
    english: { type: "STRING" },
    chinese: { type: "STRING" },
    pinyin: { type: "STRING" },
    vietnameseReading: { type: "STRING" },
    vietnamese: { type: "STRING" },
  },
  required: ["speaker", "english", "chinese", "pinyin", "vietnameseReading", "vietnamese"],
};

const itemSchema = {
  type: "OBJECT",
  properties: {
    id: { type: "STRING" },
    stage: { type: "STRING" },
    kind: { type: "STRING", enum: kindCycle },
    title: { type: "STRING" },
    context: { type: "STRING" },
    lines: { type: "ARRAY", minItems: 1, maxItems: 4, items: lineSchema },
    note: { type: "STRING" },
    challenge: { type: "STRING" },
    grammarFocus: { type: "STRING" },
    vocabulary: { type: "ARRAY", minItems: 3, maxItems: 7, items: { type: "STRING" } },
    wish: { type: "STRING" },
    nightWish: { type: "STRING" },
  },
  required: [
    "id", "stage", "kind", "title", "context", "lines", "note", "challenge",
    "grammarFocus", "vocabulary", "wish", "nightWish",
  ],
};

function normalize(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("vi").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function assertPlainText(value, label) {
  if (/[<>]/.test(value)) throw new Error(`Có markup hoặc ký tự không hợp lệ trong ${label}.`);
}

const recent = curriculum.slice(-36).map((item, index) => ({
  number: curriculum.length - Math.min(36, curriculum.length) + index + 1,
  title: item.title,
  grammar: item.grammarFocus || item.note,
  english: item.lines.map((line) => line.english).join(" / "),
  chinese: item.lines.map((line) => line.chinese).join(" / "),
}));

const requestedPlan = Array.from({ length: lessonCount }, (_, offset) => {
  const sequence = curriculum.length + offset + 1;
  const kind = kindCycle[(sequence - 1) % kindCycle.length];
  return {
    id: `lesson-${String(sequence).padStart(4, "0")}`,
    sequence,
    kind,
    phase: phaseByKind[kind],
    stage: stageFor(sequence),
  };
});

const prompt = `
Bạn là trưởng nhóm học thuật của một ứng dụng micro-learning Anh–Trung dành cho người Việt.
Ứng dụng không phải một cuốn sách hữu hạn: mỗi ngày thêm bài mới, có ôn giãn cách nhưng luôn mở rộng vốn từ, ngữ pháp, tình huống và sắc thái.

Hãy tạo đúng ${lessonCount} bài tiếp theo theo kế hoạch JSON dưới đây:
${JSON.stringify(requestedPlan, null, 2)}

Các bài gần nhất để tránh lặp nguyên văn hoặc lặp cùng trọng tâm:
${JSON.stringify(recent, null, 2)}

Tiêu chuẩn bắt buộc:
- Giữ đúng id, stage và kind trong kế hoạch; không đổi thứ tự.
- sentence và message có đúng 1 line. dialogue có 3 hoặc 4 lượt nói tự nhiên, speaker luân phiên A/B.
- English và Simplified Chinese phải tự nhiên như người bản ngữ, tương đương dụng ý nhưng không dịch máy từng chữ.
- Pinyin có dấu thanh chuẩn và tách từ dễ đọc. Bản Việt tự nhiên, không cứng.
- Mỗi line phải có vietnameseReading: cách đọc gần tiếng Việt của đúng câu Trung, không phải âm Hán-Việt; tách từng âm tiết và ghi thanh Quan thoại bằng (1), (2), (3), (4), ví dụ “wǒ” gần là “uô(3)”. Không dùng markdown.
- Mỗi bài có một grammarFocus mới hoặc phát triển sâu hơn; không quay về từ đơn, chào hỏi, số đếm hay mẫu nhập môn.
- vocabulary gồm 3–7 cụm từ thật sự hữu ích lấy từ bài, ghi dạng “English · 中文 · nghĩa Việt”.
- Khoảng 20% kiến thức được ôn có chủ ý trong ngữ cảnh mới; 80% phải mới. Không lặp tiêu đề, câu, hội thoại hay ghi chú trong danh sách gần nhất.
- Luân phiên rộng các miền: công việc, đời sống, di chuyển, ăn uống, cảm xúc, quan hệ, giải quyết hiểu lầm, công nghệ, sức khỏe, du lịch, văn hóa, kế hoạch và quan điểm.
- note giải thích cấu trúc/sắc thái và chỉ ra khác biệt Anh–Trung bằng tiếng Việt; challenge là nhiệm vụ nói/viết 1–3 phút, cụ thể và tự làm được.
- wish là lời chúc riêng cho đúng phase của bài, 12–28 từ, ấm áp, khó đoán, không sáo rỗng.
- nightWish là lời chúc ngủ ngon bí mật, 12–28 từ, khác hoàn toàn các lời gần đây. Với bài không phải buổi tối vẫn phải tạo một câu dự phòng khác nhau.
- Chỉ dùng văn bản thuần: tuyệt đối không chứa HTML/XML, Markdown, backtick hoặc các thẻ/ký tự dạng <...>.
- Không nhận xét ngoài JSON.
`;

async function callGemini(retryGuidance = "") {
  let lastError;
  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    const key = keys[attempt];
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: `${prompt}${retryGuidance}` }] }],
          generationConfig: {
            temperature: 0.88,
            responseMimeType: "application/json",
            responseSchema: { type: "ARRAY", minItems: lessonCount, maxItems: lessonCount, items: itemSchema },
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

function validateAndNormalize(items) {
  if (!Array.isArray(items) || items.length !== lessonCount) throw new Error(`Gemini không trả đúng ${lessonCount} bài.`);

  const usedTitles = new Set(curriculum.map((item) => normalize(item.title)));
  const usedEnglish = new Set(curriculum.flatMap((item) => item.lines.map((line) => normalize(line.english))));
  const usedChinese = new Set(curriculum.flatMap((item) => item.lines.map((line) => normalize(line.chinese))));

  return items.map((item, index) => {
    const plan = requestedPlan[index];
    if (!item || typeof item !== "object") throw new Error(`Bài ${plan.id} không hợp lệ.`);
    if (item.kind !== plan.kind) throw new Error(`Sai loại bài ở ${plan.id}: cần ${plan.kind}.`);
    const expectedLines = plan.kind === "dialogue" ? [3, 4] : [1];
    if (!Array.isArray(item.lines) || !expectedLines.includes(item.lines.length)) throw new Error(`Sai số dòng tại ${plan.id}.`);
    if (!Array.isArray(item.vocabulary) || item.vocabulary.length < 3 || item.vocabulary.length > 7) throw new Error(`Thiếu từ vựng tại ${plan.id}.`);

    for (const field of ["title", "context", "note", "challenge", "grammarFocus", "wish", "nightWish"]) {
      if (typeof item[field] !== "string" || item[field].trim().length < 8) throw new Error(`Thiếu ${field} tại ${plan.id}.`);
      assertPlainText(item[field], `${field} tại ${plan.id}`);
    }
    if (usedTitles.has(normalize(item.title))) throw new Error(`Trùng tiêu đề tại ${plan.id}.`);

    for (const [lineIndex, line] of item.lines.entries()) {
      if (!line || typeof line !== "object") throw new Error(`Dòng ${lineIndex + 1} không hợp lệ tại ${plan.id}.`);
      for (const field of ["speaker", "english", "chinese", "pinyin", "vietnameseReading", "vietnamese"]) {
        if (typeof line[field] !== "string" || line[field].trim().length < 1) throw new Error(`Thiếu ${field} tại ${plan.id}.`);
        assertPlainText(line[field], `${field} tại ${plan.id}`);
      }
      if (!/\p{Script=Latin}/u.test(line.english)) throw new Error(`Câu tiếng Anh không hợp lệ tại ${plan.id}.`);
      if (!/\p{Script=Han}/u.test(line.chinese)) throw new Error(`Câu tiếng Trung không hợp lệ tại ${plan.id}.`);
      if (!/\p{Script=Latin}/u.test(line.pinyin) || /\p{Script=Han}/u.test(line.pinyin)) throw new Error(`Pinyin không hợp lệ tại ${plan.id}.`);
      if (!/\([1-4]\)/.test(line.vietnameseReading)) throw new Error(`Phiên âm Việt thiếu thanh điệu tại ${plan.id}.`);
      if (plan.kind === "dialogue" && line.speaker.trim().toUpperCase() !== (lineIndex % 2 === 0 ? "A" : "B")) {
        throw new Error(`Speaker không luân phiên A/B tại ${plan.id}.`);
      }
      if (usedEnglish.has(normalize(line.english))) throw new Error(`Trùng câu tiếng Anh tại ${plan.id}.`);
      if (usedChinese.has(normalize(line.chinese))) throw new Error(`Trùng câu tiếng Trung tại ${plan.id}.`);
      usedEnglish.add(normalize(line.english));
      usedChinese.add(normalize(line.chinese));
    }

    item.vocabulary.forEach((entry) => {
      if (typeof entry !== "string" || entry.trim().split("·").map((part) => part.trim()).filter(Boolean).length !== 3) {
        throw new Error(`Từ vựng không đúng định dạng tại ${plan.id}.`);
      }
      assertPlainText(entry, `vocabulary tại ${plan.id}`);
    });

    usedTitles.add(normalize(item.title));
    return {
      ...item,
      id: plan.id,
      stage: plan.stage,
      kind: plan.kind,
      title: item.title.trim(),
      generatedAt: new Date().toISOString(),
      generator: model,
    };
  });
}

async function generateValidatedLessons() {
  let lastValidationError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const candidate = await callGemini(attempt === 1 ? "" : "\nLô trước không qua kiểm tra kỹ thuật. Hãy tạo lại toàn bộ bài thật sạch, đặc biệt không có HTML/Markdown, pinyin không chứa chữ Hán, vietnameseReading phải có các thanh (1)–(4), và dialogue phải xen kẽ A/B.");
    try {
      return validateAndNormalize(candidate);
    } catch (error) {
      lastValidationError = error;
      process.stderr.write(`Lô Gemini ${attempt}/3 bị chặn kiểm duyệt: ${error.message}\n`);
    }
  }
  throw lastValidationError ?? new Error("Không có lô bài nào đạt kiểm tra chất lượng.");
}

process.stdout.write(`Đang tạo ${lessonCount} bài mới bằng ${model}…\n`);
const generated = await generateValidatedLessons();
curriculum.push(...generated);
writeFileSync(destination, `${JSON.stringify(curriculum, null, 2)}\n`, "utf8");
process.stdout.write(`Đã nối thêm ${generated.length} bài; kho hiện có ${curriculum.length} bài.\n`);
