import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Android manifest bundles the Tam Ngữ widget provider", async () => {
  const manifest = await read("android/app/src/main/AndroidManifest.xml");
  assert.match(manifest, /\.TamNguLessonWidget/);
  assert.match(manifest, /android\.appwidget\.action\.APPWIDGET_UPDATE/);
  assert.match(manifest, /@xml\/tam_ngu_widget_info/);
});

test("Android widget is passive, resizable and refreshes without notification permission", async () => {
  const info = await read("android/app/src/main/res/xml/tam_ngu_widget_info.xml");
  assert.match(info, /android:updatePeriodMillis="1800000"/);
  assert.match(info, /android:resizeMode="horizontal\|vertical"/);
  const manifest = await read("android/app/src/main/AndroidManifest.xml");
  assert.doesNotMatch(manifest, /SCHEDULE_EXACT_ALARM/);
});

test("Android one-tap widget bridge is registered and stores no API key", async () => {
  const activity = await read("android/app/src/main/java/com/nvtruong/tamngu6h/MainActivity.java");
  const plugin = await read("android/app/src/main/java/com/nvtruong/tamngu6h/TamNguWidgetPlugin.java");
  const provider = await read("android/app/src/main/java/com/nvtruong/tamngu6h/TamNguLessonWidget.java");
  assert.match(activity, /registerPlugin\(TamNguWidgetPlugin\.class\)/);
  assert.match(plugin, /requestPinAppWidget/);
  assert.match(provider, /public\/widget-lessons\.json/);
  assert.doesNotMatch(`${plugin}\n${provider}`, /AIza|GEMINI_API_KEY|sk-[A-Za-z0-9]/);
});

test("Android release workflow verifies signing and exposes a stable APK", async () => {
  const workflow = await read(".github/workflows/native-android.yml");
  assert.match(workflow, /apksigner.*verify/);
  assert.match(workflow, /ANDROID_KEYSTORE_BASE64/);
  assert.match(workflow, /android-stable/);
  const page = await read("app/page.tsx");
  assert.match(page, /releases\/download\/android-stable\/TamNgu6H\.apk/);
});
