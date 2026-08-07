import ExpoModulesCore

#if canImport(ActivityKit)
import ActivityKit
#endif

/**
 JS bridge for the iOS Live Activity.

 Mirrors the Android module's API on purpose, even though the two do very
 different things underneath (see `StudyTimerAttributes.swift` for why). The JS
 layer calls `start`/`update`/`stop` and does not branch on platform.

 Everything here degrades quietly: Live Activities need iOS 16.2+, and the user
 can switch them off system-wide at any moment. None of that is an error worth
 surfacing — the session is safe on the server regardless, so a missing Live
 Activity costs the user visibility, not time.

 ## Por que 16.2 e não 16.1

 A ActivityKit chegou na 16.1, mas com outra API: `request(attributes:
 contentState:pushType:)` e `update(using:)`, que passam o estado solto. Na
 16.2 a Apple trocou por `ActivityContent` — `request(attributes:content:
 pushType:)`, `update(_:)`, `end(_:dismissalPolicy:)` — que é o que este
 arquivo usa, porque é o único jeito de declarar `staleDate`.

 Guardar 16.1 em volta de chamada 16.2 não compila:

   error: 'request(attributes:content:pushType:)' is only available in
          iOS 16.2 or newer

 O que é exatamente o erro que ficou escondido: sem `StudyTimer.podspec`, o
 autolinking descartava o módulo e este Swift nunca era compilado por ninguém.
 Um arquivo que não entra em nenhum target não tem erro de compilação — tem
 ausência de compilação, que é bem pior, porque parece sucesso.

 Baixar de volta para 16.1 exigiria reescrever nas APIs antigas e perder o
 `staleDate`. Não vale: 16.2 saiu em dezembro de 2022.
 */
public class StudyTimerModule: Module {
  public func definition() -> ModuleDefinition {
    Name("StudyTimer")

    /**
     Guarda no App Group o que o App Intent da extensão precisa saber.

     A extensão não enxerga o `UserDefaults.standard` do app, então este é o
     único jeito de o botão da Live Activity descobrir **qual** sessão pausar e
     **com que** credencial. Chamado no start da sessão e limpo no fim.

     Sem isto o intent não tem o que fazer e o widget cai no deep link, que abre
     o app — funciona, e é o caminho lento.
     */
    Function("setActionContext") { (sessionId: String, token: String, apiBaseUrl: String) in
      guard let defaults = UserDefaults(suiteName: "group.com.quibly.app") else {
        NSLog("[StudyTimer] App Group indisponível — os botões vão abrir o app.")
        return
      }
      defaults.set(sessionId, forKey: "quibly.session.id")
      defaults.set(token, forKey: "quibly.session.actionToken")
      defaults.set(apiBaseUrl, forKey: "quibly.api.baseUrl")
    }

    /// Apaga a credencial quando a sessão acaba. Token vivo sem sessão é
    /// superfície de ataque sem função.
    Function("clearActionContext") {
      guard let defaults = UserDefaults(suiteName: "group.com.quibly.app") else { return }
      defaults.removeObject(forKey: "quibly.session.id")
      defaults.removeObject(forKey: "quibly.session.actionToken")
    }

    Events("onNotificationAction")

    AsyncFunction("start") { (subject: String, elapsedSeconds: Int, isRunning: Bool, phaseRemaining: Int, phaseTotal: Int, phaseLabel: String) in
      #if canImport(ActivityKit)
      guard #available(iOS 16.2, *) else {
        NSLog("[StudyTimer] iOS < 16.2: sem Live Activity neste aparelho.")
        return
      }
      // Este guard tem dois motivos possíveis e a diferença importa muito:
      //
      //  1. o usuário desligou Live Activities nos Ajustes — legítimo, nada a
      //     fazer;
      //  2. o app não declara `NSSupportsLiveActivities` no Info.plist, ou não
      //     embarca nenhuma Widget Extension — e aí é bug nosso, porque o
      //     sistema devolve exatamente o mesmo `false` nos dois casos.
      //
      // Sem esta linha os dois são indistinguíveis e silenciosos. Foi assim
      // que a extensão ausente passou despercebida.
      guard ActivityAuthorizationInfo().areActivitiesEnabled else {
        NSLog(
          "[StudyTimer] areActivitiesEnabled = false. "
            + "Ou o usuário desligou nos Ajustes, ou o build não tem a Widget "
            + "Extension / NSSupportsLiveActivities (ver plugins/withLiveActivity.js)."
        )
        return
      }

      // Only one session can be live at a time (the server enforces it with a
      // 409), so adopt any existing activity rather than stacking a second.
      if let existing = Activity<StudyTimerAttributes>.activities.first {
        await Self.update(existing, elapsedSeconds: elapsedSeconds, isRunning: isRunning,
                          phaseRemaining: phaseRemaining, phaseTotal: phaseTotal, phaseLabel: phaseLabel)
        return
      }

      let attributes = StudyTimerAttributes(subjectName: subject, sessionId: "")
      let state = StudyTimerAttributes.ContentState(
        startedAt: Date(),
        baseElapsedSeconds: elapsedSeconds,
        isRunning: isRunning,
        phaseRemainingSeconds: phaseRemaining,
        phaseTotalSeconds: phaseTotal,
        phaseLabel: phaseLabel
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

    AsyncFunction("update") { (subject: String, elapsedSeconds: Int, isRunning: Bool, phaseRemaining: Int, phaseTotal: Int, phaseLabel: String) in
      #if canImport(ActivityKit)
      guard #available(iOS 16.2, *) else { return }
      guard let activity = Activity<StudyTimerAttributes>.activities.first else { return }
      await Self.update(activity, elapsedSeconds: elapsedSeconds, isRunning: isRunning,
                        phaseRemaining: phaseRemaining, phaseTotal: phaseTotal, phaseLabel: phaseLabel)
      #endif
    }

    AsyncFunction("stop") {
      #if canImport(ActivityKit)
      guard #available(iOS 16.2, *) else { return }
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
      if #available(iOS 16.2, *) {
        return !Activity<StudyTimerAttributes>.activities.isEmpty
      }
      #endif
      return false
    }
  }

  #if canImport(ActivityKit)
  @available(iOS 16.2, *)
  private static func update(
    _ activity: Activity<StudyTimerAttributes>,
    elapsedSeconds: Int,
    isRunning: Bool,
    phaseRemaining: Int,
    phaseTotal: Int,
    phaseLabel: String
  ) async {
    // Re-anchoring `startedAt` to now on every update is what keeps the
    // lock-screen timer honest: the system counts forward from this instant,
    // and `baseElapsedSeconds` carries the server's corrected total. Drift
    // accumulated between heartbeats is discarded rather than compounded.
    let state = StudyTimerAttributes.ContentState(
      startedAt: Date(),
      baseElapsedSeconds: elapsedSeconds,
      isRunning: isRunning,
      phaseRemainingSeconds: phaseRemaining,
      phaseTotalSeconds: phaseTotal,
      phaseLabel: phaseLabel
    )
    await activity.update(.init(state: state, staleDate: nil))
  }
  #endif
}
