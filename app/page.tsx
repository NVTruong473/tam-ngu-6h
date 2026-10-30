"use client";

import { useEffect, useMemo, useState } from "react";
import curriculumData from "./curriculum.json";

type Tab = "today" | "library" | "settings";
type StudyLine = { speaker: string; english: string; chinese: string; pinyin: string; vietnamese: string };
type StudyModule = {
  id: string;
  stage: string;
  kind: "sentence" | "message" | "dialogue";
  title: string;
  context: string;
  lines: StudyLine[];
  note: string;
  challenge: string;
};

const curriculum = curriculumData as StudyModule[];
const STORAGE = {
  routine: "tamngu6h.routine",
  routineStart: "tamngu6h.routineStart",
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

function localIcsDate(value: Date) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}${pad(value.getMonth() + 1)}${pad(value.getDate())}T${pad(value.getHours())}${pad(value.getMinutes())}00`;
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function hashText(value: string) {
  return [...value].reduce((total, character) => ((total << 5) - total + character.charCodeAt(0)) | 0, 0);
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

function createDailyCalendar() {
  const now = new Date();
  const pageUrl = window.location.href;
  const slots = [
    { hour: 6, uid: "morning", title: "Có một lời chào buổi sáng mới ✦" },
    { hour: 12, uid: "noon", title: "Một lời nhắn buổi trưa đang chờ ✦" },
    { hour: 18, uid: "evening", title: "Bài học buổi tối đã mở ✦" },
    { hour: 22, uid: "night", title: "Có một điều nhỏ đang chờ cậu ✦" },
  ];
  const events = slots.flatMap((slot) => {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), slot.hour);
    if (start <= now) start.setDate(start.getDate() + 1);
    const end = new Date(start.getTime() + 10 * 60 * 1000);
    return [
      "BEGIN:VEVENT",
      `UID:tamngu6h-${slot.uid}@tamngu6h.local`,
      `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
      `DTSTART:${localIcsDate(start)}`,
      `DTEND:${localIcsDate(end)}`,
      "RRULE:FREQ=DAILY",
      `SUMMARY:${escapeIcs(slot.title)}`,
      `DESCRIPTION:${escapeIcs("Mở Tâm Ngữ 6H từ Màn hình chính để xem bài và lời chúc mới. Nội dung được giữ bí mật đến khi mở.")}`,
      `URL:${pageUrl}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(slot.title)}`,
      "TRIGGER:-PT0M",
      "END:VALARM",
      "END:VEVENT",
    ];
  });
  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Tam Ngu 6H//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([calendar], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "tam-ngu-6h-lich-hang-ngay.ics";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  const [calendarAdded, setCalendarAdded] = useState(false);

  const schedule = scheduleAt(now);
  const unlockedIndex = routineStartSequence === null ? 0 : Math.max(0, schedule.sequence - routineStartSequence);
  const moduleIndex = viewingScheduled ? unlockedIndex % curriculum.length : selectedModuleIndex;
  const studyModule = curriculum[moduleIndex] ?? curriculum[0];
  const remaining = schedule.nextAt - now;

  const filteredModules = useMemo(() => {
    const unlockedModules = curriculum.slice(0, routineEnabled ? Math.min(curriculum.length, unlockedIndex + 1) : 1);
    const keyword = query.trim().toLocaleLowerCase("vi");
    if (!keyword) return unlockedModules;
    return unlockedModules.filter((item) =>
      [item.title, item.context, item.stage, item.note, ...item.lines.flatMap((line) => [line.english, line.chinese, line.pinyin, line.vietnamese])]
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
      navigator.serviceWorker.register("./sw.js").catch(() => undefined);
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
    setCalendarAdded(false);
    if ("setAppBadge" in navigator) navigator.setAppBadge(1).catch(() => undefined);
  }

  function stopRoutine() {
    setRoutineEnabled(false);
    setCalendarAdded(false);
    if ("clearAppBadge" in navigator) navigator.clearAppBadge().catch(() => undefined);
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
          <p className="eyebrow">MỘT MÓN QUÀ NHỎ</p>
          <h1>Tâm Ngữ <span>6H</span></h1>
        </div>
        <button className="icon-button" onClick={() => setShowInstall(true)} aria-label="Hướng dẫn cài ứng dụng">↗</button>
      </header>

      {tab === "today" && (
        <section className="screen" aria-label="Bài học hôm nay">
          <article className={`session-card ${routineEnabled ? "active" : ""}`}>
            <div className="session-copy">
              <p className="eyebrow">{routineEnabled ? schedule.label : "MỘT BÀI · MỘT LỜI NHẮN"}</p>
              <h2>{routineEnabled ? schedule.wish : "Hẹn nhau mỗi 6 giờ"}</h2>
              <p>{routineEnabled ? `Điều bất ngờ tiếp theo sau ${formatRemaining(remaining)}.` : "Bài mới lúc 06:00, 12:00 và 18:00."}</p>
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
                  <button
                    className="primary-button"
                    onClick={() => {
                      createDailyCalendar();
                      setCalendarAdded(true);
                    }}
                  >
                    {calendarAdded ? "Đã tải lịch hằng ngày ✓" : "Thêm lịch nhắc hằng ngày"}
                  </button>
                  <button className="text-button danger" onClick={stopRoutine}>Tắt nhịp</button>
                </div>
                <p className="honest-note">Mở tệp vừa tải và chọn Thêm tất cả. Lịch chỉ báo có lời mới, không tiết lộ nội dung trước.</p>
              </>
            ) : (
              <button className="primary-button wide" onClick={startRoutine}>Bật nhịp hằng ngày</button>
            )}
          </article>

          <div className="section-heading">
            <div>
              <p className="eyebrow">{studyModule.stage} · BÀI {moduleIndex + 1}/{curriculum.length}</p>
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
                    <strong>{line.chinese}</strong><small>{line.pinyin}</small>
                  </button>
                  <p>{line.vietnamese}</p>
                </div>
              ))}
            </div>
            <div className="learning-note"><span>Ghi nhớ</span><p>{studyModule.note}</p></div>
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
          <div className="page-title"><p className="eyebrow">GIÁO TRÌNH A2 → B1</p><h2>Thư viện đã mở</h2><p>Câu ứng dụng, thông điệp và hội thoại được mở dần theo thời gian.</p></div>
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
            <div className="setting-row"><span className="setting-icon">◷</span><div><strong>06:00 · 12:00 · 18:00</strong><small>Mỗi mốc mở một bài và lời nhắn mới.</small></div><span className="status-pill">Tự động</span></div>
          </article>
          <article className="truth-card"><strong>Giới hạn cần biết</strong><p>Web app không thể tạo Live Activity cố định. Lịch nhắc có thể xuất hiện trên Màn hình khóa nhưng người dùng vẫn có quyền vuốt bỏ hoặc tắt thông báo.</p></article>
          <button className="secondary-button" onClick={() => { localStorage.clear(); setSelectedModuleIndex(0); setRoutineStartSequence(null); setRoutineEnabled(false); }}>Xóa dữ liệu trên máy</button>
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
            <h2 id="install-title">Đưa Tâm Ngữ lên iPhone</h2>
            <ol>
              <li><span>1</span><p>Mở đường link bằng <strong>Safari</strong>.</p></li>
              <li><span>2</span><p>Chạm nút <strong>Chia sẻ</strong> ở thanh công cụ.</p></li>
              <li><span>3</span><p>Chọn <strong>Thêm vào Màn hình chính</strong> và bật “Mở dưới dạng ứng dụng”.</p></li>
            </ol>
            <button className="primary-button wide" onClick={() => setShowInstall(false)}>Mình hiểu rồi</button>
          </section>
        </div>
      )}
    </main>
  );
}
