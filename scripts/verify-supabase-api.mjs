import { execFileSync } from "node:child_process";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) throw new Error("Thiếu SUPABASE_PROJECT_REF.");

const apiUrl = `https://${ref}.supabase.co/functions/v1/tam-ngu-api`;
const healthResponse = await fetch(`${apiUrl}/health`);
const health = await healthResponse.json().catch(() => null);
if (!healthResponse.ok || !health?.ok || !health.pushConfigured || !health.lookupConfigured) {
  throw new Error("Health check chưa xác nhận được Push và Gemini lookup.");
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

const privateInvite = execFileSync("security", ["find-generic-password", "-s", "TamNgu6H Invite", "-w"], { encoding: "utf8" }).trim();
let inviteCode = privateInvite;
try {
  inviteCode = new URL(privateInvite).hash.match(/(?:^#|[&#])invite=([^&]+)/)?.[1] || "";
  inviteCode = decodeURIComponent(inviteCode);
} catch {
  // The Keychain item may deliberately hold only the invite code.
}
if (!inviteCode) throw new Error("Không đọc được mã ghép đôi riêng từ Keychain.");

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
  if (!result || typeof result !== "object" || !["English", "Chinese", "Mixed"].includes(result.sourceLanguage)) return false;
  if (!hasPlainLatinText(result.meaning) || !hasPlainLatinText(result.note) || !hasPlainLatinText(result.partOfSpeech)) return false;
  if (!Array.isArray(result.examples) || result.examples.length !== 2) return false;
  if (!result.examples.every((example) => hasPlainLatinText(example?.english)
    && hasChineseText(example?.chinese)
    && hasPlainLatinText(example?.pinyin)
    && isVietnameseFriendlyReading(example?.vietnameseReading)
    && hasToneGuidance(example.pinyin, example.vietnameseReading)
    && hasPlainLatinText(example?.vietnamese))) return false;

  const hasChineseTerm = typeof result.term === "string" && HAN.test(result.term);
  if (result.sourceLanguage === "Chinese" && !hasChineseText(result.term)) return false;
  if (result.sourceLanguage === "English" && !hasPlainLatinText(result.term)) return false;
  if (hasChineseTerm) {
    return hasPlainLatinText(result.pinyin)
      && isVietnameseFriendlyReading(result.vietnameseReading)
      && hasToneGuidance(result.pinyin, result.vietnameseReading);
  }
  return result.pinyin === "" && result.vietnameseReading === "";
}

async function verifyLookup(query) {
  const lookupResponse = await fetch(`${apiUrl}/lookup`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-invite-code": inviteCode },
    body: JSON.stringify({ query }),
  });
  const lookup = await lookupResponse.json().catch(() => null);
  if (!lookupResponse.ok || !lookup?.ok || !isValidLookupResult(lookup.result)) {
    throw new Error("Kiểm tra tra nhanh Gemini chưa đạt.");
  }
}

await verifyLookup("take it easy");
await verifyLookup("慢一点");
process.stdout.write("Health, Push một chạm và hai lượt tra Gemini (Anh/Trung) đã đạt. Không in mã mời hoặc API key.\n");
