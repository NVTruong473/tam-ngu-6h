import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildAltStoreSource } from "../scripts/generate-altstore-source.mjs";

test("AltStore source declares the exact native identity and privacy surface", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tam-ngu-altstore-"));
  const ipaPath = path.join(directory, "TamNgu6H.ipa");
  await writeFile(ipaPath, "test-ipa");

  const source = await buildAltStoreSource({
    ipaPath,
    version: "1.0",
    buildVersion: "2",
    releaseDate: "2026-11-07",
    downloadURL: "https://github.com/NVTruong473/tam-ngu-6h/releases/download/native-v1.0.2/TamNgu6H.ipa",
    sha256: "0".repeat(64),
  });

  assert.equal(source.apps.length, 1);
  assert.equal(source.apps[0].bundleIdentifier, "com.nvtruong.tamngu6h");
  assert.equal(source.apps[0].versions[0].version, "1.0");
  assert.equal(source.apps[0].versions[0].buildVersion, "2");
  assert.equal(source.apps[0].versions[0].minOSVersion, "17.0");
  assert.equal(source.apps[0].versions[0].size, 8);
  assert.deepEqual(source.apps[0].appPermissions, { entitlements: [], privacy: {} });
});

test("AltStore source rejects an insecure or non-IPA download", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "tam-ngu-altstore-"));
  const ipaPath = path.join(directory, "TamNgu6H.ipa");
  await writeFile(ipaPath, "test-ipa");

  await assert.rejects(
    buildAltStoreSource({
      ipaPath,
      version: "1.0",
      buildVersion: "1",
      releaseDate: "2026-11-07",
      downloadURL: "http://example.com/source.js",
      sha256: "0".repeat(64),
    }),
    /HTTPS trỏ tới file \.ipa/,
  );
});
