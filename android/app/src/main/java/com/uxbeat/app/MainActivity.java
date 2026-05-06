package com.uxbeat.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

/**
 * MainActivity — Capacitor Bridge + Native Media Control Bridge
 *
 * 🔧 FIX: Added BroadcastReceiver to catch media control actions from MusicService
 *    and inject JavaScript into the WebView to dispatch custom events.
 *    This fixes lock screen next/prev/pause buttons not working.
 */
public class MainActivity extends BridgeActivity {

    private BroadcastReceiver mediaActionReceiver;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Start Foreground Service for Media Playback (Android 14 Support)
        android.content.Intent serviceIntent = new android.content.Intent(this, MusicService.class);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent);
        } else {
            startService(serviceIntent);
        }

        // Create Media Notification Channel for Android 8+
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            android.app.NotificationChannel channel = new android.app.NotificationChannel(
                "music_channel", 
                "Music Playback", 
                android.app.NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows media controls on lock screen");
            channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            android.app.NotificationManager manager = getSystemService(android.app.NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
        
        // Custom WebView Interceptor to block Ads (like Brave)
        WebView webView = this.bridge.getWebView();
        
        // Disable popups
        webView.getSettings().setSupportMultipleWindows(false);
        webView.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);

        // Register the JavaScript → Native bridge for media notifications
        webView.addJavascriptInterface(new WebAppBridge(this), "BeatBoxBridge");

        // 🔧 FIX: Register BroadcastReceiver for Native → JS media control actions
        // When user taps Next/Prev/Pause on notification or lock screen,
        // MusicService broadcasts "com.beatbox.MEDIA_ACTION" which we catch here
        // and inject JavaScript to dispatch the custom event to PlayerContext.
        mediaActionReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null) return;
                String action = intent.getStringExtra("action");
                if (action == null || action.isEmpty()) return;

                // Map action to JS event
                final String jsAction;
                switch (action) {
                    case "play":
                    case "pause":
                    case "next":
                    case "prev":
                        jsAction = action;
                        break;
                    default:
                        if (action.startsWith("seek:")) {
                            jsAction = action;
                        } else {
                            return;
                        }
                }

                // Inject JavaScript into the WebView on the main thread
                runOnUiThread(() -> {
                    try {
                        WebView wv = bridge.getWebView();
                        if (wv != null) {
                            String js = "window.dispatchEvent(new CustomEvent('beatbox-media-action', " +
                                        "{ detail: { action: '" + jsAction + "' } }));";
                            wv.evaluateJavascript(js, null);
                        }
                    } catch (Exception e) {
                        android.util.Log.e("BeatBox", "Failed to inject media action JS", e);
                    }
                });
            }
        };

        IntentFilter mediaFilter = new IntentFilter("com.beatbox.MEDIA_ACTION");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(mediaActionReceiver, mediaFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(mediaActionReceiver, mediaFilter);
        }

        webView.setWebViewClient(new com.getcapacitor.BridgeWebViewClient(this.bridge) {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString().toLowerCase();
                // Block known ad networks and betting sites
                if (url.contains("doubleclick.net") || 
                    url.contains("googleadservices.com") || 
                    url.contains("popads") || 
                    url.contains("bet365") || 
                    url.contains("adsystem") ||
                    url.contains("1xbet") ||
                    url.contains("adnetwork") ||
                    url.contains("onclick") ||
                    url.contains("yandex.ru") ||
                    url.contains("clarity.ms") ||
                    url.contains("cloudflareinsights") ||
                    url.contains("vidsrc") && url.contains("ads")) {
                    return new WebResourceResponse("text/plain", "UTF-8", null);
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString().toLowerCase();
                // Block any external navigation that looks like an ad
                if (!url.startsWith("http://localhost") && (
                    url.contains("bet") || url.contains("casino") || url.contains("game") || 
                    url.contains("ads") || url.contains("click") || url.contains("track")
                )) {
                    return true; // Handle (block) the navigation
                }
                return super.shouldOverrideUrlLoading(view, request);
            }
        });
    }

    @Override
    public void onDestroy() {
        // Unregister the media action receiver
        if (mediaActionReceiver != null) {
            try {
                unregisterReceiver(mediaActionReceiver);
            } catch (Exception ignored) {}
        }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        WebView webView = this.bridge.getWebView();
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
