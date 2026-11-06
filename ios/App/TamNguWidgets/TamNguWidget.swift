import AppIntents
import Foundation
import SwiftUI
import WidgetKit

private let widgetKind = "com.nvtruong.tamngu6h.glance"
private let lessonURL = URL(string: "https://nvtruong473.github.io/tam-ngu-6h/widget-lessons.json")!

struct GlanceLesson: Codable, Hashable {
    let id: String
    let title: String
    let english: String
    let chinese: String
    let vietnamese: String
}

private struct LessonEnvelope: Codable {
    let schemaVersion: Int
    let lessons: [GlanceLesson]
}

private enum GlanceDeck {
    static let fallback = [
        GlanceLesson(
            id: "fallback-1",
            title: "Bắt đầu nhẹ nhàng",
            english: "Take it one step at a time.",
            chinese: "一步一步来。",
            vietnamese: "Cứ tiến từng bước một."
        ),
        GlanceLesson(
            id: "fallback-2",
            title: "Giữ nhịp",
            english: "Consistency matters more than speed.",
            chinese: "坚持比速度更重要。",
            vietnamese: "Bền bỉ quan trọng hơn tốc độ."
        ),
        GlanceLesson(
            id: "fallback-3",
            title: "Một chút mỗi ngày",
            english: "A little progress still counts.",
            chinese: "一点进步也值得。",
            vietnamese: "Tiến bộ một chút vẫn đáng quý."
        ),
    ]

    static var manualOffset: Int {
        UserDefaults.standard.integer(forKey: "tamNguGlanceOffset")
    }

    static func lessonIndex(at date: Date, count: Int) -> Int {
        guard count > 0 else { return 0 }
        let calendar = Calendar.autoupdatingCurrent
        let day = calendar.ordinality(of: .day, in: .era, for: date) ?? 0
        let hour = calendar.component(.hour, from: date)
        let slot = hour < 12 ? 0 : (hour < 18 ? 1 : 2)
        return abs(day * 3 + slot + manualOffset) % count
    }

    static func nextRefreshes(from now: Date) -> [Date] {
        let calendar = Calendar.autoupdatingCurrent
        let start = calendar.startOfDay(for: now)
        var dates = [now]
        for dayOffset in 0...2 {
            guard let day = calendar.date(byAdding: .day, value: dayOffset, to: start) else { continue }
            for hour in [6, 12, 18] {
                if let date = calendar.date(bySettingHour: hour, minute: 0, second: 0, of: day), date > now {
                    dates.append(date)
                }
            }
        }
        return Array(dates.prefix(7))
    }

    static func load() async -> [GlanceLesson] {
        do {
            var request = URLRequest(url: lessonURL)
            request.cachePolicy = .returnCacheDataElseLoad
            request.timeoutInterval = 12
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode) else { return fallback }
            let envelope = try JSONDecoder().decode(LessonEnvelope.self, from: data)
            guard envelope.schemaVersion == 1, envelope.lessons.count >= 30 else { return fallback }
            return envelope.lessons
        } catch {
            return fallback
        }
    }
}

struct GlanceEntry: TimelineEntry {
    let date: Date
    let lesson: GlanceLesson
}

struct GlanceProvider: TimelineProvider {
    func placeholder(in context: Context) -> GlanceEntry {
        GlanceEntry(date: .now, lesson: GlanceDeck.fallback[0])
    }

    func getSnapshot(in context: Context, completion: @escaping (GlanceEntry) -> Void) {
        completion(GlanceEntry(date: .now, lesson: GlanceDeck.fallback[0]))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GlanceEntry>) -> Void) {
        Task {
            let lessons = await GlanceDeck.load()
            let dates = GlanceDeck.nextRefreshes(from: .now)
            let entries = dates.map { date in
                GlanceEntry(date: date, lesson: lessons[GlanceDeck.lessonIndex(at: date, count: lessons.count)])
            }
            completion(Timeline(entries: entries, policy: .atEnd))
        }
    }
}

struct NextGlanceLessonIntent: AppIntent {
    static let title: LocalizedStringResource = "Bài tiếp theo"
    static let description = IntentDescription("Lật sang một thẻ Tam Ngữ khác mà không cần mở ứng dụng.")
    static let openAppWhenRun = false

    func perform() async throws -> some IntentResult {
        let defaults = UserDefaults.standard
        defaults.set(defaults.integer(forKey: "tamNguGlanceOffset") + 1, forKey: "tamNguGlanceOffset")
        WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
        return .result()
    }
}

private struct LanguageLine: View {
    let mark: String
    let text: String
    let emphasized: Bool

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(mark)
                .font(.caption2.weight(.bold))
                .foregroundStyle(.secondary)
                .frame(width: 18, alignment: .leading)
            Text(text)
                .font(emphasized ? .subheadline.weight(.semibold) : .caption)
                .lineLimit(emphasized ? 2 : 1)
                .minimumScaleFactor(0.78)
        }
        .accessibilityElement(children: .combine)
    }
}

struct TamNguGlanceView: View {
    @Environment(\.widgetFamily) private var family
    let entry: GlanceEntry

    var body: some View {
        if family == .accessoryRectangular {
            VStack(alignment: .leading, spacing: 1) {
                Text(entry.lesson.english)
                    .font(.caption.weight(.semibold))
                    .lineLimit(1)
                Text(entry.lesson.chinese)
                    .font(.caption2)
                    .lineLimit(1)
                Text(entry.lesson.vietnamese)
                    .font(.caption2)
                    .lineLimit(1)
            }
            .containerBackground(.clear, for: .widget)
        } else {
            VStack(alignment: .leading, spacing: family == .systemSmall ? 5 : 7) {
                HStack(spacing: 6) {
                    Text("TAM NGỮ · 6H")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(.secondary)
                    Spacer(minLength: 4)
                    if family != .systemSmall {
                        Button(intent: NextGlanceLessonIntent()) {
                            Image(systemName: "rectangle.stack.fill")
                                .accessibilityLabel("Lật sang bài khác")
                        }
                        .buttonStyle(.plain)
                    }
                }
                Text(entry.lesson.title)
                    .font(.headline)
                    .lineLimit(1)
                LanguageLine(mark: "EN", text: entry.lesson.english, emphasized: true)
                LanguageLine(mark: "中", text: entry.lesson.chinese, emphasized: false)
                LanguageLine(mark: "VI", text: entry.lesson.vietnamese, emphasized: false)
            }
            .contentTransition(.opacity)
            .containerBackground(for: .widget) {
                LinearGradient(
                    colors: [Color(red: 1.0, green: 0.96, blue: 0.95), Color(red: 0.96, green: 0.93, blue: 1.0)],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
            }
        }
    }
}

struct TamNguGlanceWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: widgetKind, provider: GlanceProvider()) { entry in
            TamNguGlanceView(entry: entry)
        }
        .configurationDisplayName("Tam Ngữ Glance Deck")
        .description("Một thẻ Anh · Trung · Việt yên lặng, đổi theo nhịp trong ngày.")
        .supportedFamilies([.accessoryRectangular, .systemSmall, .systemMedium, .systemLarge])
    }
}
