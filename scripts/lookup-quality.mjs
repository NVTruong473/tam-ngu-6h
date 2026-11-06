const HAN = /\p{Script=Han}/u;

export const lookupQualityCases = Object.freeze([
  Object.freeze({
    id: "english-idiom",
    query: "take it easy",
    expectedSourceLanguage: "English",
    allowedIntents: Object.freeze(["Vocabulary", "Translation", "Explanation"]),
  }),
  Object.freeze({
    id: "chinese-phrase",
    query: "慢一点",
    expectedSourceLanguage: "Chinese",
    allowedIntents: Object.freeze(["Vocabulary", "Translation", "Explanation"]),
    requireHanTerm: true,
  }),
  Object.freeze({
    id: "polite-rewrite",
    query: "Please rewrite politely: I need more time.",
    expectedSourceLanguage: "English",
    allowedIntents: Object.freeze(["Correction"]),
    directRewrite: true,
    forbidden: Object.freeze([/kích ơn/iu]),
  }),
  Object.freeze({
    id: "japanese-explanation",
    query: "お疲れ様はどういう意味ですか？",
    expectedSourceLanguage: "Japanese",
    allowedIntents: Object.freeze(["Explanation", "Translation"]),
  }),
]);

export function evaluateLookupQuality(testCase, result) {
  const failures = [];
  const sourceLanguage = String(result?.sourceLanguage || "").trim();
  const intent = String(result?.intent || "").trim();
  const meaning = String(result?.meaning || "").trim();
  const term = String(result?.term || "").trim();

  if (sourceLanguage.toLowerCase() !== testCase.expectedSourceLanguage.toLowerCase()) {
    failures.push(`sourceLanguage phải là ${testCase.expectedSourceLanguage}, nhận ${sourceLanguage || "rỗng"}`);
  }
  if (!testCase.allowedIntents.includes(intent)) {
    failures.push(`intent ${intent || "rỗng"} không thuộc ${testCase.allowedIntents.join("/")}`);
  }
  if (testCase.requireHanTerm && !HAN.test(term)) {
    failures.push("term phải giữ chữ Hán của truy vấn");
  }
  if (testCase.directRewrite) {
    const firstLine = meaning.split(/\r?\n/u, 1)[0].trim();
    if (!/^(?:Could|Would|May|I(?:'d| would| was wondering))\b/iu.test(firstLine)
      || !/\btime\b/iu.test(firstLine)) {
      failures.push("meaning phải bắt đầu bằng câu tiếng Anh đã viết lại, lịch sự và còn ý 'time'");
    }
  }
  for (const pattern of testCase.forbidden || []) {
    pattern.lastIndex = 0;
    if (pattern.test(`${meaning}\n${String(result?.note || "")}`)) {
      failures.push(`kết quả chứa mẫu bị cấm ${pattern}`);
    }
  }
  return failures;
}

export function selectDailyLookupQualityCase(date = new Date()) {
  const dayNumber = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
  return lookupQualityCases[dayNumber % lookupQualityCases.length];
}
