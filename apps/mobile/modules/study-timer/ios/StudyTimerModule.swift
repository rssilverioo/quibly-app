import ExpoModulesCore

#if canImport(ActivityKit)
import ActivityKit
#endif

/**
 JS bridge for the iOS Live Activity.

 Mirrors the Android module's API on purpose, even though the two do very
 different things underneath (see `StudyTimerAttributes.swift` for why). The JS
 layer calls `start`/`update`/`stop` and does not branch on platform.

 Everything here degrades quietly: Live Activities need iOS 16.1+, and the user
 can switch them off system-wide at any moment. None of that is an error worth
 surfacing — the session is safe on the server regardless, so a missing Live
 Activity costs the user visibility, not time.
 */
public class StudyTimerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StudyTimer")

    Events("onNotificationAction")

    AsyncFunction("start") { (subject: String, elapsedSeconds: Int, isRunning: Bool) in
      #if canImport(ActivityKit)
      guard #available(iOS 16.1, *) else { return }
      guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }

      // Only one session can be live at a time (the server enforces it with a
      // 409), so adopt any existing activity rather than stacking a second.
      if let existing = Activity<StudyTimerAttributes>.activities.first {
        await Self.update(existing, elapsedSeconds: elapsedSeconds, isRunning: isRunning)
        return
      }

      let attributes = StudyTimerAttributes(subjectName: subject, sessionId: "")
      let state = StudyTimerAttributes.ContentState(
        startedAt: Date(),
        baseElapsedSeconds: elapsedSeconds,
        isRunning: isRunning
      )

      do {
        _ = try Activity.request(
          attributes: attributes,
          content: .init(state: state, staleDate: nil),
          pushType: nil
        )
      } catch {
        // Throwing here would fail a `startSession()` that otherwise succeeded.
        NSLog("[StudyTimer] Could not start Live Activity: \(error.localizedDescription)")
      }
      #endif
    }

    AsyncFunction("update") { (subject: String, elapsedSeconds: Int, isRunning: Bool) in
      #if canImport(ActivityKit)
      guard #available(iOS 16.1, *) else { return }
      guard let activity = Activity<StudyTimerAttributes>.activities.first else { return }
      await Self.update(activity, elapsedSeconds: elapsedSeconds, isRunning: isRunning)
      #endif
    }

    AsyncFunction("stop") {
      #if canImport(ActivityKit)
      guard #available(iOS 16.1, *) else { return }
      for activity in Activity<StudyTimerAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
      #endif
    }

    /// Android-only concepts. Answered so the JS layer needs no platform branch.
    Function("isBatteryOptimizationIgnored") { true }
    Function("getManufacturer") { "Apple" }
    AsyncFunction("openBatterySettings") { }

    Function("isRunning") {
      #if canImport(ActivityKit)
      if #available(iOS 16.1, *) {
        return !Activity<StudyTimerAttributes>.activities.isEmpty
      }
      #endif
      return false
    }
  }

  #if canImport(ActivityKit)
  @available(iOS 16.1, *)
  private static func update(
    _ activity: Activity<StudyTimerAttributes>,
    elapsedSeconds: Int,
    isRunning: Bool
  ) async {
    // Re-anchoring `startedAt` to now on every update is what keeps the
    // lock-screen timer honest: the system counts forward from this instant,
    // and `baseElapsedSeconds` carries the server's corrected total. Drift
    // accumulated between heartbeats is discarded rather than compounded.
    let state = StudyTimerAttributes.ContentState(
      startedAt: Date(),
      baseElapsedSeconds: elapsedSeconds,
      isRunning: isRunning
    )
    await activity.update(.init(state: state, staleDate: nil))
  }
  #endif
}
