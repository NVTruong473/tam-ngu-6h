"use client";

import { useEffect, useMemo, useState } from "react";
import curriculumData from "./curriculum.json";

type Tab = "today" | "library" | "settings";
type PushState = "idle" | "enabling" | "enabled" | "unsupported" | "error";
type LookupState = "idle" | "loading" | "success" | "error";
type StudyLine = { speaker: string; english: string; chinese: string; pinyin: string; vietnameseReading: string; vietnamese: string };
type LookupExample = { english: string; chinese: string; pinyin: string; vietnameseReading: string; vietnamese: string };
type LookupResult = {
  sourceLanguage: "English" | "Chinese" | "Mixed";
  term: string;
  pinyin: string;
  vietnameseReading: string;
  partOfSpeech: string;
  meaning: string;
  note: string;
  examples: LookupExample[];
};
type LookupCacheEntry = { key: string; result: LookupResult };
type StudyModule = {
  id: string;
  stage: string;
  kind: "sentence" | "message" | "dialogue";
  title: string;
  context: string;
  lines: StudyLine[];
  note: string;
  challenge: string;
  grammarFocus?: string;
  vocabulary?: string[];
  wish?: string;
  nightWish?: string;
};

const curriculum = curriculumData as StudyModule[];
const PUSH_API_URL = (process.env.NEXT_PUBLIC_PUSH_API_URL || "").replace(/\/$/, "");
const FEEDBACK_FORM_URL = (process.env.NEXT_PUBLIC_FEEDBACK_FORM_URL || "").trim();
const LOOKUP_CACHE_KEY = "tamngu6h.lookup-cache.v1";
const STORAGE = {
  routine: "tamngu6h.routine",
  routineStart: "tamngu6h.routineStart",
  invite: "tamngu6h.invite",
};

const WISHES = {
  morning: [
    "Chào buổi sáng. Mong hôm nay đối xử với cậu thật dịu dàng.",
    "Một ngày mới vừa mở cửa — nhớ mang theo nụ cười nhé.",
    "Chúc cậu thức dậy với lòng nhẹ tênh và một ngày thật xinh.",
    "Nắng đã lên rồi. Hy vọng điều tốt lành cũng đang tìm đến cậu.",
    "Buổi sáng bình yên nhé. Hôm nay cậu vẫn là điều đáng mong chờ.",
    "Chúc cậu đủ tỉnh táo để làm việc, đủ vui để thấy ngày đáng yêu.",
    "Một câu mới cho buổi sáng mới — từ từ thôi, cậu đang làm rất tốt.",
    "Chào ngày mới. Mong ly nước đầu tiên ngon và mọi việc đều thuận lòng.",
  ],
  noon: [
    "Trưa rồi, nghỉ một chút nhé. Cậu không cần vội mọi lúc đâu.",
    "Chúc cậu một bữa trưa ngon và một khoảng thở thật dễ chịu.",
    "Nửa ngày đã qua — cảm ơn cậu vì vẫn cố gắng đến lúc này.",
    "Đừng quên ăn trưa nhé. Công việc quan trọng, cậu cũng quan trọng.",
    "Một câu mới đang đợi, còn mình mong cậu có một buổi trưa thật yên.",
    "Chúc buổi trưa của cậu ít vội vàng và nhiều món ngon.",
    "Tạm đặt mọi việc xuống vài phút nhé — đây là lời nhắc phải thương mình.",
    "Nạp năng lượng thôi. Chiều nay biết đâu lại có chuyện vui bất ngờ.",
  ],
  evening: [
    "Tan làm rồi thì để những mệt mỏi ở lại phía sau nhé.",
    "Chúc cậu một buổi tối ấm áp, có đồ ngon và chuyện vui.",
    "Hôm nay vất vả rồi. Bây giờ là lúc dành sự dịu dàng cho chính mình.",
    "Buổi tối đến rồi — mong cậu được ở nơi khiến mình thấy bình yên.",
    "Câu cuối hôm nay đã tới. Còn cậu, nhớ nghỉ ngơi thật tử tế nhé.",
    "Chúc buổi tối của cậu không deadline, không muộn phiền, chỉ có thư thả.",
    "Dù hôm nay thế nào, cậu đã đi hết một ngày rồi. Giỏi lắm.",
    "Có một chút bình yên gửi cậu vào cuối ngày. Nhận lấy nhé.",
  ],
  night: [
    "Ngủ ngon nhé. Những điều chưa xong có thể để ngày mai lo tiếp.",
    "Chúc cậu một giấc ngủ sâu và một giấc mơ thật hiền.",
    "Đêm nay đừng nghĩ nhiều nữa. Cậu xứng đáng được nghỉ ngơi.",
    "Khép ngày lại thôi. Mong chiếc gối giữ hộ cậu mọi muộn phiền.",
    "Chúc ngủ ngon. Mai thức dậy sẽ lại có một lời nhắn mới.",
    "Cảm ơn cậu đã đi hết ngày hôm nay. Ngủ thật ngon nhé.",
    "Tắt màn hình, thả lỏng vai và để ngày mai đến sau một giấc thật sâu.",
    "Đêm bình yên nhé. Có người vẫn âm thầm mong cậu ngủ ngon.",
  ],
};

function formatRemaining(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function hashText(value: string) {
  return [...value].reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0);
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((character) => character.charCodeAt(0)));
}

function inviteCodeFromInput(value: string) {
  const candidate = value.trim();
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    return (hashParams.get("invite") || url.searchParams.get("invite") || "").trim();
  } catch {
    const embeddedInvite = candidate.match(/(?:^|[#?&])invite=([^&#]+)/i)?.[1];
    if (embeddedInvite) {
      try {
        return decodeURIComponent(embeddedInvite).trim();
      } catch {
        return embeddedInvite.trim();
      }
    }
    return candidate.replace(/[\s-]+/g, "");
  }
}

function containsChinese(value: string) {
  return /\p{Script=Han}/u.test(value);
}

const PINYIN_TONE_MARKS = new Set([..."āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙǕǗǙǛ"]);

function isPlainLookupText(value: unknown, minimum = 1): value is string {
  return typeof value === "string"
    && value.trim().length >= minimum
    && !/[<>`\u0000-\u001F\u007F]/u.test(value);
}

function hasLatinLookupText(value: unknown) {
  return isPlainLookupText(value) && /\p{Script=Latin}/u.test(value) && !containsChinese(value);
}

function hasChineseLookupText(value: unknown) {
  return isPlainLookupText(value) && containsChinese(value) && !/[A-Za-z]/.test(value);
}

function hasMatchingToneGuides(pinyin: string, vietnameseReading: string) {
  const pinyinTones = [...pinyin].filter((character) => PINYIN_TONE_MARKS.has(character)).length;
  const readingTones = (vietnameseReading.match(/\([1-4]\)/g) || []).length;
  return pinyinTones === readingTones;
}

function isVietnameseFriendlyReading(value: unknown) {
  return isPlainLookupText(value, 3)
    && !containsChinese(value)
    && /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu.test(value)
    && !/[fjwz]/iu.test(value)
    && !/(?:^|\s)(?:sh|zh)[a-z]+/iu.test(value)
    && !/\((?![1-4]\))[^)]*\)|\([^)]*$/u.test(value);
}

function validLookupExample(value: unknown): value is LookupExample {
  if (!value || typeof value !== "object") return false;
  const example = value as Partial<LookupExample>;
  return hasLatinLookupText(example.english)
    && hasChineseLookupText(example.chinese)
    && hasLatinLookupText(example.pinyin)
    && isVietnameseFriendlyReading(example.vietnameseReading)
    && typeof example.pinyin === "string"
    && typeof example.vietnameseReading === "string"
    && hasMatchingToneGuides(example.pinyin, example.vietnameseReading)
    && hasLatinLookupText(example.vietnamese);
}

function validLookupResult(value: unknown): value is LookupResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<LookupResult>;
  if (!(["English", "Chinese", "Mixed"] as const).includes(result.sourceLanguage as LookupResult["sourceLanguage"])) return false;
  if (!isPlainLookupText(result.partOfSpeech)
    || !hasLatinLookupText(result.meaning)
    || !hasLatinLookupText(result.note)
    || !Array.isArray(result.examples)
    || result.examples.length !== 2
    || !result.examples.every(validLookupExample)) return false;

  const term = result.term || "";
  const pinyin = result.pinyin || "";
  const vietnameseReading = result.vietnameseReading || "";
  if (result.sourceLanguage === "Chinese" && !hasChineseLookupText(term)) return false;
  if (result.sourceLanguage === "English" && !hasLatinLookupText(term)) return false;
  if (result.sourceLanguage === "Mixed" && !isPlainLookupText(term)) return false;
  if (!containsChinese(term)) return pinyin === "" && vietnameseReading === "";
  return hasLatinLookupText(pinyin)
    && isVietnameseFriendlyReading(vietnameseReading)
    && hasMatchingToneGuides(pinyin, vietnameseReading);
}

function scheduleAt(timestamp: number) {
  const current = new Date(timestamp || Date.now());
  const hour = current.getHours();
  const contentDate = new Date(current.getFullYear(), current.getMonth(), current.getDate());
  let phase: keyof typeof WISHES;
  let lessonSlot: number;
  let nextAt: Date;

  if (hour < 6) {
    phase = "night";
    lessonSlot = 2;
    contentDate.setDate(contentDate.getDate() - 1);
    nextAt = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 6);
  } else if (hour < 12) {
    phase = "morning";
    lessonSlot = 0;
    nextAt = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 12);
  } else if (hour < 18) {
    phase = "noon";
    lessonSlot = 1;
    nextAt = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 18);
  } else if (hour < 22) {
    phase = "evening";
    lessonSlot = 2;
    nextAt = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 22);
  } else {
    phase = "night";
    lessonSlot = 2;
    nextAt = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1, 6);
  }

  const dayNumber = Math.floor(Date.UTC(contentDate.getFullYear(), contentDate.getMonth(), contentDate.getDate()) / 86400000);
  const sequence = dayNumber * 3 + lessonSlot;
  const dateKey = `${contentDate.getFullYear()}-${contentDate.getMonth() + 1}-${contentDate.getDate()}-${phase}`;
  const choices = WISHES[phase];
  const wish = choices[Math.abs(hashText(dateKey)) % choices.length];
  const labels = { morning: "BUỔI SÁNG", noon: "BUỔI TRƯA", evening: "BUỔI TỐI", night: "CHÚC NGỦ NGON" };
  return { sequence, phase, wish, label: labels[phase], nextAt: nextAt.getTime() };
}

function speak(text: string, language: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language;
  utterance.rate = language === "zh-CN" ? 0.72 : 0.86;
  const languageRoot = language.toLowerCase().split("-")[0];
  const voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith(languageRoot));
  const preferredNames = languageRoot === "zh"
    ? ["premium", "enhanced", "tingting", "sin-ji", "meijia"]
    : ["premium", "enhanced", "samantha", "ava", "allison"];
  utterance.voice = voices.sort((first, second) => {
    const score = (name: string) => preferredNames.findIndex((candidate) => name.toLowerCase().includes(candidate));
    const firstScore = score(first.name);
    const secondScore = score(second.name);
    return (firstScore < 0 ? 99 : firstScore) - (secondScore < 0 ? 99 : secondScore);
  })[0] ?? null;
  window.speechSynthesis.speak(utterance);
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [routineEnabled, setRoutineEnabled] = useState(false);
  const [routineStartSequence, setRoutineStartSequence] = useState<number | null>(null);
  const [selectedModuleIndex, setSelectedModuleIndex] = useState(0);
  const [viewingScheduled, setViewingScheduled] = useState(true);
  const [now, setNow] = useState(0);
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [pushState, setPushState] = useState<PushState>("idle");
  const [pushMessage, setPushMessage] = useState("");
  const [inviteReady, setInviteReady] = useState(false);
  const [inviteDraft, setInviteDraft] = useState("");
  const [savingInvite, setSavingInvite] = useState(false);
  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupCache, setLookupCache] = useState<LookupCacheEntry[]>([]);

  const schedule = scheduleAt(now);
  const unlockedIndex = routineStartSequence === null ? 0 : Math.max(0, schedule.sequence - routineStartSequence);
  const moduleIndex = viewingScheduled ? Math.min(unlockedIndex, curriculum.length - 1) : selectedModuleIndex;
  const studyModule = curriculum[moduleIndex] ?? curriculum[0];
  const currentWish = schedule.phase === "night"
    ? studyModule.nightWish ?? schedule.wish
    : studyModule.wish ?? schedule.wish;
  const remaining = schedule.nextAt - now;

  const filteredModules = useMemo(() => {
    const unlockedModules = curriculum.slice(0, routineEnabled ? Math.min(curriculum.length, unlockedIndex + 1) : 1);
    const keyword = query.trim().toLocaleLowerCase("vi");
    if (!keyword) return unlockedModules;
    return unlockedModules.filter((item) =>
        [item.title, item.context, item.stage, item.note, ...item.lines.flatMap((line) => [line.english, line.chinese, line.pinyin, line.vietnameseReading, line.vietnamese])]
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(keyword),
    );
  }, [query, routineEnabled, unlockedIndex]);

  useEffect(() => {
    const storedRoutine = localStorage.getItem(STORAGE.routine) === "true";
    const storedStart = Number(localStorage.getItem(STORAGE.routineStart));
    queueMicrotask(() => {
      const currentTime = Date.now();
      setRoutineEnabled(storedRoutine);
      if (Number.isFinite(storedStart) && storedStart > 0) setRoutineStartSequence(storedStart);
      else if (storedRoutine) setRoutineStartSequence(scheduleAt(currentTime).sequence);
      setNow(currentTime);
      setReady(true);
    });
    if ("serviceWorker" in navigator) {
      const isLocalPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
      if (isLocalPreview) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister());
        }).catch(() => undefined);
      } else {
        const hadController = Boolean(navigator.serviceWorker.controller);
        let refreshedForUpdate = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (hadController && !refreshedForUpdate) {
            refreshedForUpdate = true;
            window.location.reload();
          }
        });
        navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" })
          .then((registration) => registration.update())
          .catch(() => undefined);
      }
    }

    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const invite = hashParams.get("invite")?.trim();
    if (invite) {
      localStorage.setItem(STORAGE.invite, invite);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    const hasInvite = Boolean(invite || localStorage.getItem(STORAGE.invite));
    queueMicrotask(() => {
      setInviteReady(hasInvite);
      if (invite) setPushMessage("Đã mở Tra nhanh AI trên thiết bị này.");
      try {
        const cached = JSON.parse(localStorage.getItem(LOOKUP_CACHE_KEY) || "[]");
        if (Array.isArray(cached)) setLookupCache(cached.filter((entry): entry is LookupCacheEntry => Boolean(entry?.key && validLookupResult(entry?.result))).slice(0, 30));
      } catch {
        localStorage.removeItem(LOOKUP_CACHE_KEY);
      }
    });

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      queueMicrotask(() => setPushState("unsupported"));
    } else if (PUSH_API_URL) {
      navigator.serviceWorker.ready
        .then((registration) => registration.pushManager.getSubscription())
        .then((subscription) => setPushState(subscription ? "enabled" : "idle"))
        .catch(() => setPushState("idle"));
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE.routine, String(routineEnabled));
    if (routineStartSequence !== null) localStorage.setItem(STORAGE.routineStart, String(routineStartSequence));
  }, [ready, routineEnabled, routineStartSequence]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  function startRoutine() {
    setRoutineEnabled(true);
    setRoutineStartSequence((current) => current ?? scheduleAt(Date.now()).sequence);
    setViewingScheduled(true);
  }

  function stopRoutine() {
    setRoutineEnabled(false);
    void disableLockScreen();
  }

  async function enableLockScreen() {
    if (!PUSH_API_URL) {
      setPushState("error");
      setPushMessage("Tính năng thông báo chưa sẵn sàng. Hãy thử lại sau nhé.");
      return;
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) {
      setShowInstall(true);
      setPushMessage("Hãy cài app lên Màn hình chính trước khi bật thẻ Màn hình khóa.");
      return;
    }
    setPushState("enabling");
    setPushMessage("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Cậu chưa cho phép thông báo trong iPhone.");
      const registration = await navigator.serviceWorker.ready;
      const keyResponse = await fetch(`${PUSH_API_URL}/vapid-key`);
      if (!keyResponse.ok) throw new Error("Chưa thể bật thông báo lúc này.");
      const { publicKey } = await keyResponse.json() as { publicKey?: string };
      if (!publicKey) throw new Error("Chưa thể bật thông báo lúc này.");
      const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const startSequence = routineStartSequence ?? scheduleAt(Date.now()).sequence;
      const response = await fetch(`${PUSH_API_URL}/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh",
          routineStartSequence: startSequence,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error || "Không đăng ký được thông báo.");
      }
      try {
        const appRoot = new URL("./", window.location.href).href;
        await registration.showNotification("Tam Ngữ 6H đã sẵn sàng", {
          body: "Đã bật bài lúc 06:00 · 12:00 · 18:00. Khóa màn hình để xem thẻ xác nhận này nhé.",
          icon: new URL("./icons/icon-192.png", window.location.href).href,
          badge: new URL("./icons/icon-192.png", window.location.href).href,
          tag: "tam-ngu-current-lesson",
          renotify: false,
          data: { url: appRoot },
        });
      } catch {
        // Subscription remains valid even if iOS delays the local confirmation.
      }
      setRoutineEnabled(true);
      setRoutineStartSequence(startSequence);
      setPushState("enabled");
      setPushMessage("Đã bật thành công. Một thẻ xác nhận vừa được gửi; các bài tiếp theo đến lúc 06:00, 12:00 và 18:00.");
    } catch (error) {
      setPushState("error");
      setPushMessage(error instanceof Error ? error.message : "Không bật được thông báo.");
    }
  }

  async function saveInviteCode() {
    const code = inviteCodeFromInput(inviteDraft);
    if (code.length < 8) {
      setPushState("error");
      setPushMessage("Mã mở Tra nhanh phải có đủ 8 số.");
      return;
    }
    setSavingInvite(true);
    try {
      if (PUSH_API_URL) {
        const response = await fetch(`${PUSH_API_URL}/verify-invite`, {
          method: "POST",
          headers: { "x-invite-code": code },
        });
        if (!response.ok) throw new Error("Mã mở Tra nhanh chưa đúng.");
      }
      localStorage.setItem(STORAGE.invite, code);
      setInviteDraft("");
      setInviteReady(true);
      if ("serviceWorker" in navigator && PUSH_API_URL) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setPushState(subscription ? "enabled" : "idle");
      }
      setPushMessage("Đã mở Tra nhanh AI trên iPhone này.");
    } catch (error) {
      setPushState("error");
      setPushMessage(error instanceof Error ? error.message : "Chưa kiểm tra được mã mở Tra nhanh.");
    } finally {
      setSavingInvite(false);
    }
  }

  async function disableLockScreen() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription && PUSH_API_URL) {
        await fetch(`${PUSH_API_URL}/subscribe`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }
      if (subscription) await subscription.unsubscribe();
      setPushState("idle");
      setPushMessage("Đã tắt thẻ bài học trên Màn hình khóa ở thiết bị này.");
    } catch {
      setPushState("error");
      setPushMessage("Chưa tắt được thông báo. Hãy thử lại khi có mạng.");
    }
  }

  async function runLookup() {
    const query = lookupQuery.replace(/\s+/g, " ").trim();
    if (!query) {
      setLookupState("error");
      setLookupMessage("Hãy nhập một từ hoặc một cụm ngắn trước nhé.");
      return;
    }
    const cacheKey = query.toLocaleLowerCase("vi");
    const cached = lookupCache.find((entry) => entry.key === cacheKey);
    if (cached) {
      setLookupResult(cached.result);
      setLookupMessage("Kết quả này đã được lưu trên máy để tiết kiệm lượt tra.");
      setLookupState("success");
      return;
    }
    const inviteCode = localStorage.getItem(STORAGE.invite) || "";
    if (!PUSH_API_URL || !inviteCode) {
      setLookupResult(null);
      setLookupState("error");
      setLookupMessage("Tra nhanh chưa được mở. Vào Cài đặt và nhập mã 8 số một lần nhé.");
      return;
    }

    setLookupState("loading");
    setLookupMessage("Đang tra nghĩa và ví dụ…");
    setLookupResult(null);
    try {
      const response = await fetch(`${PUSH_API_URL}/lookup`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-invite-code": inviteCode },
        body: JSON.stringify({ query }),
      });
      const body = await response.json().catch(() => ({})) as { error?: string; result?: unknown };
      if (response.status === 401) {
        localStorage.removeItem(STORAGE.invite);
        setInviteReady(false);
        throw new Error("Mã đã đổi hoặc hết hạn. Vào Cài đặt và nhập mã 8 số mới nhé.");
      }
      if (!response.ok || !validLookupResult(body.result)) throw new Error(body.error || "Chưa tra được lúc này.");
      const nextCache = [{ key: cacheKey, result: body.result }, ...lookupCache.filter((entry) => entry.key !== cacheKey)].slice(0, 30);
      setLookupCache(nextCache);
      localStorage.setItem(LOOKUP_CACHE_KEY, JSON.stringify(nextCache));
      setLookupResult(body.result);
      setLookupMessage("Đã lưu kết quả tra cứu trên máy này.");
      setLookupState("success");
    } catch (error) {
      setLookupState("error");
      setLookupMessage(error instanceof Error ? error.message : "Chưa tra được lúc này.");
    }
  }

  function resetLearningProgress() {
    if (pushState === "enabled") {
      setPushMessage("Hãy tắt Màn hình khóa trước nếu muốn dừng hẳn, rồi mới đặt lại tiến độ.");
      return;
    }
    localStorage.removeItem(STORAGE.routine);
    localStorage.removeItem(STORAGE.routineStart);
    setSelectedModuleIndex(0);
    setRoutineStartSequence(null);
    setRoutineEnabled(false);
    setViewingScheduled(true);
    setPushMessage("Đã đặt lại tiến độ học trên máy này.");
  }

  function selectModule(item: StudyModule) {
    setSelectedModuleIndex(curriculum.findIndex((candidate) => candidate.id === item.id));
    setViewingScheduled(false);
    setTab("today");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className={`app-shell ${ready ? "is-ready" : ""}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">语</div>
        <div>
          <p className="eyebrow">ANH · TRUNG · VIỆT</p>
          <h1>Tam Ngữ <span>6H</span></h1>
        </div>
        <button className="icon-button" onClick={() => setShowInstall(true)} aria-label="Hướng dẫn cài ứng dụng">↗</button>
      </header>

      {tab === "today" && (
        <section className="screen" aria-label="Bài học hôm nay">
          <article className={`session-card ${routineEnabled ? "active" : ""}`}>
            <div className="session-copy">
              <p className="eyebrow">{routineEnabled ? schedule.label : "MỘT BÀI · MỘT LỜI NHẮN"}</p>
              <h2>{routineEnabled ? currentWish : "Hẹn nhau mỗi 6 giờ"}</h2>
              <p>{routineEnabled ? `Điều bất ngờ tiếp theo sau ${formatRemaining(remaining)}.` : "Một thẻ bài học mới sẽ đến lúc 06:00, 12:00 và 18:00."}</p>
            </div>
            <div className="session-orbit" aria-hidden="true"><span>♥</span></div>
            {routineEnabled ? (
              <>
                <div className="daily-times" aria-label="Các mốc bài học hằng ngày">
                  <span className={schedule.phase === "morning" ? "current" : ""}>06:00</span>
                  <span className={schedule.phase === "noon" ? "current" : ""}>12:00</span>
                  <span className={schedule.phase === "evening" || schedule.phase === "night" ? "current" : ""}>18:00</span>
                </div>
                <div className="session-actions">
                  <button className="primary-button" disabled={pushState === "enabling" || pushState === "enabled"} onClick={enableLockScreen}>
                    {pushState === "enabled" ? "Màn hình khóa đã bật ✓" : pushState === "enabling" ? "Đang bật…" : "Hiện bài trên Màn hình khóa"}
                  </button>
                  <button className="text-button danger" onClick={stopRoutine}>Tắt nhịp</button>
                </div>
                <p className={`honest-note ${pushState === "error" ? "error-note" : ""}`}>{pushMessage || "Bài mới sẽ hiện cả khi app đã đóng. iPhone quyết định âm lượng; vuốt thẻ để xóa khi đã đọc."}</p>
              </>
            ) : (
              <button className="primary-button wide" onClick={startRoutine}>Bật nhịp hằng ngày</button>
            )}
          </article>

          <section className="lookup-card" aria-labelledby="lookup-title">
            <div className="lookup-heading">
              <div>
                <p className="eyebrow">TRA NHANH · ANH / TRUNG</p>
                <h2 id="lookup-title">Gặp từ lạ thì hỏi ngay</h2>
              </div>
              <span aria-hidden="true">⌕</span>
            </div>
            <form className="lookup-form" onSubmit={(event) => { event.preventDefault(); void runLookup(); }}>
              <input
                value={lookupQuery}
                onChange={(event) => setLookupQuery(event.target.value)}
                placeholder="Một từ hoặc cụm Anh / Trung…"
                aria-label="Từ hoặc cụm cần tra"
                maxLength={100}
              />
              <button disabled={lookupState === "loading"} type="submit">{lookupState === "loading" ? "Đang tra…" : "Tra"}</button>
            </form>
            {lookupMessage && <p className={`lookup-message ${lookupState === "error" ? "error-note" : ""}`}>{lookupMessage}</p>}
            {lookupResult && (
              <article className="lookup-result" aria-live="polite">
                <div className="lookup-term-row">
                  <div>
                    <strong>{lookupResult.term}</strong>
                    <small>{lookupResult.sourceLanguage} · {lookupResult.partOfSpeech}</small>
                  </div>
                  <button
                    type="button"
                    className="lookup-speak"
                    aria-label="Nghe cách đọc"
                    onClick={() => speak(lookupResult.term, containsChinese(lookupResult.term) ? "zh-CN" : "en-US")}
                  >
                    ◖))
                  </button>
                </div>
                {lookupResult.pinyin && <p className="lookup-pinyin">{lookupResult.pinyin}</p>}
                {lookupResult.vietnameseReading && <p className="lookup-reading"><span>Đọc gần Việt</span>{lookupResult.vietnameseReading}</p>}
                <p className="lookup-meaning">{lookupResult.meaning}</p>
                {lookupResult.note && <p className="lookup-note">{lookupResult.note}</p>}
                <div className="lookup-examples">
                  {lookupResult.examples.map((example, index) => (
                    <div key={`${lookupResult.term}-${index}`} className="lookup-example">
                      <button type="button" onClick={() => speak(example.english, "en-US")}><strong>{example.english}</strong><small>EN · chạm để nghe</small></button>
                      <button type="button" onClick={() => speak(example.chinese, "zh-CN")}><strong>{example.chinese}</strong><small>{example.pinyin}</small>{example.vietnameseReading && <small className="vietnamese-reading"><span>Đọc gần Việt</span>{example.vietnameseReading}</small>}</button>
                      <p>{example.vietnamese}</p>
                    </div>
                  ))}
                </div>
              </article>
            )}
          </section>

          <div className="section-heading">
            <div>
              <p className="eyebrow">{studyModule.stage} · BÀI {moduleIndex + 1}</p>
              <h2>{studyModule.title}</h2>
            </div>
          </div>

          <article className="study-card">
            <div className={`module-kind ${studyModule.kind}`}>
              {studyModule.kind === "dialogue" ? "HỘI THOẠI NGẮN" : studyModule.kind === "message" ? "THÔNG ĐIỆP" : "CÂU ỨNG DỤNG"}
            </div>
            <p className="module-context">{studyModule.context}</p>
            <div className="dialogue-list">
              {studyModule.lines.map((line, index) => (
                <div className="dialogue-line" key={`${studyModule.id}-${index}`}>
                  <span className="speaker">{line.speaker}</span>
                  <button onClick={() => speak(line.english, "en-US")} className="study-language english-line">
                    <strong>{line.english}</strong><small>EN · chạm để nghe</small>
                  </button>
                  <button onClick={() => speak(line.chinese, "zh-CN")} className="study-language chinese-line">
                    <strong>{line.chinese}</strong>
                    <small>{line.pinyin}</small>
                    <small className="vietnamese-reading"><span>Đọc gần Việt</span>{line.vietnameseReading}</small>
                  </button>
                  <p>{line.vietnamese}</p>
                </div>
              ))}
            </div>
            <p className="pronunciation-note">“Đọc gần Việt” là cầu nối để bắt đầu; số 1–4 là thanh tiếng Trung. Chạm câu Trung để nghe giọng chuẩn.</p>
            <div className="learning-note"><span>Ghi nhớ</span><p>{studyModule.note}</p></div>
            {studyModule.grammarFocus && <div className="grammar-focus"><span>Trọng tâm hôm nay</span><p>{studyModule.grammarFocus}</p></div>}
            {studyModule.vocabulary && studyModule.vocabulary.length > 0 && (
              <div className="vocabulary-card"><span>Cụm nên nhớ</span><ul>{studyModule.vocabulary.map((item) => <li key={item}>{item}</li>)}</ul></div>
            )}
            <div className="mini-challenge"><span>Thử thách 1 phút</span><p>{studyModule.challenge}</p></div>
            {!viewingScheduled && (
              <div className="lesson-nav">
                <button disabled={selectedModuleIndex === 0} onClick={() => setSelectedModuleIndex((current) => Math.max(0, current - 1))}>← Bài trước</button>
                <button disabled={selectedModuleIndex >= Math.min(curriculum.length - 1, unlockedIndex)} onClick={() => setSelectedModuleIndex((current) => Math.min(Math.min(curriculum.length - 1, unlockedIndex), current + 1))}>Bài sau →</button>
              </div>
            )}
          </article>
        </section>
      )}

      {tab === "library" && (
        <section className="screen library-screen">
          <div className="page-title"><p className="eyebrow">ÔN LẠI THEO NHỊP CỦA BẠN</p><h2>Thư viện bài học</h2><p>Tìm lại các bài đã mở hoặc chọn một chủ đề để ôn bất kỳ lúc nào.</p></div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tiếng Anh, Trung hoặc Việt…" />
          </label>
          <div className="lesson-list">
            {filteredModules.map((item) => (
              <button className="lesson-row" onClick={() => selectModule(item)} key={item.id}>
                <span className="row-number">{String(curriculum.findIndex((candidate) => candidate.id === item.id) + 1).padStart(2, "0")}</span>
                <span className="row-copy"><strong>{item.title}</strong><small>{item.stage} · {item.kind === "dialogue" ? "Hội thoại" : item.kind === "message" ? "Thông điệp" : "Câu ứng dụng"}</small></span>
                <span className="row-heart liked">✓</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "settings" && (
        <section className="screen settings-screen">
          <div className="page-title"><p className="eyebrow">NHẸ NHÀNG & RIÊNG TƯ</p><h2>Cài đặt</h2><p>Mọi tiến độ nằm trên chính chiếc iPhone này.</p></div>
          <article className="settings-card">
            <div className="setting-row"><span className="setting-icon">⌂</span><div><strong>Cài lên Màn hình chính</strong><small>Mở toàn màn hình với icon như một app.</small></div><button onClick={() => setShowInstall(true)}>Xem</button></div>
            <div className="setting-row"><span className="setting-icon">✓</span><div><strong>Tự động lưu</strong><small>Tiến độ và nhịp hằng ngày được lưu trên máy.</small></div><span className="status-pill">Đang bật</span></div>
            <div className="setting-row"><span className="setting-icon">◷</span><div><strong>06:00 · 12:00 · 18:00</strong><small>Mỗi mốc có một bài mới và một lời nhắn riêng.</small></div><span className="status-pill">Mỗi ngày</span></div>
            <div className="setting-row"><span className="setting-icon">▣</span><div><strong>Thẻ bài học Màn hình khóa</strong><small>Hiện cả khi app đã đóng. Thẻ mới thay thẻ cũ; vuốt để xóa sau khi đọc.</small></div>{pushState === "unsupported" ? <span className="status-pill">Safari iPhone</span> : pushState === "enabled" ? <button onClick={disableLockScreen}>Tắt</button> : <button onClick={enableLockScreen}>Bật</button>}</div>
          </article>
          {PUSH_API_URL && !inviteReady && (
            <div className="pairing-box">
              <label htmlFor="pairing-code"><strong>Mở Tra nhanh AI (tùy chọn)</strong><small>Nhập mã 8 số một lần. Không cần mã này để nhận bài trên Màn hình khóa.</small></label>
              <div><input id="pairing-code" value={inviteDraft} onChange={(event) => setInviteDraft(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="Mã 8 số" inputMode="numeric" pattern="[0-9]*" maxLength={8} autoComplete="one-time-code" /><button disabled={savingInvite} onClick={saveInviteCode}>{savingInvite ? "Đang kiểm tra…" : "Mở Tra nhanh"}</button></div>
            </div>
          )}
          {pushMessage && <p className={`settings-message ${pushState === "error" ? "error-note" : ""}`}>{pushMessage}</p>}
          <article className="truth-card"><strong>Thông báo bài học</strong><p>Vuốt thẻ để xóa sau khi đọc. Âm lượng và cách hiển thị do iPhone quyết định.</p></article>
          {FEEDBACK_FORM_URL && (
            <a className="feedback-card" href={FEEDBACK_FORM_URL} target="_blank" rel="noreferrer" aria-label="Mở form nhắn cho dev">
              <span className="setting-icon" aria-hidden="true">✉</span>
              <span className="feedback-copy"><strong>Nhắn cho dev</strong><small>Góp ý, điều muốn có thêm, hay một lời trêu vui về trà sữa đều được chào đón.</small></span>
              <span className="feedback-arrow" aria-hidden="true">↗</span>
            </a>
          )}
          <button className="secondary-button" onClick={resetLearningProgress}>Đặt lại tiến độ học</button>
        </section>
      )}

      <nav className="tabbar" aria-label="Điều hướng chính">
        <button className={tab === "today" ? "active" : ""} onClick={() => { setTab("today"); setViewingScheduled(true); }}><span>✦</span>Hôm nay</button>
        <button className={tab === "library" ? "active" : ""} onClick={() => setTab("library")}><span>▤</span>Thư viện</button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}><span>⚙</span>Cài đặt</button>
      </nav>

      {showInstall && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowInstall(false)}>
          <section className="install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="install-icon">语</div>
            <p className="eyebrow">CHỈ MẤT KHOẢNG 20 GIÂY</p>
            <h2 id="install-title">Đưa Tam Ngữ lên iPhone</h2>
            <ol>
              <li><span>1</span><p>Mở đường link bằng <strong>Safari</strong>.</p></li>
              <li><span>2</span><p>Chạm nút <strong>Chia sẻ</strong> ở thanh công cụ.</p></li>
              <li><span>3</span><p>Chọn <strong>Thêm vào Màn hình chính</strong>. Nếu iPhone hiện “Mở dưới dạng ứng dụng”, hãy để tùy chọn đó bật.</p></li>
              <li><span>4</span><p>Mở icon vừa tạo, vào <strong>Cài đặt</strong> trong app rồi bật thẻ bài học Màn hình khóa.</p></li>
            </ol>
            <button className="primary-button wide" onClick={() => setShowInstall(false)}>Mình hiểu rồi</button>
          </section>
        </div>
      )}
    </main>
  );
}
