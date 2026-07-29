import Foundation

#if canImport(ActivityKit)
import ActivityKit

/**
 Shared shape of the study-session Live Activity.

 This file is compiled into **both** the app and the widget extension — they
 have to agree on the attribute layout byte for byte, or the system silently
 refuses to start the activity. That is why it lives on its own rather than
 inside either target.

 ## The design decision that matters here

 `startedAt` and `pausedAt` are timestamps, not a countdown value. The widget
 renders with SwiftUI's `Text(timerInterval:)`, which the system ticks on its
 own, once per second, with **no app runtime involved**.

 This is the whole reason a Live Activity works on iOS. Unlike Android, there is
 no way to keep an app running in the background indefinitely — no foreground
 service, no exceptions, and no amount of engineering changes that. So the
 timer on the lock screen cannot be something the app updates. It has to be
 something the *system* can advance from a fixed reference point while our
 process is suspended or dead.

 Which leaves one honest way to think about it: on iOS the Live Activity is a
 **display**, not a mechanism. What actually protects the user's study time is
 the server — it measures the duration and, if the heartbeat stops, credits the
 session up to the last beat (docs/API-SESSIONS.md §5). The Live Activity keeps
 the user informed and gives them pause/end buttons; it does not keep the
 session alive, because nothing on iOS can.
 */
public struct StudyTimerAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    /// When the running stretch began, in terms the system can count from.
    public var startedAt: Date
    /// Seconds already banked before `startedAt` — pauses, or a relaunch.
    public var baseElapsedSeconds: Int
    /// When paused, the timer freezes at `baseElapsedSeconds`.
    public var isRunning: Bool

    public init(startedAt: Date, baseElapsedSeconds: Int, isRunning: Bool) {
      self.startedAt = startedAt
      self.baseElapsedSeconds = baseElapsedSeconds
      self.isRunning = isRunning
    }

    /**
     Minutos decorridos, para escolher o marco do mascote.

     Enquanto corre, extrapola a partir de `startedAt` — o widget não recebe
     atualização a cada minuto, então o marco precisa ser derivável do estado
     que ele já tem. É a única contagem feita fora do servidor em todo o
     sistema, e ela só escolhe um desenho: nada de tempo creditado depende
     dela.
     */
    public var totalMinutes: Int {
      guard isRunning else { return baseElapsedSeconds / 60 }
      let since = Int(Date().timeIntervalSince(startedAt))
      return (baseElapsedSeconds + max(0, since)) / 60
    }
  }

  public var subjectName: String
  public var sessionId: String

  public init(subjectName: String, sessionId: String) {
    self.subjectName = subjectName
    self.sessionId = sessionId
  }
}
#endif
