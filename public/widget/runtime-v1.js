/* TAM_NGU_RUNTIME_V1 · public widget runtime · never contains secrets */
module.exports = async function runTamNguWidget(TAM_NGU_CONFIG) {
  const DATA_URL = "https://nvtruong473.github.io/tam-ngu-6h/widget/lessons.json";
  const APP_URL = "https://nvtruong473.github.io/tam-ngu-6h/";
  const DEFAULT_SCHEDULE = ["06:00", "12:00", "18:00"];
  const CACHE_FILE = "tam-ngu-6h-widget-lessons.json";

  function normalizedSchedule() {
    const candidate = TAM_NGU_CONFIG && Array.isArray(TAM_NGU_CONFIG.schedule)
      ? [...new Set(TAM_NGU_CONFIG.schedule)]
      : [];
    const valid = candidate.length >= 1
      && candidate.length <= 24
      && candidate.every((time) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time));
    return valid ? candidate.sort() : DEFAULT_SCHEDULE;
  }

  const SCHEDULE = normalizedSchedule();
  const ROUTINE_START_SEQUENCE = TAM_NGU_CONFIG && Number.isInteger(TAM_NGU_CONFIG.routineStartSequence)
    ? TAM_NGU_CONFIG.routineStartSequence
    : null;

  function truncate(value, maximum) {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length <= maximum ? text : `${text.slice(0, Math.max(1, maximum - 1)).trim()}…`;
  }

  function currentSlot(now) {
    const minute = now.getHours() * 60 + now.getMinutes();
    const values = SCHEDULE.map((time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3)));
    let slot = -1;
    for (let index = 0; index < values.length; index += 1) {
      if (values[index] <= minute) slot = index;
    }
    const contentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (slot < 0) {
      slot = values.length - 1;
      contentDate.setDate(contentDate.getDate() - 1);
    }
    const day = Math.floor(Date.UTC(contentDate.getFullYear(), contentDate.getMonth(), contentDate.getDate()) / 86400000);
    const nextSlot = values.findIndex((value) => value > minute);
    const nextIndex = nextSlot < 0 ? 0 : nextSlot;
    const [hour, nextMinute] = SCHEDULE[nextIndex].split(":").map(Number);
    const refreshAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (nextSlot < 0 ? 1 : 0), hour, nextMinute);
    return { sequence: day * values.length + slot, time: SCHEDULE[slot], refreshAt };
  }

  async function loadLessons() {
    const files = FileManager.local();
    const cachePath = files.joinPath(files.documentsDirectory(), CACHE_FILE);
    try {
      const request = new Request(DATA_URL);
      request.timeoutInterval = 10;
      const data = await request.loadJSON();
      if (!Array.isArray(data.lessons) || data.lessons.length === 0) throw new Error("Empty lesson feed");
      files.writeString(cachePath, JSON.stringify(data));
      return data.lessons;
    } catch (error) {
      if (!files.fileExists(cachePath)) throw error;
      const cached = JSON.parse(files.readString(cachePath));
      if (!Array.isArray(cached.lessons) || cached.lessons.length === 0) throw error;
      return cached.lessons;
    }
  }

  function addText(stack, content, size, weight, color) {
    const text = stack.addText(content);
    text.font = weight === "bold" ? Font.boldSystemFont(size) : Font.systemFont(size);
    text.textColor = color;
    text.minimumScaleFactor = 0.72;
    return text;
  }

  function makeAccessoryWidget(lesson) {
    const widget = new ListWidget();
    widget.url = `${APP_URL}?lesson=${encodeURIComponent(lesson.id)}&source=widget`;
    widget.addAccessoryWidgetBackground = true;
    if (config.widgetFamily === "accessoryCircular") {
      const symbol = SFSymbol.named("character.book.closed.fill");
      const image = widget.addImage(symbol.image);
      image.tintColor = Color.white();
      image.imageSize = new Size(22, 22);
      return widget;
    }
    if (config.widgetFamily === "accessoryInline") {
      addText(widget, `语 · ${truncate(lesson.english, 24)}`, 11, "bold", Color.white());
      return widget;
    }
    addText(widget, "NÓI THỬ · TAM NGỮ 6H", 9, "bold", Color.white());
    widget.addSpacer(2);
    const cue = addText(widget, truncate(lesson.vietnamese, 58), 11, "bold", Color.white());
    cue.lineLimit = 2;
    return widget;
  }

  function makeHomeWidget(lesson, slot) {
    const widget = new ListWidget();
    widget.setPadding(15, 16, 14, 16);
    widget.url = `${APP_URL}?lesson=${encodeURIComponent(lesson.id)}&source=widget`;
    const gradient = new LinearGradient();
    gradient.colors = [new Color("FDE8EE"), new Color("FFF8F0")];
    gradient.locations = [0, 1];
    widget.backgroundGradient = gradient;
    const header = widget.addStack();
    addText(header, `TAM NGỮ 6H  ·  ${slot.time}`, 10, "bold", new Color("B33E61"));
    header.addSpacer();
    addText(header, `#${lesson.number}`, 10, "bold", new Color("8B737A"));
    widget.addSpacer(9);
    const english = addText(widget, truncate(lesson.english, 72), 16, "bold", new Color("2C2427"));
    english.lineLimit = 2;
    widget.addSpacer(5);
    const chinese = addText(widget, truncate(lesson.chinese, 48), 14, "bold", new Color("5D3E47"));
    chinese.lineLimit = 2;
    widget.addSpacer(4);
    const vietnamese = addText(widget, truncate(lesson.vietnamese, 88), 11, "normal", new Color("755F66"));
    vietnamese.lineLimit = 2;
    return widget;
  }

  let widget;
  try {
    const now = new Date();
    const slot = currentSlot(now);
    const lessons = await loadLessons();
    const lessonOffset = Number.isInteger(ROUTINE_START_SEQUENCE)
      ? Math.max(0, slot.sequence - ROUTINE_START_SEQUENCE)
      : Math.abs(slot.sequence);
    const lesson = lessons[lessonOffset % lessons.length];
    widget = config.runsInAccessoryWidget ? makeAccessoryWidget(lesson) : makeHomeWidget(lesson, slot);
    widget.refreshAfterDate = slot.refreshAt;
  } catch {
    widget = new ListWidget();
    widget.addText("语  Tam Ngữ 6H").font = Font.boldSystemFont(13);
    widget.addText("Chạm để thử tải lại bài học.").font = Font.systemFont(11);
    widget.url = APP_URL;
  }

  Script.setWidget(widget);
  if (config.runsInApp) await widget.presentMedium();
  Script.complete();
};
