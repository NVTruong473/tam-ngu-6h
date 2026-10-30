import { execFileSync } from "node:child_process";

const ref = process.env.SUPABASE_PROJECT_REF;
if (!ref) throw new Error("Thiếu SUPABASE_PROJECT_REF.");

const apiUrl = `https://${ref}.supabase.co/functions/v1/tam-ngu-api`;
const healthResponse = await fetch(`${apiUrl}/health`);
const health = await healthResponse.json().catch(() => null);
if (!healthResponse.ok || !health?.ok || !health.pushConfigured || !health.lookupConfigured) {
  throw new Error("Health check chưa xác nhận được Push và Gemini lookup.");
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

const lookupResponse = await fetch(`${apiUrl}/lookup`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-invite-code": inviteCode },
  body: JSON.stringify({ query: "take it easy" }),
});
const lookup = await lookupResponse.json().catch(() => null);
if (!lookupResponse.ok || !lookup?.ok || !lookup?.result?.term || !Array.isArray(lookup?.result?.examples) || lookup.result.examples.length !== 2) {
  throw new Error("Kiểm tra tra nhanh Gemini chưa đạt.");
}

process.stdout.write("Health, Web Push configuration và một lượt tra Gemini đã đạt. Không in mã mời hoặc API key.\n");
