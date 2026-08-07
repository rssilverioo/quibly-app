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

    /**
     Quanto falta do bloco atual, e quanto ele dura por inteiro.

     **O app conta para baixo e a Live Activity contava para cima.** Numa
     sessão de pomodoro a tela mostrava "faltam 24:51 deste bloco" enquanto a
     Ilha mostrava "7:58 de sessão" — os dois certos pela própria régua, e
     contraditórios lado a lado. Quem olha não tem como saber qual é o número.

     Com a fase aqui, as duas superfícies mostram a mesma coisa. E há um ganho
     que não era o objetivo: uma contagem regressiva tem **largura máxima
     conhecida** — o bloco inteiro —, então a Dynamic Island deixa de poder
     esticar por reserva de espaço, que foi o defeito do `Date.distantFuture`.

     `phaseTotalSeconds == 0` significa cronômetro livre: sem bloco, sem
     regressiva, sem barra. É o modo em que contar para cima é a única leitura
     possível.
     */
    public var phaseRemainingSeconds: Int
    public var phaseTotalSeconds: Int
    /// "Foco", "Pausa" — traduzido no app, porque a extensão não tem i18n.
    public var phaseLabel: String

    public init(
      startedAt: Date,
      baseElapsedSeconds: Int,
      isRunning: Bool,
      phaseRemainingSeconds: Int = 0,
      phaseTotalSeconds: Int = 0,
      phaseLabel: String = ""
    ) {
      self.startedAt = startedAt
      self.baseElapsedSeconds = baseElapsedSeconds
      self.isRunning = isRunning
      self.phaseRemainingSeconds = phaseRemainingSeconds
      self.phaseTotalSeconds = phaseTotalSeconds
      self.phaseLabel = phaseLabel
    }

    /// Se há um bloco com fim, e portanto regressiva e barra.
    public var temFase: Bool { phaseTotalSeconds > 0 }

    /**
     O instante em que o bloco acaba, para o sistema contar sozinho.

     Só faz sentido enquanto corre: pausado, o fim não avança com o relógio, e
     o widget mostra o valor congelado em vez de um horário que não vai chegar.
     */
    public var phaseEndsAt: Date {
      Date().addingTimeInterval(Double(phaseRemainingSeconds))
    }

    /// Onde o bloco começou, para a barra saber a fração já cumprida.
    public var phaseStartedAt: Date {
      phaseEndsAt.addingTimeInterval(-Double(phaseTotalSeconds))
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
