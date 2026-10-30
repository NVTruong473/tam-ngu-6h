import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const allowedOrigins = new Set([
  "https://nvtruong473.github.io",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
]);

const curriculumUrl = "https://raw.githubusercontent.com/NVTruong473/tam-ngu-6h/main/app/curriculum.json";
const slotByPhase = { morning: 0, noon: 1, evening: 2 } as const;

type Phase = keyof typeof slotByPhase;
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
  lines: Array<{ english: string; chinese: string }>;
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
  if (!isApplePushEndpoint(endpoint)) return json({ error: "Chỉ chấp nhận đăng ký Web Push từ iPhone/iPad." }, 400, origin);
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
    fetch(curriculumUrl, { headers: { accept: "application/json" } }),
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
    const phaseLabel = body.phase === "morning" ? "Buổi sáng" : body.phase === "noon" ? "Buổi trưa" : "Buổi tối";
    const payload = JSON.stringify({
      title: `${phaseLabel} có một bài mới ✦`,
      body: lesson?.wish || fallbackWish(body.phase, currentSequence),
      tag: `tam-ngu-${body.phase}`,
      url: "https://nvtruong473.github.io/tam-ngu-6h/",
      timestamp: Date.now(),
    });
    try {
      await webpush.sendNotification(row.subscription, payload, { TTL: 21_600, urgency: "high" });
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

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  const action = new URL(request.url).pathname.split("/").filter(Boolean).at(-1) || "health";
  try {
    if (request.method === "GET" && action === "health") return json({ ok: true, service: "tam-ngu-api" }, 200, origin);
    if (request.method === "GET" && action === "vapid-key") return json({ publicKey: Deno.env.get("VAPID_PUBLIC_KEY") || null }, 200, origin);
    if (request.method === "POST" && action === "verify-invite") return verifyInvite(request, origin);
    if (request.method === "POST" && action === "subscribe") return await subscribe(request, origin);
    if (request.method === "DELETE" && action === "subscribe") return await unsubscribe(request, origin);
    if (request.method === "POST" && action === "dispatch") return await dispatch(request, origin);
    return json({ error: "Không tìm thấy endpoint." }, 404, origin);
  } catch (error) {
    console.error(error);
    return json({ error: "Máy chủ tạm thời chưa xử lý được yêu cầu." }, 500, origin);
  }
});
