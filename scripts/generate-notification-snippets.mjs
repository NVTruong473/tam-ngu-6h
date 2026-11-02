import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const destination = resolve("app/curriculum.json");
const sourcePath = process.env.API_KEYS_FILE;
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const batchSize = 1;
const forceRegeneration = process.env.REGENERATE_NOTIFICATIONS === "1";
// iOS' abbreviated Lock Screen card only guarantees a few body lines. Keep
// each language to a complete one-line thought instead of relying on ellipses.
const limits = { english: 39, chinese: 16, vietnamese: 42 };
if (!sourcePath) throw new Error("Thiếu API_KEYS_FILE.");

const source = readFileSync(sourcePath, "utf8");
const keys = [...new Set([...source.matchAll(/^\s*export\s+GEMINI_API_KEY(?:_\d+)?\s*=\s*["']?([^"'\s]+)["']?\s*$/gm)].map((match) => match[1]))];
const openRouterKeys = [...new Set([...source.matchAll(/^\s*export\s+OPENROUTER_API_KEY(?:_\d+)?\s*=\s*["']?([^"'\s]+)["']?\s*$/gm)].map((match) => match[1]))];
if (!keys.length) throw new Error("Không tìm thấy Gemini key.");
const curriculum = JSON.parse(readFileSync(destination, "utf8"));

const snippetSchema = {
  type: "OBJECT",
  properties: {
    id: { type: "STRING" },
    english: { type: "STRING", maxLength: limits.english },
    chinese: { type: "STRING", maxLength: limits.chinese },
    vietnamese: { type: "STRING", maxLength: limits.vietnamese },
  },
  required: ["id", "english", "chinese", "vietnamese"],
};

async function callGemini(prompt, responseSchema, temperature, keyOffset) {
  let lastError;
  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    const key = keys[(attempt + keyOffset) % keys.length];
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature, responseMimeType: "application/json", responseSchema },
        }),
      });
      if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("Gemini không trả nội dung.");
      return JSON.parse(text);
    } catch (error) {
      lastError = error;
    }
  }
  for (let attempt = 0; attempt < openRouterKeys.length; attempt += 1) {
    const key = openRouterKeys[(attempt + keyOffset) % openRouterKeys.length];
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
          "http-referer": "https://nvtruong473.github.io/tam-ngu-6h/",
          "x-title": "Tam Ngu 6H curriculum editor",
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [{ role: "user", content: `${prompt}\nTrả về đúng một JSON object dạng {\"items\":[...]}; items là mảng được yêu cầu, không có văn bản ngoài JSON.` }],
          response_format: { type: "json_object" },
          temperature,
          max_tokens: 6000,
        }),
      });
      if (!response.ok) throw new Error(`OpenRouter HTTP ${response.status}`);
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("OpenRouter không trả nội dung.");
      const parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      if (!Array.isArray(parsed?.items)) throw new Error("OpenRouter trả sai JSON.");
      return parsed.items;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Không gọi được Gemini.");
}

function validateSnippets(snippets, lessons) {
  if (!Array.isArray(snippets) || snippets.length !== lessons.length) throw new Error("Sai số snippet.");
  const byId = new Map(snippets.map((item) => [item?.id, item]));
  return lessons.map((lesson) => {
    const item = byId.get(lesson.id);
    if (!item) throw new Error(`Thiếu ${lesson.id}.`);
    for (const [field, maximum] of Object.entries(limits)) {
      const value = item[field]?.replace(/\s+/g, " ").trim();
      if (!value || [...value].length > maximum || /[<>`\u0000-\u001f]/u.test(value)) {
        throw new Error(`${lesson.id}.${field} vượt ${maximum} ký tự hoặc không hợp lệ.`);
      }
      item[field] = value;
    }
    if (!/\p{Script=Latin}/u.test(item.english) || /\p{Script=Han}/u.test(item.english)) throw new Error(`${lesson.id}: English sai script.`);
    if (!/\p{Script=Han}/u.test(item.chinese) || /[A-Za-z]/u.test(item.chinese)) throw new Error(`${lesson.id}: Chinese sai script.`);
    if (!/\p{Script=Latin}/u.test(item.vietnamese) || /\p{Script=Han}/u.test(item.vietnamese)) throw new Error(`${lesson.id}: Vietnamese sai script.`);
    return { english: item.english, chinese: item.chinese, vietnamese: item.vietnamese };
  });
}

async function createReviewedBatch(lessons, batchIndex) {
  let feedback = "";
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const originals = lessons.map((lesson) => ({ id: lesson.id, title: lesson.title, source: lesson.lines[0] }));
    const generationPrompt = `
Tạo bản hiển thị Màn hình khóa cho các micro-lesson Anh–Trung–Việt dưới đây.
Mỗi bản là một câu độc lập, tự nhiên, thực dụng và giữ đúng ý giao tiếp cốt lõi của source. Có thể lược thời lượng, lý do hoặc mô tả phụ nếu câu còn trọn nghĩa; không đổi sự việc, phủ định, chủ thể hay sắc thái chính. Ba ngôn ngữ phải tương đương nghĩa.
Giới hạn cứng tính theo Unicode: english <= ${limits.english}, chinese <= ${limits.chinese}, vietnamese <= ${limits.vietnamese} ký tự. Hãy nhắm english 24–37, chinese 7–16, vietnamese 26–41 ký tự để chắc chắn không vượt trần. Ưu tiên một ý giao tiếp cốt lõi, câu hoàn chỉnh và từ ngữ thông dụng. Ví dụ phong cách: "I get coffee on my way to work." / "上班路上我买咖啡。" / "Tôi mua cà phê trên đường đi làm." Không viết nhãn EN/中/VI, không markdown, không dấu ba chấm, không cắt dở câu.
Giữ nguyên id và thứ tự. Chỉ trả JSON.
${feedback}
Nguồn:
${JSON.stringify(originals)}
`;
    try {
      const candidates = await callGemini(generationPrompt, {
        type: "ARRAY", minItems: lessons.length, maxItems: lessons.length, items: snippetSchema,
      }, 0.28, batchIndex + attempt);
      const snippets = validateSnippets(candidates, lessons);
      const reviewItems = lessons.map((lesson, index) => ({ id: lesson.id, original: lesson.lines[0], candidate: snippets[index] }));
      const review = await callGemini(`
Bạn là biên tập viên Anh–Trung–Việt. Kiểm tra từng candidate dành cho thẻ xem nhanh: ba bản phải tự nhiên, tương đương nghĩa với nhau và không sai ngữ pháp. Được phép bỏ chi tiết phụ như thời lượng, lý do hoặc ví dụ cụ thể nếu ý giao tiếp cốt lõi vẫn đủ và mạch lạc. Từ chối nếu đổi chủ thể, phủ định, thì, ý định, mức độ lịch sự, hoặc tự thêm sự việc mới. Không từ chối chỉ vì candidate ngắn hơn original. Không viết lại nội dung.
${JSON.stringify(reviewItems)}
`, {
        type: "ARRAY", minItems: lessons.length, maxItems: lessons.length,
        items: {
          type: "OBJECT",
          properties: { id: { type: "STRING" }, approved: { type: "BOOLEAN" }, issue: { type: "STRING" } },
          required: ["id", "approved", "issue"],
        },
      }, 0.05, batchIndex + attempt + 1);
      const reviewById = new Map(review.map((item) => [item?.id, item]));
      const rejected = lessons.flatMap((lesson) => reviewById.get(lesson.id)?.approved === true ? [] : [`${lesson.id}: ${reviewById.get(lesson.id)?.issue || "không duyệt"}`]);
      if (rejected.length) throw new Error(rejected.join(" | "));
      return snippets;
    } catch (error) {
      feedback = `Lần trước bị từ chối: ${error.message.slice(0, 1200)}. Hãy tạo lại toàn bộ lô.`;
      process.stderr.write(`Lô ${batchIndex + 1}, lần ${attempt}/8: ${error.message}\n`);
    }
  }
  throw new Error(`Lô ${batchIndex + 1} không đạt sau 8 lần.`);
}

for (let start = 0; start < curriculum.length; start += batchSize) {
  const lessons = curriculum.slice(start, start + batchSize);
  const alreadyFitsLockScreen = lessons.every((lesson) => lesson.notification
    && Object.entries(limits).every(([field, maximum]) => [...String(lesson.notification[field] || "")].length <= maximum));
  if (alreadyFitsLockScreen || (!forceRegeneration && lessons.every((lesson) => lesson.notification))) {
    process.stdout.write(`Giữ snippet đã có ${Math.min(start + batchSize, curriculum.length)}/${curriculum.length}.\n`);
    continue;
  }
  const snippets = await createReviewedBatch(lessons, start / batchSize);
  snippets.forEach((notification, index) => { curriculum[start + index].notification = notification; });
  writeFileSync(destination, `${JSON.stringify(curriculum, null, 2)}\n`, "utf8");
  process.stdout.write(`Đã duyệt ${Math.min(start + batchSize, curriculum.length)}/${curriculum.length} snippet.\n`);
}

writeFileSync(destination, `${JSON.stringify(curriculum, null, 2)}\n`, "utf8");
process.stdout.write(`Đã lưu ${curriculum.length} snippet Màn hình khóa.\n`);
