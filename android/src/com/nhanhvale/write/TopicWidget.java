package com.nhanhvale.write;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public final class TopicWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        Intent open = new Intent(context, QuickTopicActivity.class)
            .setAction(QuickTopicActivity.QUICK_TOPIC);
        PendingIntent tap = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_IMMUTABLE);
        for (int id : ids) {
            RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.topic_widget);
            view.setOnClickPendingIntent(R.id.open_topic, tap);
            manager.updateAppWidget(id, view);
        }
    }
}
