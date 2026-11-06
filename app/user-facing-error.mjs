/**
 * Keep browser and transport jargon out of the interface while preserving
 * useful Vietnamese errors returned intentionally by the API.
 * @param {unknown} error
 * @param {string} fallback
 */
export function userFacingError(error, fallback) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (/failed to fetch|network ?error|load failed/i.test(message)) {
    return "Không kết nối được. Hãy kiểm tra mạng rồi chạm thử lại nhé.";
  }
  return message || fallback;
}
