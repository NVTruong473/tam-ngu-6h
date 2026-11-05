const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const RETRYABLE_STATUS_CODES = new Set([0, 408, 425, 429, 500, 502, 503, 504]);

function headerValue(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get(name) || "";
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  const value = match?.[1];
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function retryAfterMilliseconds(headers, now = Date.now()) {
  const raw = headerValue(headers, "retry-after").trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw) * 1_000;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - now) : null;
}

function previousDateKey(dateKey) {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(4, 6));
  const day = Number(dateKey.slice(6, 8));
  const previous = new Date(Date.UTC(year, month - 1, day) - 86_400_000);
  return `${previous.getUTCFullYear()}${String(previous.getUTCMonth() + 1).padStart(2, "0")}${String(previous.getUTCDate()).padStart(2, "0")}`;
}

export function isRetryablePushFailure(statusCode) {
  const status = Number(statusCode || 0);
  return RETRYABLE_STATUS_CODES.has(status) || (status >= 500 && status <= 599);
}

export function pushRetryDelayMs(statusCode, headers, attempt, now = Date.now()) {
  if (!isRetryablePushFailure(statusCode)) return null;
  const requested = retryAfterMilliseconds(headers, now);
  const fallback = 600 * (2 ** Math.max(0, Number(attempt) || 0));
  // A later cron run remains responsible for long provider backoffs. Keeping
  // in-request waits short protects Supabase Free's Edge Function time budget.
  return Math.min(5_000, Math.max(250, requested ?? fallback));
}

export function latestDueSchedule(clock, times, graceMinutes = 10) {
  if (!clock || !/^\d{8}$/.test(clock.dateKey || "") || !Number.isInteger(clock.minuteOfDay)) return null;
  let result = null;
  for (const time of times || []) {
    if (!TIME_PATTERN.test(time)) continue;
    const [hour, minute] = time.split(":").map(Number);
    const scheduledMinute = hour * 60 + minute;
    const crossedMidnight = scheduledMinute > clock.minuteOfDay;
    const latenessMinutes = clock.minuteOfDay - scheduledMinute + (crossedMidnight ? 1_440 : 0);
    if (latenessMinutes < 0 || latenessMinutes > graceMinutes) continue;
    if (!result || latenessMinutes < result.latenessMinutes) {
      result = {
        time,
        hour,
        latenessMinutes,
        dispatchKey: `${crossedMidnight ? previousDateKey(clock.dateKey) : clock.dateKey}${time.replace(":", "")}`,
      };
    }
  }
  return result;
}

export async function mapWithConcurrency(items, concurrency, worker) {
  const values = Array.from(items || []);
  if (values.length === 0) return [];
  const width = Math.max(1, Math.min(values.length, Math.floor(concurrency) || 1));
  const results = new Array(values.length);
  let cursor = 0;

  async function run() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: width }, () => run()));
  return results;
}
