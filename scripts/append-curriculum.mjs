import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pinyin, pinyin } from "pinyin";

const destination = resolve("app/curriculum.json");
const localKeysFile = process.env.API_KEYS_FILE;
const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
const requestedCount = Number(process.env.APPEND_LESSON_COUNT || 3);
const lessonCount = Number.isInteger(requestedCount) && requestedCount > 0 && requestedCount <= 12
  ? requestedCount
  : 3;
const requestedAttempts = Number(process.env.GENERATION_ATTEMPTS || 8);
const generationAttempts = Number.isInteger(requestedAttempts) && requestedAttempts >= 3 && requestedAttempts <= 12
  ? requestedAttempts
  : 8;

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

const reviewSchema = {
  type: "ARRAY",
  minItems: lessonCount,
  maxItems: lessonCount,
  items: {
    type: "OBJECT",
    properties: {
      id: { type: "STRING" },
      approved: { type: "BOOLEAN" },
      issues: { type: "ARRAY", maxItems: 6, items: { type: "STRING" } },
    },
    required: ["id", "approved", "issues"],
  },
};

function normalize(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("vi").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function assertPlainText(value, label) {
  if (/[<>]/.test(value)) throw new Error(`Có markup hoặc ký tự không hợp lệ trong ${label}.`);
}

const PINYIN_TONE_MARKS = new Set([..."āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ"]);
const TONE_BY_MARK = new Map([
  ["ā", 1], ["á", 2], ["ǎ", 3], ["à", 4], ["ē", 1], ["é", 2], ["ě", 3], ["è", 4],
  ["ī", 1], ["í", 2], ["ǐ", 3], ["ì", 4], ["ō", 1], ["ó", 2], ["ǒ", 3], ["ò", 4],
  ["ū", 1], ["ú", 2], ["ǔ", 3], ["ù", 4], ["ǖ", 1], ["ǘ", 2], ["ǚ", 3], ["ǜ", 4],
  ["Ā", 1], ["Á", 2], ["Ǎ", 3], ["À", 4], ["Ē", 1], ["É", 2], ["Ě", 3], ["È", 4],
  ["Ī", 1], ["Í", 2], ["Ǐ", 3], ["Ì", 4], ["Ō", 1], ["Ó", 2], ["Ǒ", 3], ["Ò", 4],
  ["Ū", 1], ["Ú", 2], ["Ǔ", 3], ["Ù", 4], ["Ǖ", 1], ["Ǘ", 2], ["Ǚ", 3], ["Ǜ", 4],
]);
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

function toneCount(value) {
  return [...value].filter((character) => PINYIN_TONE_MARKS.has(character)).length;
}

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

function pronunciationUnits(chinese) {
  const units = [];
  for (const character of [...String(chinese || "")]) {
    if (/\p{Script=Han}/u.test(character)) {
      const candidates = [...new Set((pinyin(character, { style: Pinyin.STYLE_TONE, heteronym: true })[0] || [])
        .map(plainPinyin)
        .filter(Boolean))];
      if (candidates.length === 0) throw new Error(`Không đọc được pinyin cho chữ ${character}.`);
      units.push({ source: character, candidates });
    } else if (/^\d$/.test(character)) {
      units.push({ source: character, candidates: DIGIT_PINYIN[character] || [] });
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
  const syllables = [];

  for (const unit of units) {
    const candidates = [...unit.candidates].sort((first, second) => second.length - first.length);
    let candidate = candidates.find((value) => source.startsWith(value, cursor));
    if (!candidate) {
      const erhuaCandidate = candidates.find((value) => value.endsWith("er") && source.startsWith("r", cursor));
      if (erhuaCandidate) candidate = "r";
    }
    if (!candidate) throw new Error(`Không thể đối chiếu ${unit.source} với pinyin tại vị trí ${cursor}.`);
    const segment = characters.slice(cursor, cursor + candidate.length);
    tones.push(segment.map((character) => character.tone).find(Boolean) || 0);
    syllables.push(candidate);
    cursor += candidate.length;
  }

  if (cursor !== characters.length) throw new Error("Pinyin còn phần không đối chiếu được với câu Trung.");
  if (tones.filter(Boolean).length !== toneCount(sourcePinyin)) {
    throw new Error("Số thanh sau đối chiếu không khớp pinyin nguồn.");
  }
  return { units, tones, syllables };
}

function cleanReadingTokens(value) {
  return String(value || "")
    .replace(/\([^)]*\)/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/[,.;:!?，。！？'’”]+$/u, ""))
    .filter(Boolean);
}

function addLexiconReading(counts, key, token) {
  if (!counts.has(key)) counts.set(key, new Map());
  const options = counts.get(key);
  options.set(token, (options.get(token) || 0) + 1);
}

function bestLexiconReadings(counts) {
  return new Map([...counts].map(([key, options]) => [
    key,
    [...options].sort((first, second) => second[1] - first[1] || first[0].localeCompare(second[0], "vi"))[0][0],
  ]));
}

function buildReadingLexicon() {
  const exactCounts = new Map();
  const baseCounts = new Map();
  for (const lesson of curriculum) {
    for (const line of lesson.lines || []) {
      try {
        const alignment = toneSlotsFor(line.chinese, line.pinyin);
        const tokens = cleanReadingTokens(line.vietnameseReading);
        if (tokens.length !== alignment.units.length) continue;
        tokens.forEach((token, index) => {
          if (!token || /[fjwz<>`]/iu.test(token) || /\p{Script=Han}/u.test(token)) return;
          const normalizedToken = token.toLocaleLowerCase("vi");
          addLexiconReading(exactCounts, `${alignment.syllables[index]}:${alignment.tones[index]}`, normalizedToken);
          addLexiconReading(baseCounts, alignment.syllables[index], normalizedToken);
        });
      } catch {
        // A malformed legacy line must not prevent new lessons from using the
        // rest of the verified corpus as a pronunciation dictionary.
      }
    }
  }
  return { exact: bestLexiconReadings(exactCounts), base: bestLexiconReadings(baseCounts) };
}

const SPECIAL_PINYIN_READINGS = {
  zhi: "trư", chi: "chư", shi: "sư", ri: "rư", zi: "chư", ci: "xư", si: "xư",
  yi: "i", wu: "u", yu: "uy", ye: "iê", yue: "uyê", yuan: "uyên", yin: "in",
  yun: "uyn", ying: "inh", yong: "dung", er: "ơ",
};
const PINYIN_INITIALS = {
  zh: "tr", ch: "ch", sh: "s", b: "b", p: "p", m: "m", f: "ph", d: "đ", t: "th",
  n: "n", l: "l", g: "c", k: "kh", h: "h", j: "ch", q: "x", x: "x", r: "r",
  z: "ch", c: "x", s: "x", y: "i", w: "u",
};
const PINYIN_FINALS = {
  a: "a", o: "ô", e: "ơ", ai: "ai", ei: "ây", ao: "ao", ou: "âu",
  an: "an", en: "ân", ang: "ang", eng: "âng", ong: "ung", i: "i", ia: "ia",
  ie: "iê", iao: "iao", iu: "iêu", ian: "ien", in: "in", iang: "iang", ing: "inh",
  iong: "iung", u: "u", ua: "oa", uo: "uô", uai: "oai", ui: "uây", uan: "oan",
  un: "uân", uang: "oang", ueng: "uâng", v: "uy", ve: "uyê", van: "uyên", vn: "uyn",
};

function fallbackVietnameseReading(syllable) {
  if (SPECIAL_PINYIN_READINGS[syllable]) return SPECIAL_PINYIN_READINGS[syllable];
  const initial = Object.keys(PINYIN_INITIALS).find((candidate) => syllable.startsWith(candidate)) || "";
  const final = syllable.slice(initial.length);
  const renderedInitial = PINYIN_INITIALS[initial] || "";
  let renderedFinal = PINYIN_FINALS[final] || final;
  if (["zh", "ch", "sh", "r", "z", "c", "s"].includes(initial) && final === "i") renderedFinal = "ư";
  const rendered = `${renderedInitial}${renderedFinal}`
    .replace(/f/giu, "ph")
    .replace(/j/giu, "ch")
    .replace(/w/giu, "u")
    .replace(/z/giu, "ch")
    .replace(/^sh/iu, "s")
    .replace(/^zh/iu, "tr");
  return rendered || "ơ";
}

const READING_LEXICON = buildReadingLexicon();

function readingForSyllable(syllable, tone) {
  return READING_LEXICON.exact.get(`${syllable}:${tone}`)
    || READING_LEXICON.base.get(syllable)
    || fallbackVietnameseReading(syllable);
}

function normalizeVietnameseReading(line, label) {
  const alignment = toneSlotsFor(line.chinese, line.pinyin);
  const tokens = alignment.syllables.map((syllable, index) => readingForSyllable(syllable, alignment.tones[index]));
  return tokens.map((token, index) => {
    if (!token || /[fjwz<>`]/iu.test(token) || /\p{Script=Han}/u.test(token)) {
      throw new Error(`Âm gợi đọc không hợp lệ tại ${label}, vị trí ${index + 1}.`);
    }
    return `${token}${alignment.tones[index] ? `(${alignment.tones[index]})` : ""}`;
  }).join(" ");
}

function normalizeCandidateReadings(items) {
  if (!Array.isArray(items)) return items;
  return items.map((item, itemIndex) => ({
    ...item,
    lines: Array.isArray(item?.lines)
      ? item.lines.map((line, lineIndex) => ({
        ...line,
        vietnameseReading: normalizeVietnameseReading(
          line,
          `${requestedPlan[itemIndex]?.id || `bài ${itemIndex + 1}`}, dòng ${lineIndex + 1}`,
        ),
      }))
      : item?.lines,
  }));
}

function assertVietnameseFriendlyReading(value, pinyin, label) {
  const vietnameseSoundMark = /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu;
  if (!vietnameseSoundMark.test(value) || /[fjwz]/iu.test(value) || /(?:^|\s)(?:sh|zh)[a-z]+/iu.test(value) || /\((?![1-4]\))[^)]*\)|\([^)]*$/u.test(value)) {
    throw new Error(`Phiên âm Việt còn giống pinyin/Anh tại ${label}.`);
  }
  const expectedTones = toneCount(pinyin);
  const suppliedTones = (value.match(/\([1-4]\)/g) || []).length;
  if (expectedTones !== suppliedTones) {
    throw new Error(`Số thanh trong phiên âm Việt không khớp pinyin tại ${label} (cần ${expectedTones}, có ${suppliedTones}).`);
  }
}

function assertSimplifiedChinese(value, label) {
  if (!/\p{Script=Han}/u.test(value) || /[A-Za-z]/.test(value)) {
    throw new Error(`Câu Trung phải viết hoàn toàn bằng tiếng Trung giản thể tại ${label}.`);
  }
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
- English và Simplified Chinese phải tự nhiên như người bản ngữ, tương đương dụng ý nhưng không dịch máy từng chữ. Câu Trung chỉ dùng chữ Trung giản thể và dấu câu Trung; không được chèn English/Latin. Tên riêng phải chuyển sang tên phiên âm Trung khi cần.
- Pinyin có dấu thanh chuẩn và tách từ dễ đọc. Bản Việt tự nhiên, không cứng.
- Mỗi line phải có vietnameseReading: cách đọc gần tiếng Việt của đúng câu Trung, không phải âm Hán-Việt hoặc pinyin viết lại. Dùng lối gợi âm Việt (có các chữ/dấu như ă, â, đ, ê, ô, ơ, ư khi hợp lý) và bắt buộc tách đúng một âm gợi đọc cho mỗi chữ Hán/chữ số được đọc. Có thể ghi thanh Quan thoại bằng (1), (2), (3), (4), ví dụ “wǒ” gần là “uô(3)”; chương trình sẽ đối chiếu pinyin và chuẩn hóa lại vị trí thanh. Tuyệt đối không dùng f, j, w, z, cụm pinyin sh.../zh... hay (0)/(5). Không dùng markdown.
- Mỗi bài có một grammarFocus mới hoặc phát triển sâu hơn; cấu trúc được nêu phải xuất hiện đầy đủ ngay trong line của bài và lời giải thích không được gán quan hệ nhân quả/tất yếu nếu cấu trúc chỉ mang nghĩa đi kèm. Không quay về từ đơn, chào hỏi, số đếm hay mẫu nhập môn.
- vocabulary gồm 3–7 cụm từ thật sự hữu ích lấy từ bài, ghi dạng “English · 中文 · nghĩa Việt”.
- Khoảng 20% kiến thức được ôn có chủ ý trong ngữ cảnh mới; 80% phải mới. Không lặp tiêu đề, câu, hội thoại hay ghi chú trong danh sách gần nhất.
- Luân phiên rộng các miền: công việc, đời sống, di chuyển, ăn uống, cảm xúc, quan hệ, giải quyết hiểu lầm, công nghệ, sức khỏe, du lịch, văn hóa, kế hoạch và quan điểm.
- note giải thích cấu trúc/sắc thái và chỉ ra khác biệt Anh–Trung bằng tiếng Việt; challenge là nhiệm vụ nói/viết 1–3 phút, cụ thể và tự làm được.
- wish là lời chúc riêng cho đúng phase của bài, 12–28 từ, ấm áp, khó đoán, không sáo rỗng.
- nightWish là lời chúc ngủ ngon bí mật, 12–28 từ, khác hoàn toàn các lời gần đây. Với bài không phải buổi tối vẫn phải tạo một câu dự phòng khác nhau.
- Chỉ dùng văn bản thuần: tuyệt đối không chứa HTML/XML, Markdown, backtick hoặc các thẻ/ký tự dạng <...>.
- Không nhận xét ngoài JSON.
`;

async function callGemini({ prompt: promptText, responseSchema, temperature, purpose }) {
  let lastError;
  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    const key = keys[attempt];
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(120_000),
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: promptText }] }],
          generationConfig: {
            temperature,
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
      process.stderr.write(`Gemini ${purpose}, khóa ${attempt + 1}/${keys.length} chưa dùng được: ${error.message}\n`);
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
      assertSimplifiedChinese(line.chinese, `${plan.id}, dòng ${lineIndex + 1}`);
      if (!/\p{Script=Latin}/u.test(line.pinyin) || /\p{Script=Han}/u.test(line.pinyin)) throw new Error(`Pinyin không hợp lệ tại ${plan.id}.`);
      if (!/\([1-4]\)/.test(line.vietnameseReading)) throw new Error(`Phiên âm Việt thiếu thanh điệu tại ${plan.id}.`);
      assertVietnameseFriendlyReading(line.vietnameseReading, line.pinyin, `${plan.id}, dòng ${lineIndex + 1}`);
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

async function reviewGeneratedLessons(items) {
  const reviewPrompt = [
    "Bạn là người phản biện học thuật độc lập cho nội dung micro-learning Anh–Trung dành cho người Việt đã học khoảng một tháng.",
    "Không viết lại bài. Đánh giá từng bài bên dưới một cách nghiêm khắc nhưng công bằng.",
    "approved chỉ được true khi tất cả đều ổn: ngữ pháp và độ tự nhiên tiếng Anh; tiếng Trung giản thể tự nhiên; ý nghĩa Anh–Trung–Việt tương đương; pinyin hợp lý; vietnameseReading thực sự là gợi âm Việt và khớp các thanh; grammarFocus, vocabulary, note và challenge đúng trọng tâm B1; cấu trúc mà grammarFocus nêu phải thật sự xuất hiện đầy đủ trong line và phần giải thích không được phóng đại nghĩa; không có câu hoặc lời chúc sáo rỗng/lệch ngữ cảnh.",
    "Nếu có lỗi hoặc nghi ngờ thực chất, approved=false và issues phải nêu ngắn gọn, cụ thể theo đúng bài. Nếu không có lỗi, issues là mảng rỗng. Không nhận xét ngoài JSON.",
    "So sánh với recentLessons bên dưới: từ chối nếu bài mới lặp lại cùng tình huống, mâu thuẫn, thông điệp hoặc bộ từ vựng cốt lõi của một bài gần đây; chỉ cho phép ôn lại một cấu trúc nhỏ trong bối cảnh thực sự khác.",
    "recentLessons:",
    JSON.stringify(recent, null, 2),
    "Các bài cần phản biện:",
    JSON.stringify(items, null, 2),
  ].join("\n");
  const reviews = await callGemini({
    prompt: reviewPrompt,
    responseSchema: reviewSchema,
    temperature: 0.12,
    purpose: "phản biện chất lượng",
  });
  if (!Array.isArray(reviews) || reviews.length !== items.length) throw new Error("Phản biện không trả đủ số bài.");
  const expectedIds = new Set(items.map((item) => item.id));
  const byId = new Map(reviews.map((review) => [review?.id, review]));
  if (byId.size !== items.length || [...byId.keys()].some((id) => !expectedIds.has(id))) {
    throw new Error("Phản biện trả sai id bài học.");
  }
  const rejected = items.flatMap((item) => {
    const review = byId.get(item.id);
    const issues = Array.isArray(review?.issues)
      ? review.issues.filter((issue) => typeof issue === "string" && issue.trim()).map((issue) => issue.trim())
      : [];
    return review?.approved === true ? [] : [`${item.id}: ${issues.join("; ") || "phản biện không duyệt nội dung"}`];
  });
  if (rejected.length) throw new Error(`Phản biện học thuật từ chối lô bài: ${rejected.join(" | ")}`);
}

async function generateValidatedLessons() {
  let lastValidationError;
  let retryGuidance = "";
  for (let attempt = 1; attempt <= generationAttempts; attempt += 1) {
    try {
      const candidate = await callGemini({
        prompt: `${prompt}${retryGuidance}`,
        responseSchema: { type: "ARRAY", minItems: lessonCount, maxItems: lessonCount, items: itemSchema },
        temperature: 0.88,
        purpose: "tạo bài",
      });
      const validated = validateAndNormalize(normalizeCandidateReadings(candidate));
      await reviewGeneratedLessons(validated);
      return validated;
    } catch (error) {
      lastValidationError = error;
      process.stderr.write(`Lô Gemini ${attempt}/${generationAttempts} bị chặn kiểm duyệt: ${error.message}\n`);
      retryGuidance = `\nLô trước không đạt kiểm tra kỹ thuật hoặc phản biện học thuật. Hãy tạo lại toàn bộ bài thật sạch; không có HTML/Markdown, pinyin không chứa chữ Hán, vietnameseReading phải tách đúng một âm gợi đọc cho mỗi chữ Hán/chữ số được đọc và dialogue phải xen kẽ A/B. Lý do gần nhất: ${error.message.slice(0, 1200)}`;
    }
  }
  throw lastValidationError ?? new Error("Không có lô bài nào đạt kiểm tra chất lượng.");
}

process.stdout.write(`Đang tạo ${lessonCount} bài mới bằng ${model}…\n`);
const generated = await generateValidatedLessons();
curriculum.push(...generated);
writeFileSync(destination, `${JSON.stringify(curriculum, null, 2)}\n`, "utf8");
process.stdout.write(`Đã nối thêm ${generated.length} bài; kho hiện có ${curriculum.length} bài.\n`);
