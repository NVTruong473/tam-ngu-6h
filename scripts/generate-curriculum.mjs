import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const destination = resolve("app/curriculum.json");
const localKeysFile = process.env.API_KEYS_FILE;
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

function localKeys() {
  if (!localKeysFile) return [];
  const source = readFileSync(localKeysFile, "utf8");
  return [...source.matchAll(/^\s*export\s+GEMINI_API_KEY_\d+\s*=\s*["']?([^"'\s]+)["']?\s*$/gm)].map((match) => match[1]);
}

const keys = [process.env.GEMINI_API_KEY, ...localKeys()].filter(Boolean);
if (keys.length === 0) throw new Error("Thiếu GEMINI_API_KEY hoặc API_KEYS_FILE.");

const stages = [
  ["A2.1 · Nền tảng sau một tháng", "thói quen, thay đổi kế hoạch, kể trải nghiệm gần đây"],
  ["A2.1 · Giao tiếp thực tế", "đi làm, ăn uống, mua sắm, hỏi đường, lịch hẹn"],
  ["A2.2 · Mở rộng phản xạ", "xin làm rõ, đưa lý do, so sánh và đề xuất phương án"],
  ["A2+ · Sắc thái", "quan tâm, cảm ơn, từ chối mềm, đồng ý một phần"],
  ["A2+/B1 · Hội thoại tự nhiên", "kể chuyện, quan điểm, cảm xúc và giải quyết hiểu lầm"],
  ["B1 · Ứng dụng độc lập", "thảo luận kế hoạch, công việc, du lịch và các mối quan hệ"],
];

const itemSchema = {
  type: "OBJECT",
  properties: {
    id: { type: "STRING" },
    stage: { type: "STRING" },
    kind: { type: "STRING", enum: ["sentence", "message", "dialogue"] },
    title: { type: "STRING" },
    context: { type: "STRING" },
    lines: {
      type: "ARRAY",
      items: {
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
      },
    },
    note: { type: "STRING" },
    challenge: { type: "STRING" },
  },
  required: ["id", "stage", "kind", "title", "context", "lines", "note", "challenge"],
};

async function callGemini(prompt) {
  let lastError;
  for (const key of keys) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.72,
            responseMimeType: "application/json",
            responseSchema: { type: "ARRAY", minItems: 15, maxItems: 15, items: itemSchema },
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
    }
  }
  throw lastError ?? new Error("Không gọi được Gemini.");
}

function validate(items, stageIndex) {
  if (!Array.isArray(items) || items.length !== 15) throw new Error(`Chặng ${stageIndex + 1} không đủ 15 bài.`);
  const expectedKinds = ["sentence", "message", "dialogue"];
  items.forEach((item, index) => {
    const kind = expectedKinds[index % 3];
    if (item.kind !== kind) throw new Error(`Sai loại bài tại chặng ${stageIndex + 1}, vị trí ${index + 1}.`);
    if (!Array.isArray(item.lines) || item.lines.length === 0) throw new Error(`Thiếu nội dung tại ${item.id}.`);
    if (kind === "dialogue") {
      if (item.lines.length < 3) throw new Error(`Hội thoại quá ngắn tại ${item.id}.`);
      item.lines = item.lines.slice(0, 4);
    } else {
      item.lines = item.lines.slice(0, 1);
    }
    for (const line of item.lines) {
      for (const field of ["english", "chinese", "pinyin", "vietnameseReading", "vietnamese"]) {
        if (typeof line[field] !== "string" || line[field].trim().length < 3) throw new Error(`Thiếu ${field} tại ${item.id}.`);
      }
      if (!/[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu.test(line.vietnameseReading)
        || /[fjwz]/iu.test(line.vietnameseReading)
        || /(?:^|\s)(?:sh|zh)[a-z]+/iu.test(line.vietnameseReading)
        || /\([05-9]\)/.test(line.vietnameseReading)) {
        throw new Error(`Phiên âm Việt còn giống pinyin/Anh tại ${item.id}.`);
      }
      if (!/\p{Script=Han}/u.test(line.chinese) || /[A-Za-z]/.test(line.chinese)) {
        throw new Error(`Câu Trung phải viết hoàn toàn bằng tiếng Trung giản thể tại ${item.id}.`);
      }
    }
  });
}

const curriculum = [];
for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
  const [stage, topics] = stages[stageIndex];
  const globalStart = stageIndex * 15 + 1;
  const prompt = `
Bạn là biên soạn viên giáo trình song ngữ Anh–Trung cho người Việt đã học cả hai ngôn ngữ khoảng một tháng.
Tạo đúng 15 micro-lesson cho chặng “${stage}”, chủ đề chính: ${topics}.

Yêu cầu bắt buộc:
- Không dạy lại Hello, Thank you, số đếm hay từ đơn lẻ.
- Thứ tự kind lặp chính xác: sentence, message, dialogue; tổng cộng 15 bài.
- sentence và message có đúng 1 line; dialogue có 3 hoặc 4 lines.
- English và Simplified Chinese phải tự nhiên, tương đương ý nhưng không dịch máy từng chữ. Câu Trung chỉ dùng chữ Trung giản thể và dấu câu Trung; không chèn English/Latin; tên riêng phải phiên âm sang chữ Trung khi cần.
- Pinyin có dấu thanh chính xác; vietnameseReading là cách đọc gần tiếng Việt của câu Trung (không phải âm Hán-Việt hay pinyin viết lại), tách từng âm tiết và có thanh Quan thoại (1), (2), (3), (4). Dùng chữ/dấu Việt khi gợi âm; không dùng f, j, w, z, cụm pinyin sh.../zh... hay (0)/(5). Vietnamese tự nhiên, dễ hiểu.
- Mỗi bài dạy một cấu trúc hoặc chiến lược giao tiếp mới, khó dần nhưng không nhảy cấp đột ngột.
- note giải thích sắc thái/cấu trúc bằng tiếng Việt; challenge là bài nói 1 phút có thể tự làm.
- id tuần tự từ lesson-${String(globalStart).padStart(3, "0")} đến lesson-${String(globalStart + 14).padStart(3, "0")}.
- stage của mọi mục là “${stage}”. Không dùng markdown.
`;
  process.stdout.write(`Đang tạo chặng ${stageIndex + 1}/${stages.length}…\n`);
  const batch = await callGemini(prompt);
  validate(batch, stageIndex);
  curriculum.push(...batch);
  process.stdout.write(`Đã tạo chặng ${stageIndex + 1}/${stages.length}\n`);
}

writeFileSync(destination, `${JSON.stringify(curriculum, null, 2)}\n`, "utf8");
process.stdout.write(`Đã lưu ${curriculum.length} bài vào app/curriculum.json\n`);
