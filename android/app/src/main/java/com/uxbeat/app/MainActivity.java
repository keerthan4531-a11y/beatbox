package com.uxbeat.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.os.Message;
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
        
        // Disable popups and enable standard web features
        webView.getSettings().setSupportMultipleWindows(false);
        webView.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setJavaScriptEnabled(true);
        
        // 🔧 FIX: Set a clean User-Agent to avoid detection by movie embed servers
        // Many servers block the default WebView/Capacitor UA.
        String standardUA = webView.getSettings().getUserAgentString()
                .replace("Version/4.0 ", "")
                .replace("Capacitor/", "")
                .replace("com.uxbeat.app", "Chrome/124.0.0.0");
        webView.getSettings().setUserAgentString(standardUA);

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
                // Block known ad networks, trackers and betting sites
                if (url.contains("doubleclick.net") || 
                    url.contains("googleadservices.com") || 
                    url.contains("popads") || 
                    url.contains("adsystem") ||
                    url.contains("adnetwork") ||
                    url.contains("adsco.re") ||
                    url.contains("onclick") ||
                    url.contains("yandex.ru") ||
                    url.contains("clarity.ms") ||
                    url.contains("cloudflareinsights")) {
                    return new WebResourceResponse("text/plain", "UTF-8", null);
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString().toLowerCase();
                
                // 🛡️ STRICT ANDROID LOGIC: Block ALL top-level navigation to external sites.
                // Our app should only navigate within 'localhost'.
                // This prevents ads in iframes from hijacking the main app screen.
                if (!url.contains("localhost")) {
                    android.util.Log.d("BeatBox", "Blocked external navigation: " + url);
                    return true; // Return true means we handled (blocked) it.
                }
                
                return super.shouldOverrideUrlLoading(view, request);
            }
        });

        // 🛡️ STRICT WINDOW LOGIC: Prevent 'window.open' or 'target="_blank"' from working.
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                // Return false means we don't allow creating new windows/tabs.
                android.util.Log.d("BeatBox", "Blocked popup window request.");
                return false; 
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
