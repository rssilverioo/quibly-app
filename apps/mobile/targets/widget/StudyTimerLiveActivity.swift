import SwiftUI
import WidgetKit

#if canImport(ActivityKit)
import ActivityKit

/**
 A Live Activity da sessão de estudo — tela de bloqueio e Dynamic Island.

 ## O detalhe que faz isso funcionar

 O tempo é sempre `Text(timerInterval:)`, nunca uma string que a gente formata.

 Isso não é preferência de estilo: é a única forma de o cronômetro andar. O
 processo do app está suspenso ou morto enquanto isso aparece na tela — não há
 ninguém para atualizar um texto a cada segundo. `timerInterval` entrega a
 contagem ao sistema, que a avança a partir de uma referência fixa sem custo
 nenhum para nós.

 O intervalo é ancorado em `startedAt - baseElapsedSeconds`, ou seja: o instante
 em que a sessão *teria* começado se tivesse corrido sem parar até agora. Cada
 heartbeat reancora esse ponto com o total corrigido do servidor, então a
 deriva entre batimentos é descartada em vez de acumulada.

 ## Botões

 São `Link` com deep link `quibly://`, não App Intents. App Intents agiriam no
 lugar, sem abrir o app, mas exigem iOS 17+ e — como o app pode estar morto — a
 ação teria que falar com a API direto do Swift, duplicando a lógica de sessão
 numa segunda linguagem. Deep link abre o app e reaproveita exatamente o mesmo
 caminho do store que os controles em tela. Vale a troca até haver device para
 validar a versão mais sofisticada.
 */
@available(iOS 16.1, *)
struct StudyTimerLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: StudyTimerAttributes.self) { context in
      LockScreenView(context: context)
        .activityBackgroundTint(Color.black.opacity(0.55))
        .activitySystemActionForegroundColor(Color.quiblyLime)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          CasteloMark(mood: .forMinutes(context.state.totalMinutes, isRunning: context.state.isRunning))
            .frame(width: 46, height: 46)
            .padding(.leading, 4)
        }

        DynamicIslandExpandedRegion(.trailing) {
          TimerText(state: context.state)
            .font(.system(size: 30, weight: .semibold, design: .rounded))
            .monospacedDigit()
            .foregroundStyle(.white)
            .padding(.trailing, 4)
        }

        DynamicIslandExpandedRegion(.center) {
          Text(context.attributes.subjectName)
            .font(.system(size: 13, weight: .medium))
            .foregroundStyle(.white.opacity(0.65))
            .lineLimit(1)
        }

        DynamicIslandExpandedRegion(.bottom) {
          ActionRow(isRunning: context.state.isRunning)
        }
      } compactLeading: {
        // ~20pt. Sobra a silhueta e a bandeira — e é o suficiente.
        CasteloMark(mood: .forMinutes(context.state.totalMinutes, isRunning: context.state.isRunning))
          .frame(width: 22, height: 22)
      } compactTrailing: {
        /*
         Nada de `minWidth` aqui.

         Havia um `.frame(minWidth: 52)` para o contador não truncar depois de
         uma hora. O efeito colateral era o defeito relatado: a área compacta da
         Dynamic Island **cresce para caber o que se pede**, então 52pt fixos de
         um lado, mais o castelo do outro, esticavam a ilha numa faixa preta
         muito mais larga que a área nativa.

         O `minWidth` resolvia o sintoma errado. Quem decide a largura da ilha é
         o sistema; o nosso trabalho é caber nela. A fonte menor e o
         `lineLimit(1)` dão ao contador a chance de caber por mérito — e se uma
         sessão de três dígitos de hora truncar, ainda é melhor que uma faixa
         atravessando a tela inteira.
         */
        TimerText(state: context.state)
          .font(.system(size: 13, weight: .semibold, design: .rounded))
          .monospacedDigit()
          .lineLimit(1)
          .foregroundStyle(Color.quiblyLime)
      } minimal: {
        CasteloMark(mood: .forMinutes(context.state.totalMinutes, isRunning: context.state.isRunning))
          .frame(width: 20, height: 20)
      }
      .keylineTint(Color.quiblyLime)
    }
  }
}

// MARK: - tela de bloqueio

@available(iOS 16.1, *)
private struct LockScreenView: View {
  let context: ActivityViewContext<StudyTimerAttributes>

  var body: some View {
    /*
     Três blocos, e uma hierarquia só: o que estou estudando, há quanto tempo,
     e o que posso fazer a respeito.

     O nome da matéria virou **sobrancelha** — caixa alta, pequena, com tracking
     — em vez de um texto de 13pt logo acima do cronômetro. Dois textos
     empilhados de pesos parecidos competiam, e o olho não sabia qual dos dois
     era o assunto e qual era o dado. Em caixa alta ele deixa de competir e
     passa a rotular, que é o papel dele.

     O mascote fica em 44pt e não em 52: ele é a assinatura da marca no card, não
     o protagonista. Quem manda no espaço é o cronômetro.
     */
    HStack(spacing: 12) {
      CasteloMark(mood: .forMinutes(context.state.totalMinutes, isRunning: context.state.isRunning))
        .frame(width: 44, height: 44)

      VStack(alignment: .leading, spacing: 3) {
        Text(context.attributes.subjectName.isEmpty
             ? "ESTUDANDO"
             : context.attributes.subjectName.uppercased())
          .font(.system(size: 11, weight: .semibold))
          .tracking(0.8)
          .foregroundStyle(.white.opacity(0.55))
          .lineLimit(1)

        TimerText(state: context.state)
          .font(.system(size: 38, weight: .semibold, design: .rounded))
          .monospacedDigit()
          // A 38pt, uma sessão que passa de 10 horas ganha dígito e empurraria
          // os controles para fora. Encolher a fonte é melhor que truncar o
          // tempo ou espremer os botões.
          .lineLimit(1)
          .minimumScaleFactor(0.8)
          .foregroundStyle(.white)
      }

      Spacer(minLength: 12)

      VStack(spacing: 8) {
        LinkButton(
          systemName: context.state.isRunning ? "pause.fill" : "play.fill",
          url: context.state.isRunning ? "quibly://session/pause" : "quibly://session/resume"
        )
        LinkButton(systemName: "stop.fill", url: "quibly://session/end", tint: .red)
      }
    }
    .padding(.horizontal, 16)
    .padding(.vertical, 12)
  }
}

// MARK: - peças

/**
 O cronômetro. Um `Text(timerInterval:)` quando corre, um valor congelado
 quando pausado — porque `timerInterval` não sabe parar, e mostrar um número
 subindo com a sessão pausada seria mentira.
 */
@available(iOS 16.1, *)
private struct TimerText: View {
  let state: StudyTimerAttributes.ContentState

  var body: some View {
    if state.isRunning {
      // A âncora: onde a sessão teria começado se tivesse corrido direto.
      let anchor = state.startedAt.addingTimeInterval(-Double(state.baseElapsedSeconds))
      Text(timerInterval: anchor...Date.distantFuture, countsDown: false)
    } else {
      Text(Self.format(state.baseElapsedSeconds))
    }
  }

  private static func format(_ seconds: Int) -> String {
    let h = seconds / 3600, m = (seconds % 3600) / 60, s = seconds % 60
    return h > 0
      ? String(format: "%d:%02d:%02d", h, m, s)
      : String(format: "%02d:%02d", m, s)
  }
}

@available(iOS 16.1, *)
private struct LinkButton: View {
  let systemName: String
  let url: String
  var tint: Color = .quiblyLime

  var body: some View {
    Link(destination: URL(string: url)!) {
      Image(systemName: systemName)
        .font(.system(size: 14, weight: .bold))
        .foregroundStyle(tint)
        // 40×30 e não 34×26: são os dois controles reais do card, e na tela
        // bloqueada o dedo chega sem mira. O ganho de área não custa altura,
        // porque quem define a altura do card é o cronômetro ao lado.
        .frame(width: 40, height: 30)
        .background(tint.opacity(0.16), in: RoundedRectangle(cornerRadius: 9))
    }
  }
}

@available(iOS 16.1, *)
private struct ActionRow: View {
  let isRunning: Bool

  var body: some View {
    HStack(spacing: 10) {
      Link(destination: URL(string: isRunning ? "quibly://session/pause" : "quibly://session/resume")!) {
        Label(isRunning ? "Pausar" : "Retomar", systemImage: isRunning ? "pause.fill" : "play.fill")
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(.black)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 9)
          .background(Color.quiblyLime, in: Capsule())
      }

      Link(destination: URL(string: "quibly://session/end")!) {
        Label("Encerrar", systemImage: "stop.fill")
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(.white)
          .frame(maxWidth: .infinity)
          .padding(.vertical, 9)
          .background(Color.white.opacity(0.14), in: Capsule())
      }
    }
    .padding(.top, 4)
  }
}

extension Color {
  /// `BRAND_LIME` de `theme/colors.ts` — a mesma cor no app e fora dele.
  static let quiblyLime = Color(red: 0.784, green: 1.0, blue: 0.302)
}

// MARK: - bundle da extensão

@main
struct QuiblyWidgetBundle: WidgetBundle {
  var body: some Widget {
    if #available(iOS 16.1, *) {
      StudyTimerLiveActivity()
    }
  }
}
#endif
