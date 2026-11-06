export const declarativeWebPushVersion = 8030;
// RFC 8291 reserves 103 of the provider's guaranteed 4096 octets for the
// aes128gcm header, delimiter and authentication tag.
export const maximumWebPushPayloadBytes = 3_993;
const encoder = new TextEncoder();

function httpsUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(`${label} không hợp lệ.`);
  }
  if (url.protocol !== "https:") throw new TypeError(`${label} phải dùng HTTPS.`);
  return url.href;
}

export function buildDeclarativePushPayload({
  title,
  body,
  navigate,
  icon,
  notificationId,
  timestamp,
  receipt = null,
}) {
  if (typeof title !== "string" || !title.trim()) throw new TypeError("Thông báo thiếu tiêu đề.");
  if (typeof body !== "string" || !body.trim()) throw new TypeError("Thông báo thiếu nội dung.");
  if (typeof notificationId !== "string" || !notificationId.trim() || notificationId.length > 240) {
    throw new TypeError("Mã thông báo không hợp lệ.");
  }
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new TypeError("Thời điểm thông báo không hợp lệ.");

  const payload = {
    web_push: declarativeWebPushVersion,
    // Current WebKit reads app_badge at the declarative payload root. The
    // service-worker path mirrors this for older engines that still wake JS.
    app_badge: "1",
    // Modern WebKit can display the proposed notification even if this worker
    // is evicted. When the worker runs, it replaces the proposal and sends the
    // privacy-preserving delivery receipt. Older browsers ignore these members
    // and execute the same service-worker fallback.
    mutable: true,
    notification: {
      title: title.trim(),
      lang: "vi-VN",
      dir: "ltr",
      body: body.trim(),
      navigate: httpsUrl(navigate, "Liên kết thông báo"),
      icon: httpsUrl(icon, "Icon thông báo"),
      tag: "tam-ngu-current-lesson",
      renotify: false,
      silent: false,
      timestamp,
      data: { notificationId, receipt },
    },
  };
  const serialized = JSON.stringify(payload);
  if (encoder.encode(serialized).byteLength > maximumWebPushPayloadBytes) {
    throw new RangeError("Nội dung Web Push vượt quá giới hạn mã hóa gần 4 KB.");
  }
  return serialized;
}
