export const deliveryPhases = ["morning", "noon", "evening", "night"];

export function deliveryPhaseAtHour(hour) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError("Giờ giao bài phải nằm trong khoảng 0–23.");
  }
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "noon";
  if (hour < 22) return "evening";
  return "night";
}

export function symbolForDeliveryPhase(phase) {
  if (phase === "morning") return "☀️";
  if (phase === "noon") return "🌤️";
  return "🌙";
}
