import { createHash } from "node:crypto";
import { stat, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULTS = {
  bundleIdentifier: "com.nvtruong.tamngu6h",
  appName: "Tam Ngữ 6H",
  developerName: "NVTruong473",
  minOSVersion: "17.0",
  website: "https://nvtruong473.github.io/tam-ngu-6h/",
  iconURL: "https://nvtruong473.github.io/tam-ngu-6h/icons/icon-v2-1024.png",
};

function requireValue(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`Thiếu ${name}.`);
  return normalized;
}

function validateVersion(value, name) {
  const normalized = requireValue(value, name);
  if (!/^\d+(?:\.\d+){0,3}$/.test(normalized)) {
    throw new Error(`${name} không hợp lệ: ${normalized}`);
  }
  return normalized;
}

function validateDownloadURL(value) {
  const normalized = requireValue(value, "DOWNLOAD_URL");
  const url = new URL(normalized);
  if (url.protocol !== "https:" || !url.pathname.endsWith(".ipa")) {
    throw new Error("DOWNLOAD_URL phải là URL HTTPS trỏ tới file .ipa.");
  }
  return url.href;
}

function validateSha256(value) {
  const normalized = requireValue(value, "SHA256").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error("SHA256 không hợp lệ.");
  return normalized;
}

export async function buildAltStoreSource({
  ipaPath,
  version,
  buildVersion,
  releaseDate,
  downloadURL,
  sha256,
}) {
  const resolvedVersion = validateVersion(version, "APP_VERSION");
  const resolvedBuildVersion = validateVersion(buildVersion, "BUILD_VERSION");
  const resolvedDate = requireValue(releaseDate, "RELEASE_DATE");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(resolvedDate)) {
    throw new Error(`RELEASE_DATE không hợp lệ: ${resolvedDate}`);
  }

  const file = await stat(requireValue(ipaPath, "IPA_PATH"));
  if (!file.isFile() || file.size === 0) throw new Error("IPA rỗng hoặc không phải file.");

  return {
    name: "Tam Ngữ 6H",
    subtitle: "Bản native riêng cho iPhone",
    description: "Thẻ học Anh · Trung · Việt bằng WidgetKit, App Intents và kho bài hoạt động ngay trên thiết bị.",
    iconURL: DEFAULTS.iconURL,
    website: DEFAULTS.website,
    tintColor: "#D26080",
    featuredApps: [DEFAULTS.bundleIdentifier],
    apps: [
      {
        name: DEFAULTS.appName,
        bundleIdentifier: DEFAULTS.bundleIdentifier,
        developerName: DEFAULTS.developerName,
        subtitle: "Học thụ động bằng thẻ native trên iPhone",
        localizedDescription: "Tam Ngữ 6H mang bài Anh · Trung · Việt lên widget Màn hình khóa và Màn hình chính. App có tra cứu, phát âm, bài học offline và không nhúng khóa Gemini vào gói cài đặt.",
        iconURL: DEFAULTS.iconURL,
        tintColor: "#D26080",
        category: "lifestyle",
        versions: [
          {
            version: resolvedVersion,
            buildVersion: resolvedBuildVersion,
            date: resolvedDate,
            localizedDescription: "Bản native đầu tiên có Glance Deck, WidgetKit và App Intent lật bài.",
            downloadURL: validateDownloadURL(downloadURL),
            size: file.size,
            sha256: validateSha256(sha256),
            minOSVersion: DEFAULTS.minOSVersion,
          },
        ],
        appPermissions: {
          entitlements: [],
          privacy: {},
        },
      },
    ],
    news: [],
  };
}

async function main() {
  const ipaPath = process.env.IPA_PATH;
  const outputPath = requireValue(process.env.SOURCE_OUTPUT, "SOURCE_OUTPUT");
  const ipaBuffer = await import("node:fs/promises").then(({ readFile }) => readFile(ipaPath));
  const calculatedHash = createHash("sha256").update(ipaBuffer).digest("hex");
  const suppliedHash = String(process.env.SHA256 || calculatedHash).trim().toLowerCase();
  if (suppliedHash !== calculatedHash) throw new Error("SHA256 không khớp với IPA.");

  const source = await buildAltStoreSource({
    ipaPath,
    version: process.env.APP_VERSION,
    buildVersion: process.env.BUILD_VERSION,
    releaseDate: process.env.RELEASE_DATE,
    downloadURL: process.env.DOWNLOAD_URL,
    sha256: suppliedHash,
  });
  await writeFile(outputPath, `${JSON.stringify(source, null, 2)}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
