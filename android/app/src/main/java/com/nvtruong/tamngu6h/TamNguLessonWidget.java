package com.nvtruong.tamngu6h;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.TimeUnit;

public class TamNguLessonWidget extends AppWidgetProvider {
    public static final String ACTION_PINNED = "com.nvtruong.tamngu6h.WIDGET_PINNED";
    private static final String PREFS = "tam_ngu_widget";
    private static final String SCHEDULE = "schedule_json";
    private static final String DEFAULT_SCHEDULE = "[\"06:00\",\"12:00\",\"18:00\"]";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] widgetIds) {
        for (int widgetId : widgetIds) updateWidget(context, manager, widgetId);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (ACTION_PINNED.equals(action)
            || Intent.ACTION_TIME_CHANGED.equals(action)
            || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
            || Intent.ACTION_DATE_CHANGED.equals(action)) {
            updateAll(context);
        }
    }

    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        ComponentName provider = new ComponentName(context, TamNguLessonWidget.class);
        int[] ids = manager.getAppWidgetIds(provider);
        for (int id : ids) updateWidget(context, manager, id);
    }

    private static void updateWidget(Context context, AppWidgetManager manager, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_tam_ngu_lesson);
        try {
            JSONArray lessons = loadLessons(context);
            LessonMoment moment = currentMoment(context, lessons.length());
            JSONObject lesson = lessons.getJSONObject(moment.lessonIndex);
            views.setTextViewText(R.id.widget_eyebrow, moment.time + " · TAM NGỮ 6H");
            views.setTextViewText(R.id.widget_title, lesson.optString("title", "Bài học hôm nay"));
            views.setTextViewText(R.id.widget_english, "EN  " + lesson.optString("english"));
            views.setTextViewText(R.id.widget_chinese, "中  " + lesson.optString("chinese"));
            views.setTextViewText(R.id.widget_vietnamese, "VI  " + lesson.optString("vietnamese"));
        } catch (Exception error) {
            views.setTextViewText(R.id.widget_eyebrow, "TAM NGỮ 6H");
            views.setTextViewText(R.id.widget_title, "Mỗi lần nhìn máy, học thêm một chút.");
            views.setTextViewText(R.id.widget_english, "EN  A new lesson is ready.");
            views.setTextViewText(R.id.widget_chinese, "中  新的一课已经准备好了。");
            views.setTextViewText(R.id.widget_vietnamese, "VI  Một bài học mới đã sẵn sàng.");
        }

        Intent openApp = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("tamngu6h://today"));
        PendingIntent openPending = PendingIntent.getActivity(
            context,
            widgetId,
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, openPending);
        manager.updateAppWidget(widgetId, views);
    }

    private static JSONArray loadLessons(Context context) throws Exception {
        StringBuilder json = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
            context.getAssets().open("public/widget-lessons.json"), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) json.append(line);
        }
        JSONArray lessons = new JSONObject(json.toString()).getJSONArray("lessons");
        if (lessons.length() == 0) throw new IllegalStateException("Empty lesson deck");
        return lessons;
    }

    private static LessonMoment currentMoment(Context context, int lessonCount) {
        List<String> schedule = loadSchedule(context);
        Calendar date = Calendar.getInstance();
        int nowMinutes = date.get(Calendar.HOUR_OF_DAY) * 60 + date.get(Calendar.MINUTE);
        int slot = -1;
        for (int index = 0; index < schedule.size(); index++) {
            String[] parts = schedule.get(index).split(":");
            int scheduledMinutes = Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
            if (scheduledMinutes <= nowMinutes) slot = index;
        }
        if (slot < 0) {
            date.add(Calendar.DAY_OF_YEAR, -1);
            slot = schedule.size() - 1;
        }
        date.set(Calendar.HOUR_OF_DAY, 0);
        date.set(Calendar.MINUTE, 0);
        date.set(Calendar.SECOND, 0);
        date.set(Calendar.MILLISECOND, 0);
        long localDay = TimeUnit.MILLISECONDS.toDays(date.getTimeInMillis());
        long sequence = localDay * schedule.size() + slot;
        int lessonIndex = Math.floorMod(sequence, lessonCount);
        return new LessonMoment(lessonIndex, schedule.get(slot));
    }

    private static List<String> loadSchedule(Context context) {
        String json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(SCHEDULE, DEFAULT_SCHEDULE);
        List<String> result = new ArrayList<>();
        try {
            JSONArray values = new JSONArray(json);
            for (int i = 0; i < values.length(); i++) {
                String value = values.optString(i);
                if (value.matches("(?:[01]\\d|2[0-3]):[0-5]\\d")) result.add(value);
            }
        } catch (Exception ignored) {}
        if (result.isEmpty()) {
            result.add("06:00");
            result.add("12:00");
            result.add("18:00");
        }
        Collections.sort(result);
        return result;
    }

    private static final class LessonMoment {
        final int lessonIndex;
        final String time;

        LessonMoment(int lessonIndex, String time) {
            this.lessonIndex = lessonIndex;
            this.time = time;
        }
    }
}
