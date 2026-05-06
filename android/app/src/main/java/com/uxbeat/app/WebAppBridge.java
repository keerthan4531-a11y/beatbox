package com.uxbeat.app;

import android.content.Context;
import android.content.Intent;
import android.webkit.JavascriptInterface;

/**
 * JavaScript Interface for WebView → Native communication.
 * Allows the web app to update the Android media notification with
 * current song metadata and playback state.
 *
 * 🔧 FIX: Added setPackage() to make broadcast explicit for Android 14+
 *    On Android 14, implicit broadcasts to non-exported receivers are silently dropped.
 *    Making the intent explicit ensures it reaches MusicService's BroadcastReceiver.
 */
public class WebAppBridge {
    private final Context context;

    public WebAppBridge(Context context) {
        this.context = context;
    }

    @JavascriptInterface
    public void updateMediaNotification(String title, String artist, String artwork, boolean isPlaying) {
        Intent intent = new Intent(MusicService.ACTION_UPDATE_META);
        // 🔧 FIX: Make broadcast explicit for Android 14+ compatibility
        intent.setPackage(context.getPackageName());
        intent.putExtra("title", title != null ? title : "BeatBox");
        intent.putExtra("artist", artist != null ? artist : "");
        intent.putExtra("artwork", artwork != null ? artwork : "");
        intent.putExtra("isPlaying", isPlaying);
        context.sendBroadcast(intent);
    }

    @JavascriptInterface
    public void log(String message) {
        android.util.Log.d("BeatBox", "[WebApp] " + message);
    }
}
