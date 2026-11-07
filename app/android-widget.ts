import { Capacitor, registerPlugin } from "@capacitor/core";

type TamNguWidgetPlugin = {
  requestPin(): Promise<{ supported: boolean; requested: boolean }>;
  syncConfig(options: { scheduleJson: string }): Promise<void>;
  refresh(): Promise<void>;
};

const TamNguWidget = registerPlugin<TamNguWidgetPlugin>("TamNguWidget");

export function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function syncAndroidWidget(scheduleTimes: string[]) {
  if (!isNativeAndroid()) return;
  await TamNguWidget.syncConfig({ scheduleJson: JSON.stringify(scheduleTimes) });
}

export async function requestAndroidWidgetPin() {
  if (!isNativeAndroid()) return { supported: false, requested: false };
  return TamNguWidget.requestPin();
}

export async function refreshAndroidWidgets() {
  if (!isNativeAndroid()) return;
  await TamNguWidget.refresh();
}
