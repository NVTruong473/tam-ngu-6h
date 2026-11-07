package com.nvtruong.tamngu6h;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TamNguWidget")
public class TamNguWidgetPlugin extends Plugin {
    private static final String PREFS = "tam_ngu_widget";
    private static final String SCHEDULE = "schedule_json";

    @PluginMethod
    public void requestPin(PluginCall call) {
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        boolean supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            && manager.isRequestPinAppWidgetSupported();
        JSObject result = new JSObject();
        result.put("supported", supported);
        if (!supported) {
            result.put("requested", false);
            call.resolve(result);
            return;
        }

        ComponentName provider = new ComponentName(context, TamNguLessonWidget.class);
        Intent callbackIntent = new Intent(context, TamNguLessonWidget.class)
            .setAction(TamNguLessonWidget.ACTION_PINNED);
        PendingIntent callback = PendingIntent.getBroadcast(
            context,
            6060,
            callbackIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        boolean requested = manager.requestPinAppWidget(provider, null, callback);
        result.put("requested", requested);
        call.resolve(result);
    }

    @PluginMethod
    public void syncConfig(PluginCall call) {
        String scheduleJson = call.getString("scheduleJson", "[\"06:00\",\"12:00\",\"18:00\"]");
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(SCHEDULE, scheduleJson)
            .apply();
        TamNguLessonWidget.updateAll(getContext());
        call.resolve();
    }

    @PluginMethod
    public void refresh(PluginCall call) {
        TamNguLessonWidget.updateAll(getContext());
        call.resolve();
    }
}
