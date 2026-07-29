package com.quibly.studytimer

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.os.SystemClock

/**
 * Keeps a study session running when the app is not on screen.
 *
 * ## What this actually buys us
 *
 * A foreground service is the only way on Android to keep the process — and
 * therefore the JS runtime, and therefore the 30-second heartbeat — alive once
 * the user swipes away or switches apps. Without it, Android freezes the
 * process within a minute or two, the heartbeat stops, and five minutes later
 * the server sweeps the session as abandoned. The user studied for two hours
 * and gets credited for four minutes.
 *
 * The persistent notification is not decoration: it is the price Android
 * charges for the privilege, and it doubles as the lock-screen timer.
 *
 * ## Why the notification's clock is a chronometer, not a string we update
 *
 * `setUsesChronometer(true)` hands the ticking to the system: it renders a
 * counter from a base timestamp and keeps it moving with no further work from
 * us. Updating a text field every second instead would mean a wakeup per second
 * for hours — the single fastest way to get flagged by battery optimisation and
 * killed anyway.
 *
 * The base is expressed in `SystemClock.elapsedRealtime()`, which keeps counting
 * while the device is asleep and, unlike wall-clock time, cannot jump when the
 * user changes the time zone mid-session.
 */
class StudyTimerService : Service() {

  companion object {
    const val ACTION_START = "com.quibly.studytimer.START"
    const val ACTION_UPDATE = "com.quibly.studytimer.UPDATE"
    const val ACTION_STOP = "com.quibly.studytimer.STOP"
    const val ACTION_PAUSE_REQUESTED = "com.quibly.studytimer.PAUSE_REQUESTED"
    const val ACTION_RESUME_REQUESTED = "com.quibly.studytimer.RESUME_REQUESTED"
    const val ACTION_END_REQUESTED = "com.quibly.studytimer.END_REQUESTED"

    const val EXTRA_SUBJECT = "subject"
    const val EXTRA_ELAPSED_SECONDS = "elapsedSeconds"
    const val EXTRA_IS_RUNNING = "isRunning"

    private const val CHANNEL_ID = "quibly_study_session"
    private const val NOTIFICATION_ID = 4711

    /**
     * Set by the module when JS asks a notification action to be handled.
     * A static hop is unpleasant, but the alternative — binding the service to
     * the module — outlives its usefulness the moment the process is restarted
     * by the system with no module attached.
     */
    @Volatile
    var actionListener: ((String) -> Unit)? = null
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START, ACTION_UPDATE -> {
        val subject = intent.getStringExtra(EXTRA_SUBJECT) ?: ""
        val elapsed = intent.getIntExtra(EXTRA_ELAPSED_SECONDS, 0)
        val isRunning = intent.getBooleanExtra(EXTRA_IS_RUNNING, true)
        startForeground(NOTIFICATION_ID, buildNotification(subject, elapsed, isRunning))
      }

      ACTION_PAUSE_REQUESTED -> actionListener?.invoke("pause")
      ACTION_RESUME_REQUESTED -> actionListener?.invoke("resume")
      ACTION_END_REQUESTED -> actionListener?.invoke("end")

      ACTION_STOP -> {
        stopForegroundCompat()
        stopSelf()
      }
    }

    // START_STICKY would have Android recreate this service with a null intent
    // after a low-memory kill, leaving a foreground service with no session
    // behind it and no way to rebuild one. The session's survival does not
    // depend on this process anyway — the server is measuring, and it credits
    // up to the last heartbeat — so a clean death is better than a zombie
    // notification the user cannot dismiss.
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    actionListener = null
    super.onDestroy()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Study session",
      // LOW: visible and persistent, but it must never buzz. This notification
      // is present for hours while someone is trying to concentrate.
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Shows your running study session"
      setShowBadge(false)
      enableVibration(false)
      setSound(null, null)
    }
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(
    subject: String,
    elapsedSeconds: Int,
    isRunning: Boolean,
  ): Notification {
    val openApp = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }

    val builder = Notification.Builder(this, CHANNEL_ID)
      .setContentTitle(if (subject.isNotEmpty()) subject else "Studying")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(openApp)
      // Keeps it out of the way when the user pulls the shade down mid-session.
      .setCategory(Notification.CATEGORY_STOPWATCH)

    if (isRunning) {
      // Anchor the chronometer to when the session *started*, derived by
      // subtracting the elapsed count the server reported. Re-anchoring on each
      // update is what keeps the notification honest after a heartbeat corrects
      // for drift or for time the app spent frozen.
      builder
        .setWhen(SystemClock.elapsedRealtime() - elapsedSeconds * 1000L)
        .setUsesChronometer(true)
    } else {
      builder
        .setUsesChronometer(false)
        .setContentText(formatElapsed(elapsedSeconds) + " • paused")
    }

    builder.addAction(
      Notification.Action.Builder(
        null,
        if (isRunning) "Pause" else "Resume",
        servicePendingIntent(
          if (isRunning) ACTION_PAUSE_REQUESTED else ACTION_RESUME_REQUESTED,
          requestCode = 1,
        ),
      ).build(),
    )

    builder.addAction(
      Notification.Action.Builder(
        null,
        "End",
        servicePendingIntent(ACTION_END_REQUESTED, requestCode = 2),
      ).build(),
    )

    return builder.build()
  }

  private fun servicePendingIntent(action: String, requestCode: Int): PendingIntent {
    val intent = Intent(this, StudyTimerService::class.java).setAction(action)
    return PendingIntent.getService(
      this,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun formatElapsed(seconds: Int): String {
    val h = seconds / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return if (h > 0) String.format("%d:%02d:%02d", h, m, s) else String.format("%02d:%02d", m, s)
  }

  private fun stopForegroundCompat() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      stopForeground(STOP_FOREGROUND_REMOVE)
    } else {
      @Suppress("DEPRECATION")
      stopForeground(true)
    }
  }
}
