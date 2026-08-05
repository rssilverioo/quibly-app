import SwiftUI

/**
 Castelo — o mascote do Quibly — desenhado em SwiftUI.

 ## Por que redesenhado, e não um PNG

 Uma Live Activity aparece em três tamanhos muito diferentes: ~44pt na tela de
 bloqueio, ~20pt na Dynamic Island compacta, e maior na expandida. Um bitmap
 exigiria três resoluções por paleta num asset catalog da extensão, e ainda
 assim ficaria mole na Ilha.

 Desenhado, escala sozinho, pesa quase nada e não adiciona nenhum recurso ao
 bundle da extensão — que tem orçamento de memória apertado (16MB).

 ## Fidelidade

 As coordenadas vêm da mesma grade 1024x1024 de
 `assets/mascot/castelo-focused-night.svg`, que é a fonte da verdade do
 mascote. O que foi deliberadamente omitido, e por quê:

 - **Linhas de tijolo** — some abaixo de ~60pt e vira sujeira cinza na Ilha.
 - **Braços, pernas e sombra** — o mascote aqui é retrato, não corpo inteiro;
   cortar na base do castelo dá mais presença ao rosto no espaço disponível.
 - **`feDropShadow`** — caro de rasterizar num widget e invisível no tamanho.

 O que foi mantido é o que identifica o personagem em 20pt: a silhueta de
 ameias, os olhos, a bandeira lima e o portão.
 */
struct CasteloMark: View {
  /**
   A escada de marcos. Espelha `SESSION_MILESTONES` de
   `packages/shared/src/session-milestones.ts`, que é a fonte da verdade — o
   Swift não consegue importar de lá, então esta cópia precisa ser mantida em
   sincronia à mão. Se as duas divergirem, o app e a tela de bloqueio mostram
   estados diferentes para o mesmo minuto.

   Densa no começo e esparsa depois, pela mesma razão explicada no arquivo TS:
   os primeiros 45 minutos são quando a pessoa ainda decide se continua.
   */
  enum Mood {
    /// 0–15min. Acabou de sentar.
    case focused
    /// 15–30min. Entrou no material.
    case reading
    /// 30–45min. Produzindo.
    case working
    /// 45–60min. Pegou o ritmo — ganha óculos escuros.
    case cool
    /// 60min+. Uma hora — ganha a chama.
    case streak
    /// 90min+. Ganha a estrela.
    case star
    /// 120min+. Ganha a medalha.
    case medal
    /// 180min+. Ganha a coroa.
    case crowned
    /// Pausada. Vence qualquer marco — quem está em intervalo parece em
    /// intervalo, não coroado.
    case resting

    /// Mesma tabela, mesma ordem decrescente que o TS.
    static func forMinutes(_ minutes: Int, isRunning: Bool) -> Mood {
      guard isRunning else { return .resting }
      switch minutes {
      case 180...: return .crowned
      case 120...: return .medal
      case 90...:  return .star
      case 60...:  return .streak
      case 45...:  return .cool
      case 30...:  return .working
      case 15...:  return .reading
      default:     return .focused
      }
    }

    /// Olhos fechados só no descanso; todo o resto olha para frente.
    var eyesOpen: Bool { self != .resting }

    /// O adereço que marca a faixa. `nil` nas três primeiras — o progresso
    /// inicial aparece na expressão, não em enfeite, senão o mascote vira
    /// árvore de natal antes da primeira hora.
    var badge: Badge? {
      switch self {
      case .cool:    return .shades
      case .streak:  return .flame
      case .star:    return .star
      case .medal:   return .medal
      case .crowned: return .crown
      default:       return nil
      }
    }
  }

  enum Badge { case shades, flame, star, medal, crown }

  var mood: Mood = .focused
  /// Fundo escuro (tela de bloqueio) ou claro. Só muda a bandeira e o brilho.
  var accent: Color = Color(red: 0.784, green: 1.0, blue: 0.302) // #C8FF4D

  var body: some View {
    GeometryReader { geo in
      // Tudo abaixo é expresso na grade 1024 do SVG e escalado de uma vez, para
      // que ajustar uma coordenada aqui signifique a mesma coisa que no arquivo
      // original.
      let s = min(geo.size.width, geo.size.height) / 1024

      ZStack(alignment: .topLeading) {
        flag(s)
        body(s)
        battlements(s)
        face(s)
        gate(s)
        badge(s)
      }
      .frame(width: geo.size.width, height: geo.size.height, alignment: .center)
    }
    .aspectRatio(1, contentMode: .fit)
  }

  // MARK: - peças

  private func flag(_ s: CGFloat) -> some View {
    ZStack(alignment: .topLeading) {
      // mastro
      RoundedRectangle(cornerRadius: 15 * s)
        .fill(Color(red: 0.36, green: 0.36, blue: 0.41))
        .frame(width: 30 * s, height: 168 * s)
        .offset(x: 497 * s, y: 113 * s)

      // galhardete — o único ponto de marca no desenho inteiro
      Path { p in
        p.move(to: CGPoint(x: 525 * s, y: 126 * s))
        p.addCurve(
          to: CGPoint(x: 709 * s, y: 153 * s),
          control1: CGPoint(x: 600 * s, y: 96 * s),
          control2: CGPoint(x: 660 * s, y: 120 * s)
        )
        p.addCurve(
          to: CGPoint(x: 525 * s, y: 177 * s),
          control1: CGPoint(x: 649 * s, y: 180 * s),
          control2: CGPoint(x: 601 * s, y: 194 * s)
        )
        p.closeSubpath()
      }
      .fill(accent)
    }
  }

  private func body(_ s: CGFloat) -> some View {
    RoundedRectangle(cornerRadius: 72 * s)
      .fill(
        LinearGradient(
          colors: [
            Color(red: 0.604, green: 0.420, blue: 0.278), // #9A6B47
            Color(red: 0.431, green: 0.278, blue: 0.184), // #6E472F
          ],
          startPoint: .top,
          endPoint: .bottom
        )
      )
      .frame(width: 464 * s, height: 430 * s)
      .offset(x: 280 * s, y: 300 * s)
  }

  /// As quatro torres e o parapeito. É a silhueta que faz o personagem ser
  /// reconhecível como castelo mesmo minúsculo — se algo tiver que sobreviver
  /// a uma redução, é isto.
  private func battlements(_ s: CGFloat) -> some View {
    let light = Color(red: 0.651, green: 0.459, blue: 0.310) // #A6754F
    let dark = Color(red: 0.604, green: 0.420, blue: 0.278)  // #9A6B47

    return ZStack(alignment: .topLeading) {
      tower(s, x: 260, y: 255, w: 110, h: 120, fill: dark)
      tower(s, x: 392, y: 235, w: 110, h: 140, fill: light)
      tower(s, x: 522, y: 235, w: 110, h: 140, fill: light)
      tower(s, x: 654, y: 255, w: 110, h: 120, fill: dark)
      tower(s, x: 335, y: 285, w: 354, h: 95, fill: light)
    }
  }

  private func tower(
    _ s: CGFloat, x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat, fill: Color
  ) -> some View {
    RoundedRectangle(cornerRadius: 26 * s)
      .fill(fill)
      .frame(width: w * s, height: h * s)
      .offset(x: x * s, y: y * s)
  }

  private func face(_ s: CGFloat) -> some View {
    let ink = Color(red: 0.125, green: 0.090, blue: 0.071) // #201712

    return ZStack(alignment: .topLeading) {
      if mood.eyesOpen {
        eye(s, cx: 431, ink: ink)
        eye(s, cx: 593, ink: ink)
      } else {
        // Pausado: olhos fechados, o mesmo traço do estado `break`.
        closedEye(s, cx: 431, ink: ink)
        closedEye(s, cx: 593, ink: ink)
      }

      // boca — reta e concentrada
      Capsule()
        .fill(ink)
        .frame(width: 92 * s, height: 18 * s)
        .offset(x: 466 * s, y: 543 * s)
    }
  }

  private func eye(_ s: CGFloat, cx: CGFloat, ink: Color) -> some View {
    ZStack(alignment: .topLeading) {
      Circle()
        .fill(ink)
        .frame(width: 68 * s, height: 68 * s)
        .offset(x: (cx - 34) * s, y: 436 * s)
      // brilho: o que faz o olho parecer vivo em vez de um furo preto
      Ellipse()
        .fill(Color.white.opacity(0.9))
        .frame(width: 20 * s, height: 28 * s)
        .offset(x: (cx + 1) * s, y: 440 * s)
    }
  }

  private func closedEye(_ s: CGFloat, cx: CGFloat, ink: Color) -> some View {
    Capsule()
      .fill(ink)
      .frame(width: 64 * s, height: 18 * s)
      .offset(x: (cx - 32) * s, y: 463 * s)
  }


  /**
   O adereço do marco. Um símbolo SF, não um desenho — em 20pt na Dynamic
   Island um desenho vira borrão, e o SF Symbol é otimizado exatamente para
   sobreviver a esse tamanho.

   Óculos escuros ficam sobre os olhos; os outros vão acima da torre central,
   onde não competem com o rosto.
   */
  @ViewBuilder
  private func badge(_ s: CGFloat) -> some View {
    if let badge = mood.badge {
      if badge == .shades {
        RoundedRectangle(cornerRadius: 14 * s)
          .fill(Color(red: 0.125, green: 0.090, blue: 0.071))
          .overlay(RoundedRectangle(cornerRadius: 14 * s).stroke(accent, lineWidth: 7 * s))
          .frame(width: 250 * s, height: 74 * s)
          .offset(x: 387 * s, y: 434 * s)
      } else {
        Image(systemName: symbolName(badge))
          .font(.system(size: 140 * s, weight: .semibold))
          .foregroundStyle(accent)
          .offset(x: 300 * s, y: 250 * s)
      }
    }
  }

  private func symbolName(_ badge: Badge) -> String {
    switch badge {
    case .flame:  return "flame.fill"
    case .star:   return "star.fill"
    case .medal:  return "medal.fill"
    case .crown:  return "crown.fill"
    case .shades: return "eyeglasses"
    }
  }

  private func gate(_ s: CGFloat) -> some View {
    ZStack(alignment: .topLeading) {
      Path { p in
        // arco do portão: sobe reto, arredonda no topo
        p.move(to: CGPoint(x: 430 * s, y: 730 * s))
        p.addLine(to: CGPoint(x: 430 * s, y: 630 * s))
        p.addQuadCurve(
          to: CGPoint(x: 512 * s, y: 565 * s),
          control: CGPoint(x: 430 * s, y: 565 * s)
        )
        p.addQuadCurve(
          to: CGPoint(x: 594 * s, y: 630 * s),
          control: CGPoint(x: 594 * s, y: 565 * s)
        )
        p.addLine(to: CGPoint(x: 594 * s, y: 730 * s))
        p.closeSubpath()
      }
      .fill(
        LinearGradient(
          colors: [
            Color(red: 0.318, green: 0.208, blue: 0.137), // #513523
            Color(red: 0.184, green: 0.122, blue: 0.090), // #2F1F17
          ],
          startPoint: .top,
          endPoint: .bottom
        )
      )

      // maçaneta lima — o segundo e último toque de marca
      Circle()
        .fill(accent)
        .frame(width: 24 * s, height: 24 * s)
        .offset(x: 540 * s, y: 643 * s)
    }
  }
}
