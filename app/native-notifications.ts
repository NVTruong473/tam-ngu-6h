import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";

export type NativeLesson = {
  id: string;
  title: string;
  notification?: { english: string; chinese: string; vietnamese: string };
  lines: Array<{ english: string; chinese: string; vietnamese: string }>;
};

export type NativeScheduleResult = {
  scheduled: number;
  finalDate: Date | null;
};

// iOS allows at most 64 pending local notifications.  Leave a few places for
// system and future in-app actions instead of silently losing a lesson.
const MAX_PENDING_LESSONS = 60;
const NOTIFICATION_ID_BASE = 6_060_000;
const NOTIFICATION_ID_END = NOTIFICATION_ID_BASE + MAX_PENDING_LESSONS;
const ANDROID_CHANNEL_ID = "tam_ngu_lessons";

export function isNativeTamNguApp() {
  return Capacitor.isNativePlatform();
}

function parseTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return { hours, minutes };
}

function nextLessonDates(scheduleTimes: string[], amount: number, now = new Date()) {
  const dates: Date[] = [];
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // At 24 reminders/day, 60 upcoming entries only cover 2.5 days.  That is an
  // iOS system limit, not a product limit; opening the app renews this rolling
  // window and remote push later keeps it fresh when it is never opened.
  for (let day = 0; dates.length < amount && day < 90; day += 1) {
    for (const time of scheduleTimes) {
      const { hours, minutes } = parseTime(time);
      const candidate = new Date(today);
      candidate.setDate(today.getDate() + day);
      candidate.setHours(hours, minutes, 0, 0);
      if (candidate.getTime() > now.getTime() + 5_000) dates.push(candidate);
      if (dates.length === amount) break;
    }
  }
  return dates;
}

async function clearOwnedNotifications() {
  const { notifications } = await LocalNotifications.getPending();
  const owned = notifications
    .filter((notification) => notification.id >= NOTIFICATION_ID_BASE && notification.id < NOTIFICATION_ID_END)
    .map(({ id }) => ({ id }));
  if (owned.length > 0) await LocalNotifications.cancel({ notifications: owned });
}

async function ensureAndroidChannel() {
  if (Capacitor.getPlatform() !== "android") return;
  await LocalNotifications.createChannel({
    id: ANDROID_CHANNEL_ID,
    name: "Bài học Tam Ngữ",
    description: "Bài học nhẹ nhàng theo giờ bạn chọn",
    // IMPORTANCE_LOW: visible, but no intrusive heads-up alert or sound.
    importance: 2,
  });
}

function formatLessonNotification(lesson: NativeLesson, date: Date, index: number): LocalNotificationSchema {
  const source = lesson.notification || lesson.lines[0] || {
    english: "A new lesson is ready.",
    chinese: "新的一课已经准备好了。",
    vietnamese: "Một bài học mới đã sẵn sàng.",
  };
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  const body = `EN  ${source.english}\n中  ${source.chinese}\nVI  ${source.vietnamese}`;

  return {
    id: NOTIFICATION_ID_BASE + index,
    title: `✨ ${time} · ${lesson.title}`,
    body,
    // Android presents this as an expanded, readable card. iOS keeps its
    // compact system banner, then uses the bundled native extension in the
    // release build for the richer view.
    largeBody: body,
    summaryText: "Tam Ngữ 6H · Chạm để mở bài",
    inboxList: [`EN  ${source.english}`, `中  ${source.chinese}`, `VI  ${source.vietnamese}`],
    channelId: ANDROID_CHANNEL_ID,
    threadIdentifier: "tam-ngu-current-lesson",
    relevanceScore: 0.7,
    interruptionLevel: "passive",
    foreground: false,
    isExactNotification: false,
    schedule: { at: date, allowWhileIdle: true },
    extra: { lessonId: lesson.id },
  };
}

export async function scheduleNativeLessonWindow({
  lessons,
  scheduleTimes,
  lessonCursor,
}: {
  lessons: NativeLesson[];
  scheduleTimes: string[];
  lessonCursor: number;
}): Promise<NativeScheduleResult> {
  if (!isNativeTamNguApp()) return { scheduled: 0, finalDate: null };
  if (!lessons.length) throw new Error("Kho bài học trên máy đang trống.");

  const permission = await LocalNotifications.checkPermissions();
  const granted = permission.display === "granted"
    ? permission
    : await LocalNotifications.requestPermissions();
  if (granted.display !== "granted") throw new Error("Cậu chưa cho phép thông báo cho Tam Ngữ 6H.");

  await ensureAndroidChannel();
  await clearOwnedNotifications();

  const dates = nextLessonDates(scheduleTimes, MAX_PENDING_LESSONS);
  const notifications = dates.map((date, index) => formatLessonNotification(
    lessons[(Math.max(0, lessonCursor) + index) % lessons.length],
    date,
    index,
  ));
  if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
  return { scheduled: notifications.length, finalDate: dates.at(-1) || null };
}

export async function disableNativeLessonNotifications() {
  if (!isNativeTamNguApp()) return;
  await clearOwnedNotifications();
  // Delivered cards belong to this app; removing them is the native equivalent
  // of turning the routine off rather than leaving a stale lesson on screen.
  await LocalNotifications.removeAllDeliveredNotifications();
}
