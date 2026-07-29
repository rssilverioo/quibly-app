package com.quibly.studytimer

import android.app.ActivityManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS bridge for the Android foreground service.
 *
 * The API is deliberately the same shape as the iOS one (see
 * `ios/StudyTimerModule.swift`) even though what happens underneath is very
 * different: on Android this keeps the process alive, on iOS nothing can. The
 * JS layer should not have to care.
 */
class StudyTimerModule : Module() {

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  override fun definition() = ModuleDefinition {
    Name("StudyTimer")

    Events("onNotificationAction")

    OnCreate {
      // Notification buttons arrive on the service; forward them to JS so the
      // same store methods run whether the user tapped the notification or the
      // in-app control.
      StudyTimerService.actionListener = { action ->
        sendEvent("onNotificationAction", mapOf("action" to action))
      }
    }

    OnDestroy {
      StudyTimerService.actionListener = null
    }

    AsyncFunction("start") { subject: String, elapsedSeconds: Int, isRunning: Boolean ->
      val intent = Intent(context, StudyTimerService::class.java).apply {
        action = StudyTimerService.ACTION_START
        putExtra(StudyTimerService.EXTRA_SUBJECT, subject)
        putExtra(StudyTimerService.EXTRA_ELAPSED_SECONDS, elapsedSeconds)
        putExtra(StudyTimerService.EXTRA_IS_RUNNING, isRunning)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    AsyncFunction("update") { subject: String, elapsedSeconds: Int, isRunning: Boolean ->
      val intent = Intent(context, StudyTimerService::class.java).apply {
        action = StudyTimerService.ACTION_UPDATE
        putExtra(StudyTimerService.EXTRA_SUBJECT, subject)
        putExtra(StudyTimerService.EXTRA_ELAPSED_SECONDS, elapsedSeconds)
        putExtra(StudyTimerService.EXTRA_IS_RUNNING, isRunning)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    AsyncFunction("stop") {
      context.startService(
        Intent(context, StudyTimerService::class.java).setAction(StudyTimerService.ACTION_STOP),
      )
    }

    /**
     * Whether this app is exempt from Doze-style battery optimisation.
     *
     * Xiaomi (MIUI), Samsung, Huawei and Oppo ship aggressive killers that
     * ignore the ordinary foreground-service contract and will stop the service
     * anyway. There is no API to ask "will my OEM kill me" — the standard
     * exemption below is the closest proxy that exists, and on those devices it
     * is usually off by default. The JS layer uses this to decide whether to
     * explain the situation to the user; see `services/study-timer.ts`.
     */
    Function("isBatteryOptimizationIgnored") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@Function true
      val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      power.isIgnoringBatteryOptimizations(context.packageName)
    }

    /**
     * Open the OS screen where the user can grant the exemption.
     *
     * Deliberately the *settings list*, not the
     * `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` direct-prompt intent: that prompt
     * requires a permission Google Play rejects for most app categories, and a
     * study timer is not one of the exempt ones.
     */
    AsyncFunction("openBatterySettings") {
      val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    /** The manufacturer, so JS can tailor the wording for the known offenders. */
    Function("getManufacturer") { Build.MANUFACTURER ?: "" }

    /**
     * Whether the service is currently up. Used on app resume to decide between
     * restarting it and leaving the running one alone.
     */
    Function("isRunning") {
      val manager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      @Suppress("DEPRECATION")
      manager.getRunningServices(Int.MAX_VALUE).any {
        it.service.className == StudyTimerService::class.java.name
      }
    }
  }
}
