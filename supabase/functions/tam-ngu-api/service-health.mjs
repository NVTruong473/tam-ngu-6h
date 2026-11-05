export const schedulerFreshnessSeconds = 300;

export function schedulerHealth(lastSeenAt, now = Date.now()) {
  const seenAt = Date.parse(String(lastSeenAt || ""));
  if (!Number.isFinite(seenAt)) return { fresh: false, ageSeconds: null };

  const ageSeconds = Math.max(0, Math.round((now - seenAt) / 1000));
  return {
    fresh: seenAt <= now + 60_000 && ageSeconds <= schedulerFreshnessSeconds,
    ageSeconds,
  };
}
