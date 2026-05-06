package com.uxbeat.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Foreground MusicService for media playback notification & lock screen controls.
 *
 * 🔧 FIX: Added WakeLock to prevent CPU sleep during background playback.
 * 🔧 FIX: Improved artwork loading with retry and caching.
 * 🔧 FIX: Better error handling in broadcast receiver.
 */
public class MusicService extends Service {
    private static final String CHANNEL_ID = "music_channel";
    private static final int NOTIFICATION_ID = 101;

    public static final String ACTION_UPDATE_META = "com.beatbox.UPDATE_META";
    public static final String ACTION_PLAY_PAUSE  = "com.beatbox.PLAY_PAUSE";
    public static final String ACTION_NEXT        = "com.beatbox.NEXT";
    public static final String ACTION_PREV        = "com.beatbox.PREV";

    private MediaSessionCompat mediaSession;
    private String currentTitle = "BeatBox";
    private String currentArtist = "Music Player";
    private String currentArtworkUrl = "";
    private boolean isPlaying = false;
    private Bitmap currentArtwork = null;
    private String lastLoadedArtworkUrl = ""; // Cache check to avoid re-downloading same artwork
    private PowerManager.WakeLock wakeLock;

    private final BroadcastReceiver metaReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || !ACTION_UPDATE_META.equals(intent.getAction())) return;

            try {
                String newTitle = intent.getStringExtra("title");
                String newArtist = intent.getStringExtra("artist");
                String newArtwork = intent.getStringExtra("artwork");
                boolean newIsPlaying = intent.getBooleanExtra("isPlaying", false);

                currentTitle = (newTitle != null && !newTitle.isEmpty()) ? newTitle : "BeatBox";
                currentArtist = (newArtist != null && !newArtist.isEmpty()) ? newArtist : "";
                isPlaying = newIsPlaying;

                // Manage WakeLock based on playback state
                manageWakeLock();

                // Update MediaSession state immediately (even before artwork loads)
                updateMediaSession();

                // Load artwork if URL changed
                boolean artworkChanged = newArtwork != null && !newArtwork.isEmpty()
                    && !newArtwork.equals(lastLoadedArtworkUrl);

                if (artworkChanged) {
                    currentArtworkUrl = newArtwork;
                    loadArtworkAsync(newArtwork);
                } else {
                    // Just update notification with existing artwork
                    updateNotification();
                }
            } catch (Exception e) {
                android.util.Log.e("BeatBox", "Error processing meta update", e);
                updateNotification();
            }
        }
    };

    /**
     * Load artwork in background thread with retry
     */
    private void loadArtworkAsync(final String artworkUrl) {
        new Thread(() -> {
            Bitmap bmp = downloadBitmap(artworkUrl, 2);
            if (bmp != null) {
                currentArtwork = bmp;
                lastLoadedArtworkUrl = artworkUrl;
            }
            // Update notification on main thread
            updateNotification();
        }).start();
    }

    /**
     * Download bitmap with retry logic
     */
    private Bitmap downloadBitmap(String urlStr, int retries) {
        for (int i = 0; i <= retries; i++) {
            try {
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setDoInput(true);
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.setInstanceFollowRedirects(true);
                conn.setRequestProperty("User-Agent", "BeatBox/1.0");
                conn.connect();

                int code = conn.getResponseCode();
                if (code == 301 || code == 302) {
                    String redirect = conn.getHeaderField("Location");
                    conn.disconnect();
                    if (redirect != null) {
                        return downloadBitmap(redirect, 0);
                    }
                }

                if (code == 200) {
                    InputStream input = conn.getInputStream();
                    Bitmap bmp = BitmapFactory.decodeStream(input);
                    input.close();
                    conn.disconnect();
                    return bmp;
                }
                conn.disconnect();
            } catch (Exception e) {
                android.util.Log.w("BeatBox", "Artwork download attempt " + (i + 1) + " failed: " + e.getMessage());
                if (i < retries) {
                    try { Thread.sleep(500); } catch (InterruptedException ignored) {}
                }
            }
        }
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();

        // Create WakeLock for background playback
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "BeatBox::MusicPlayback");
            wakeLock.setReferenceCounted(false);
        }

        // Create MediaSession
        mediaSession = new MediaSessionCompat(this, "BeatBoxSession");
        mediaSession.setActive(true);
        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay()          { broadcastToWebView("play"); }
            @Override public void onPause()         { broadcastToWebView("pause"); }
            @Override public void onSkipToNext()    { broadcastToWebView("next"); }
            @Override public void onSkipToPrevious(){ broadcastToWebView("prev"); }
            @Override public void onSeekTo(long pos){ broadcastToWebView("seek:" + pos); }
        });

        // Register meta receiver
        IntentFilter filter = new IntentFilter(ACTION_UPDATE_META);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(metaReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(metaReceiver, filter);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Handle notification button actions
        if (intent != null && intent.getAction() != null) {
            switch (intent.getAction()) {
                case ACTION_PLAY_PAUSE:
                    isPlaying = !isPlaying;
                    broadcastToWebView(isPlaying ? "play" : "pause");
                    manageWakeLock();
                    updateMediaSession();
                    updateNotification();
                    break;
                case ACTION_NEXT:
                    broadcastToWebView("next");
                    break;
                case ACTION_PREV:
                    broadcastToWebView("prev");
                    break;
            }
            return START_STICKY;
        }

        // Initial foreground notification
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        return START_STICKY;
    }

    /**
     * 🔧 Manage WakeLock — acquire when playing, release when paused
     */
    private void manageWakeLock() {
        if (wakeLock == null) return;
        if (isPlaying) {
            if (!wakeLock.isHeld()) {
                wakeLock.acquire(30 * 60 * 1000L); // 30 minute timeout safety
            }
        } else {
            if (wakeLock.isHeld()) {
                wakeLock.release();
            }
        }
    }

    private void updateMediaSession() {
        // Playback state
        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO |
                PlaybackStateCompat.ACTION_PLAY_PAUSE
            )
            .setState(
                isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN,
                1.0f
            );
        mediaSession.setPlaybackState(stateBuilder.build());

        // Metadata
        MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "BeatBox");
        if (currentArtwork != null) {
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentArtwork);
            metaBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ART, currentArtwork);
        }
        mediaSession.setMetadata(metaBuilder.build());
    }

    private Notification buildNotification() {
        // Pending intent to open app
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Action: Previous
        Intent prevIntent = new Intent(this, MusicService.class);
        prevIntent.setAction(ACTION_PREV);
        PendingIntent prevPI = PendingIntent.getService(this, 1, prevIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Action: Play/Pause
        Intent ppIntent = new Intent(this, MusicService.class);
        ppIntent.setAction(ACTION_PLAY_PAUSE);
        PendingIntent ppPI = PendingIntent.getService(this, 2, ppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Action: Next
        Intent nextIntent = new Intent(this, MusicService.class);
        nextIntent.setAction(ACTION_NEXT);
        PendingIntent nextPI = PendingIntent.getService(this, 3, nextIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        int playPauseIcon = isPlaying
            ? android.R.drawable.ic_media_pause
            : android.R.drawable.ic_media_play;
        String playPauseLabel = isPlaying ? "Pause" : "Play";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentTitle)
            .setContentText(currentArtist)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(contentIntent)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setOngoing(isPlaying)
            .setShowWhen(false)
            .addAction(android.R.drawable.ic_media_previous, "Previous", prevPI)
            .addAction(playPauseIcon, playPauseLabel, ppPI)
            .addAction(android.R.drawable.ic_media_next, "Next", nextPI)
            .setStyle(new MediaStyle()
                .setMediaSession(mediaSession.getSessionToken())
                .setShowActionsInCompactView(0, 1, 2)
            );

        if (currentArtwork != null) {
            builder.setLargeIcon(currentArtwork);
        }

        return builder.build();
    }

    private void updateNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager != null) {
            updateMediaSession();
            manager.notify(NOTIFICATION_ID, buildNotification());
        }
    }

    private void broadcastToWebView(String action) {
        Intent intent = new Intent("com.beatbox.MEDIA_ACTION");
        intent.setPackage(getPackageName()); // 🔧 Explicit broadcast for Android 14+
        intent.putExtra("action", action);
        sendBroadcast(intent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Music Playback",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows music controls on lock screen & notification");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            channel.setShowBadge(false);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        try { unregisterReceiver(metaReceiver); } catch (Exception ignored) {}
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        // Release WakeLock
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
