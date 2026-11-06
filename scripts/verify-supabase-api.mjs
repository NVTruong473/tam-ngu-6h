import { randomBytes } from "node:crypto";
import { evaluateLookupQuality, lookupQualityCases } from "./lookup-quality.mjs";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) throw new Error("Thiếu SUPABASE_PROJECT_REF.");

const apiUrl = `https://${ref}.supabase.co/functions/v1/tam-ngu-api`;
const healthResponse = await fetch(`${apiUrl}/health`);
const health = await healthResponse.json().catch(() => null);
if (!healthResponse.ok || !health?.ok || !health.pushConfigured || !health.lookupConfigured || !health.lookupProtectionConfigured
  || !health.lookupCache?.healthy || !health.lookupCache?.encrypted || health.lookupCache?.plaintextQueriesStored !== false
  || health.lookupCache?.ttlDays !== 7 || health.lookupCache?.maximumEntries !== 2_000) {
  throw new Error("Health check chưa xác nhận được Push, Gemini và cache Tra nhanh riêng tư.");
}

const publicPushProbe = await fetch(`${apiUrl}/subscribe`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    origin: "https://nvtruong473.github.io",
  },
  body: JSON.stringify({
    subscription: { endpoint: "https://example.com/not-an-apple-endpoint", keys: { p256dh: "probe", auth: "probe" } },
    timezone: "Asia/Ho_Chi_Minh",
    routineStartSequence: 0,
  }),
});
if (publicPushProbe.status !== 400) {
  throw new Error("Đăng ký Push một chạm chưa hoạt động đúng hoặc đang bị chặn bởi mã mời.");
}

const testClientId = `tg6h_${randomBytes(18).toString("hex")}`;

const HAN = /\p{Script=Han}/u;
const LATIN = /\p{Script=Latin}/u;
const VIETNAMESE_SOUND_MARK = /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu;
const PINYIN_TONE_MARKS = new Set("āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ");

function hasPlainLatinText(value) {
  return typeof value === "string" && value.length > 0 && LATIN.test(value) && !HAN.test(value) && !/[<>\u0000-\u001F\u007F]/u.test(value);
}

function hasChineseText(value) {
  return typeof value === "string" && value.length > 0 && HAN.test(value) && !LATIN.test(value) && !/[<>\u0000-\u001F\u007F]/u.test(value);
}

function isVietnameseFriendlyReading(value) {
  return typeof value === "string"
    && VIETNAMESE_SOUND_MARK.test(value)
    && !HAN.test(value)
    && !/[fjwz]/iu.test(value)
    && !/(?:^|\s)(?:sh|zh)[a-z]+/iu.test(value)
    && !/\((?![1-4]\))[^)]*\)|\([^)]*$/u.test(value);
}

function hasToneGuidance(pinyin, vietnameseReading) {
  const pinyinTones = [...pinyin].filter((character) => PINYIN_TONE_MARKS.has(character)).length;
  const readingTones = (vietnameseReading.match(/\([1-4]\)/g) || []).length;
  return pinyinTones === 0 ? readingTones === 0 : readingTones > 0;
}

function isValidLookupResult(result) {
  const intents = ["Vocabulary", "Translation", "Grammar", "Correction", "Conversation", "Explanation"];
  if (!result || typeof result !== "object" || !hasPlainLatinText(result.sourceLanguage) || !intents.includes(result.intent)) return false;
  if (!(typeof result.meaning === "string" && LATIN.test(result.meaning) && !/[<>\u0000-\u001F\u007F]/u.test(result.meaning))
    || !(typeof result.note === "string" && LATIN.test(result.note) && !/[<>\u0000-\u001F\u007F]/u.test(result.note))
    || !hasPlainLatinText(result.partOfSpeech)) return false;
  if (!Array.isArray(result.examples) || result.examples.length !== 2) return false;
  if (!result.examples.every((example) => hasPlainLatinText(example?.english)
    && hasChineseText(example?.chinese)
    && hasPlainLatinText(example?.pinyin)
    && isVietnameseFriendlyReading(example?.vietnameseReading)
    && hasToneGuidance(example.pinyin, example.vietnameseReading)
    && hasPlainLatinText(example?.vietnamese))) return false;

  if (!(typeof result.term === "string" && result.term.length > 0)) return false;
  if (result.sourceLanguage === "Chinese" && !hasChineseText(result.term)) return false;
  if (result.sourceLanguage === "Chinese") {
    return hasPlainLatinText(result.pinyin)
      && isVietnameseFriendlyReading(result.vietnameseReading)
      && hasToneGuidance(result.pinyin, result.vietnameseReading);
  }
  return result.pinyin === "" && result.vietnameseReading === "";
}

async function verifyLookup(testCase) {
  const lookupResponse = await fetch(`${apiUrl}/lookup`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-client-id": testClientId,
      origin: "https://nvtruong473.github.io",
    },
    body: JSON.stringify({ query: testCase.query }),
    signal: AbortSignal.timeout(90_000),
  });
  const lookup = await lookupResponse.json().catch(() => null);
  if (!lookupResponse.ok || !lookup?.ok || !isValidLookupResult(lookup.result)) {
    throw new Error(`Kiểm tra cấu trúc Gemini chưa đạt ở ca ${testCase.id}.`);
  }
  const semanticFailures = evaluateLookupQuality(testCase, lookup.result);
  if (semanticFailures.length > 0) {
    throw new Error(`Kiểm tra ngữ nghĩa chưa đạt ở ca ${testCase.id}: ${semanticFailures.join("; ")}.`);
  }
  return lookup;
}

for (const testCase of lookupQualityCases) await verifyLookup(testCase);
const cacheHit = await verifyLookup({ ...lookupQualityCases[0], query: "  TAKE   IT EASY " });
if (cacheHit.cache?.hit !== true) throw new Error("Cache riêng tư không dùng lại truy vấn tương đương.");
process.stdout.write("Health, Push một chạm, cache mã hóa và bốn ca chuẩn ngữ nghĩa đã đạt. Không in API key.\n");
