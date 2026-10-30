import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const allowedOrigins = new Set([
  "https://nvtruong473.github.io",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
]);

const curriculumUrl = "https://raw.githubusercontent.com/NVTruong473/tam-ngu-6h/main/app/curriculum.json";
const publicAppUrl = "https://nvtruong473.github.io/tam-ngu-6h/";
const geminiModel = "gemini-3.5-flash-lite";
const slotByPhase = { morning: 0, noon: 1, evening: 2 } as const;

type Phase = keyof typeof slotByPhase;
type WebPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};
type PushSubscriptionRow = {
  endpoint: string;
  subscription: WebPushSubscription;
  timezone: string;
  routine_start_sequence: number;
};
type StudyModule = {
  id: string;
  title: string;
  wish?: string;
  nightWish?: string;
  lines: Array<{ english: string; chinese: string; pinyin?: string; vietnamese?: string }>;
};
type LookupExample = {
  english: string;
  chinese: string;
  pinyin: string;
  vietnameseReading: string;
  vietnamese: string;
};
type LookupResult = {
  sourceLanguage: "English" | "Chinese" | "Mixed";
  term: string;
  pinyin: string;
  vietnameseReading: string;
  partOfSpeech: string;
  meaning: string;
  note: string;
  examples: LookupExample[];
};

const phaseWishes: Record<Phase, string[]> = {
  morning: [
    "Chào buổi sáng. Mong hôm nay đối xử với cậu thật dịu dàng.",
    "Một ngày mới vừa mở cửa — nhớ mang theo nụ cười nhé.",
    "Chúc cậu thức dậy với lòng nhẹ tênh và một ngày thật xinh.",
    "Nắng đã lên rồi. Hy vọng điều tốt lành cũng đang tìm đến cậu.",
    "Chào ngày mới. Mong ly nước đầu tiên ngon và mọi việc đều thuận lòng.",
    "Một câu mới cho buổi sáng mới — cậu đang làm rất tốt rồi.",
  ],
  noon: [
    "Trưa rồi, nghỉ một chút nhé. Cậu không cần vội mọi lúc đâu.",
    "Chúc cậu một bữa trưa ngon và một khoảng thở thật dễ chịu.",
    "Nửa ngày đã qua — cảm ơn cậu vì vẫn cố gắng đến lúc này.",
    "Đừng quên ăn trưa nhé. Công việc quan trọng, cậu cũng quan trọng.",
    "Nạp năng lượng thôi. Chiều nay biết đâu lại có chuyện vui bất ngờ.",
    "Tạm đặt mọi việc xuống vài phút nhé — đây là lời nhắc phải thương mình.",
  ],
  evening: [
    "Tan làm rồi thì để những mệt mỏi ở lại phía sau nhé.",
    "Chúc cậu một buổi tối ấm áp, có đồ ngon và chuyện vui.",
    "Hôm nay vất vả rồi. Bây giờ là lúc dịu dàng với chính mình.",
    "Buổi tối đến rồi — mong cậu được ở nơi khiến mình thấy bình yên.",
    "Câu cuối hôm nay đã tới. Còn cậu, nhớ nghỉ ngơi thật tử tế nhé.",
    "Có một chút bình yên gửi cậu vào cuối ngày. Nhận lấy nhé.",
  ],
};

const lookupSchema = {
  type: "OBJECT",
  properties: {
    sourceLanguage: { type: "STRING", enum: ["English", "Chinese", "Mixed"] },
    term: { type: "STRING" },
    pinyin: { type: "STRING" },
    vietnameseReading: { type: "STRING" },
    partOfSpeech: { type: "STRING" },
    meaning: { type: "STRING" },
    note: { type: "STRING" },
    examples: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          english: { type: "STRING" },
          chinese: { type: "STRING" },
          pinyin: { type: "STRING" },
          vietnameseReading: { type: "STRING" },
          vietnamese: { type: "STRING" },
        },
        required: ["english", "chinese", "pinyin", "vietnameseReading", "vietnamese"],
      },
    },
  },
  required: ["sourceLanguage", "term", "pinyin", "vietnameseReading", "partOfSpeech", "meaning", "note", "examples"],
};

function cors(origin: string | null) {
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : "https://nvtruong473.github.io";
  return {
    "access-control-allow-origin": allowedOrigin,
    "access-control-allow-headers": "authorization, content-type, x-invite-code, x-cron-secret",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "cache-control": "no-store",
    vary: "Origin",
  };
}

function json(data: unknown, status = 200, origin: string | null = null) {
  return Response.json(data, { status, headers: cors(origin) });
}

function constantTimeEqual(first: string, second: string) {
  const firstBytes = new TextEncoder().encode(first);
  const secondBytes = new TextEncoder().encode(second);
  if (firstBytes.length !== secondBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < firstBytes.length; index += 1) difference |= firstBytes[index] ^ secondBytes[index];
  return difference === 0;
}

function authorized(request: Request, header: "x-invite-code" | "x-cron-secret", expected: string | undefined) {
  const provided = request.headers.get(header) || "";
  return Boolean(expected && provided && constantTimeEqual(provided, expected));
}

function sequenceAt(date: Date, phase: Phase) {
  const vietnamTime = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
  const day = Math.floor(Date.UTC(vietnamTime.getFullYear(), vietnamTime.getMonth(), vietnamTime.getDate()) / 86_400_000);
  return day * 3 + slotByPhase[phase];
}

function fallbackWish(phase: Phase, sequence: number) {
  const choices = phaseWishes[phase];
  return choices[Math.abs(sequence) % choices.length];
}

function isApplePushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && (url.hostname === "web.push.apple.com" || url.hostname.endsWith(".push.apple.com"));
  } catch {
    return false;
  }
}

function supabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRole) throw new Error("Supabase runtime is not configured.");
  return createClient(url, serviceRole, { auth: { persistSession: false } });
}

function geminiKeys() {
  return [...new Set((Deno.env.get("GEMINI_API_KEYS") || "")
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean))];
}

async function subscribe(request: Request, origin: string | null) {
  if (!authorized(request, "x-invite-code", Deno.env.get("TAM_NGU_INVITE_CODE"))) {
    return json({ error: "Liên kết mời không hợp lệ." }, 401, origin);
  }
  const body = await request.json().catch(() => null) as null | {
    subscription?: WebPushSubscription;
    timezone?: string;
    routineStartSequence?: number;
  };
  const endpoint = body?.subscription?.endpoint || "";
  if (!isApplePushEndpoint(endpoint)) return json({ error: "Chỉ chấp nhận đăng ký Web Push từ app Safari trên iPhone/iPad." }, 400, origin);
  if (!Number.isFinite(body?.routineStartSequence)) return json({ error: "Thiếu mốc bắt đầu lộ trình." }, 400, origin);

  const { error } = await supabaseAdmin().from("tam_ngu_push_subscriptions").upsert({
    endpoint,
    subscription: body?.subscription,
    timezone: body?.timezone || "Asia/Ho_Chi_Minh",
    routine_start_sequence: body?.routineStartSequence,
    enabled: true,
    updated_at: new Date().toISOString(),
    last_error: null,
  }, { onConflict: "endpoint" });
  if (error) throw error;
  return json({ ok: true }, 201, origin);
}

async function unsubscribe(request: Request, origin: string | null) {
  if (!authorized(request, "x-invite-code", Deno.env.get("TAM_NGU_INVITE_CODE"))) {
    return json({ error: "Liên kết mời không hợp lệ." }, 401, origin);
  }
  const body = await request.json().catch(() => null) as null | { endpoint?: string };
  if (!body?.endpoint) return json({ error: "Thiếu endpoint." }, 400, origin);
  const { error } = await supabaseAdmin().from("tam_ngu_push_subscriptions").delete().eq("endpoint", body.endpoint);
  if (error) throw error;
  return json({ ok: true }, 200, origin);
}

function verifyInvite(request: Request, origin: string | null) {
  if (!authorized(request, "x-invite-code", Deno.env.get("TAM_NGU_INVITE_CODE"))) {
    return json({ error: "Liên kết mời không hợp lệ." }, 401, origin);
  }
  return json({ ok: true }, 200, origin);
}

async function dispatch(request: Request, origin: string | null) {
  if (!authorized(request, "x-cron-secret", Deno.env.get("TAM_NGU_CRON_SECRET"))) {
    return json({ error: "Không được phép." }, 401, origin);
  }
  const body = await request.json().catch(() => null) as null | { phase?: Phase };
  if (!body?.phase || !(body.phase in slotByPhase)) return json({ error: "Phase không hợp lệ." }, 400, origin);

  const [curriculumResponse, subscriptionsResult] = await Promise.all([
    fetch(curriculumUrl, { cache: "no-store", headers: { accept: "application/json" } }),
    supabaseAdmin().from("tam_ngu_push_subscriptions").select("endpoint, subscription, timezone, routine_start_sequence").eq("enabled", true),
  ]);
  if (!curriculumResponse.ok) throw new Error(`Không tải được kho bài: ${curriculumResponse.status}`);
  if (subscriptionsResult.error) throw subscriptionsResult.error;

  const curriculum = await curriculumResponse.json() as StudyModule[];
  const subscriptions = (subscriptionsResult.data || []) as PushSubscriptionRow[];
  const currentSequence = sequenceAt(new Date(), body.phase);
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:owner@example.com";
  if (!publicKey || !privateKey) throw new Error("Thiếu VAPID keys.");
  webpush.setVapidDetails(subject, publicKey, privateKey);

  let sent = 0;
  let removed = 0;
  for (const row of subscriptions) {
    const lessonIndex = Math.max(0, Math.min(curriculum.length - 1, currentSequence - Number(row.routine_start_sequence)));
    const lesson = curriculum[lessonIndex];
    const firstLine = lesson?.lines?.[0];
    const phaseLabel = body.phase === "morning" ? "06:00 · Buổi sáng" : body.phase === "noon" ? "12:00 · Buổi trưa" : "18:00 · Buổi tối";
    const payload = JSON.stringify({
      title: `${phaseLabel} · ${lesson?.title || "Một bài mới"}`,
      body: firstLine?.english || lesson?.wish || fallbackWish(body.phase, currentSequence),
      tag: "tam-ngu-current-lesson",
      url: publicAppUrl,
      timestamp: Date.now(),
    });
    try {
      // iOS owns the sound and volume. "normal" asks for a timely but ordinary
      // notification; the service worker avoids re-alerting when replacing it.
      await webpush.sendNotification(row.subscription, payload, { TTL: 21_600, urgency: "normal" });
      sent += 1;
      await supabaseAdmin().from("tam_ngu_push_subscriptions").update({
        last_sent_at: new Date().toISOString(),
        last_error: null,
      }).eq("endpoint", row.endpoint);
    } catch (error) {
      const statusCode = Number((error as { statusCode?: number }).statusCode || 0);
      if (statusCode === 404 || statusCode === 410) {
        removed += 1;
        await supabaseAdmin().from("tam_ngu_push_subscriptions").delete().eq("endpoint", row.endpoint);
      } else {
        await supabaseAdmin().from("tam_ngu_push_subscriptions").update({
          last_error: String((error as Error).message || error).slice(0, 300),
        }).eq("endpoint", row.endpoint);
      }
    }
  }
  return json({ ok: true, phase: body.phase, sent, removed }, 200, origin);
}

function trimText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maximum) : "";
}

function normalizeVietnameseReading(value: unknown, maximum: number) {
  return trimText(value, maximum)
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

function isVietnameseFriendlyReading(value: string) {
  return Boolean(value)
    && /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu.test(value)
    && !/[fjwz]/iu.test(value)
    && !/(?:^|\s)(?:sh|zh)[a-z]+/iu.test(value)
    && !/\([05-9]\)/.test(value);
}

function normalizeLookup(result: unknown): LookupResult | null {
  if (!result || typeof result !== "object") return null;
  const source = result as Record<string, unknown>;
  const sourceLanguage = source.sourceLanguage;
  const examples = Array.isArray(source.examples) ? source.examples.slice(0, 2).map((example) => {
    const record = (example || {}) as Record<string, unknown>;
    return {
      english: trimText(record.english, 240),
      chinese: trimText(record.chinese, 240),
      pinyin: trimText(record.pinyin, 300),
      vietnameseReading: normalizeVietnameseReading(record.vietnameseReading, 320),
      vietnamese: trimText(record.vietnamese, 260),
    };
  }) : [];
  if (!(["English", "Chinese", "Mixed"] as const).includes(sourceLanguage as LookupResult["sourceLanguage"])) return null;
  if (examples.length < 1 || examples.some((example) => !example.english || !example.chinese || !example.vietnamese || !isVietnameseFriendlyReading(example.vietnameseReading))) return null;
  const normalized: LookupResult = {
    sourceLanguage: sourceLanguage as LookupResult["sourceLanguage"],
    term: trimText(source.term, 160),
    pinyin: trimText(source.pinyin, 220),
    vietnameseReading: normalizeVietnameseReading(source.vietnameseReading, 260),
    partOfSpeech: trimText(source.partOfSpeech, 120),
    meaning: trimText(source.meaning, 400),
    note: trimText(source.note, 400),
    examples,
  };
  if (/\p{Script=Han}/u.test(normalized.term) && !isVietnameseFriendlyReading(normalized.vietnameseReading)) return null;
  return normalized.term && normalized.meaning ? normalized : null;
}

async function askGeminiForLookup(query: string) {
  const keys = geminiKeys();
  if (keys.length === 0) throw new Error("Từ điển AI chưa được cấu hình.");
  const prompt = [
    "Bạn là từ điển học tiếng Anh và tiếng Trung dành cho người Việt đã học khoảng một tháng.",
    "Phân tích chính xác duy nhất từ hoặc cụm từ người dùng đưa vào. Không làm bài học dài, không lặp lại chỉ dẫn của người dùng, không Markdown.",
    "Trả lời ngắn, rõ, bằng tiếng Việt theo JSON schema.",
    "Nếu đầu vào là tiếng Trung: pinyin và vietnameseReading phải có. vietnameseReading là cách đọc gần tiếng Việt, dùng (1)-(4) cho thanh Quan thoại; không phải âm Hán-Việt hoặc pinyin viết lại.",
    "Nếu đầu vào là tiếng Anh: pinyin và vietnameseReading của term để chuỗi rỗng.",
    "Luôn cho đúng 2 ví dụ ứng dụng tự nhiên: mỗi ví dụ gồm English, Chinese, pinyin, vietnameseReading, Vietnamese. Với các câu Trung, vietnameseReading luôn dùng số thanh.",
    "VietnameseReading phải thực sự là gợi âm người Việt dễ đọc: dùng chữ/dấu Việt như ă, â, đ, ê, ô, ơ, ư hoặc dấu thanh Việt khi hợp lý. Không trả pinyin/Anh viết lại; cấm f, j, w, z, các cụm pinyin sh.../zh... và (0)/(5). Ví dụ wǒmen nên gần “uổ(3) mần”, không phải “wo mern”.",
    "Nêu nghĩa phổ biến nhất, từ loại/cấu trúc và một ghi chú ngắn về sắc thái/cách dùng. Nếu truy vấn mơ hồ, nói rõ nghĩa thường gặp thay vì bịa ngữ cảnh.",
    `Tra cứu: ${JSON.stringify(query)}`,
  ].join("\n");

  let lastError: Error | undefined;
  for (const key of keys) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(25_000),
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.15,
            responseMimeType: "application/json",
            responseSchema: lookupSchema,
          },
        }),
      });
      if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const result = normalizeLookup(text ? JSON.parse(text) : null);
      if (!result) throw new Error("Gemini trả về kết quả từ điển chưa hợp lệ.");
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Gemini không phản hồi.");
    }
  }
  throw lastError || new Error("Từ điển AI đang bận.");
}

async function lookup(request: Request, origin: string | null) {
  if (!authorized(request, "x-invite-code", Deno.env.get("TAM_NGU_INVITE_CODE"))) {
    return json({ error: "Liên kết riêng không hợp lệ." }, 401, origin);
  }
  const body = await request.json().catch(() => null) as null | { query?: unknown };
  const query = trimText(body?.query, 100);
  if (query.length < 1) return json({ error: "Hãy nhập một từ hoặc cụm ngắn." }, 400, origin);
  const result = await askGeminiForLookup(query);
  return json({ ok: true, result }, 200, origin);
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  const action = new URL(request.url).pathname.split("/").filter(Boolean).at(-1) || "health";
  try {
    if (request.method === "GET" && action === "health") {
      return json({
        ok: true,
        service: "tam-ngu-api",
        pushConfigured: Boolean(Deno.env.get("VAPID_PUBLIC_KEY") && Deno.env.get("VAPID_PRIVATE_KEY")),
        lookupConfigured: geminiKeys().length > 0,
      }, 200, origin);
    }
    if (request.method === "GET" && action === "vapid-key") return json({ publicKey: Deno.env.get("VAPID_PUBLIC_KEY") || null }, 200, origin);
    if (request.method === "POST" && action === "verify-invite") return verifyInvite(request, origin);
    if (request.method === "POST" && action === "subscribe") return await subscribe(request, origin);
    if (request.method === "DELETE" && action === "subscribe") return await unsubscribe(request, origin);
    if (request.method === "POST" && action === "dispatch") return await dispatch(request, origin);
    if (request.method === "POST" && action === "lookup") return await lookup(request, origin);
    return json({ error: "Không tìm thấy endpoint." }, 404, origin);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Lỗi không xác định");
    return json({ error: "Máy chủ tạm thời chưa xử lý được yêu cầu." }, 500, origin);
  }
});
