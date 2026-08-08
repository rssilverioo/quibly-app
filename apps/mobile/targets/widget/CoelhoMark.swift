import SwiftUI

/**
 O coelho — o mascote do Quibly — desenhado em SwiftUI.

 ## Por que desenhado, e não um PNG

 Uma Live Activity aparece em três tamanhos muito diferentes: ~44pt na tela de
 bloqueio, ~20pt na Dynamic Island compacta, e maior na expandida. Um bitmap
 exigiria três resoluções por paleta num asset catalog da extensão, e ainda
 assim ficaria mole na Ilha.

 Desenhado, escala sozinho, pesa quase nada e não adiciona nenhum recurso ao
 bundle da extensão — que tem orçamento de memória apertado (16MB).

 ## O que sobrou do castelo

 Este arquivo era `CasteloMark`. A escada de marcos, os adereços e a API são os
 mesmos byte por byte — quem chama daqui de fora não sabe que o desenho mudou.
 O que trocou foi só a figura, e a razão é que o castelo deixou de ser o
 mascote do produto.

 ## Fidelidade

 As coordenadas vêm da mesma grade 1024x1024 de `components/mascot/Mascot.tsx`,
 que é a fonte da verdade do mascote — olhos em y=470, boca em y≈543. Tudo aqui
 desce `DY` porque o widget mostra **retrato**, não corpo inteiro: sem tronco
 nem pés, o desenho ficaria encostado no topo do quadro.

 O que foi deliberadamente omitido, e por quê:

 - **Tronco, braços e pés** — o mascote aqui é retrato; cortar abaixo da cabeça
   dá mais presença ao rosto no espaço disponível.
 - **Sombra** — cara de rasterizar num widget e invisível no tamanho.

 O que foi mantido é o que identifica o personagem em 20pt: as orelhas, o
 contorno azul, os olhos e o focinho.
 */
struct CoelhoMark: View {
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
  /// Cor dos adereços de marco. Azul da marca, não mais o lima do castelo.
  var accent: Color = Color(red: 0.298, green: 0.604, blue: 1.0) // #4C9AFF

  /// Quanto a figura inteira desce na grade. Ver a nota sobre retrato.
  private let dy: CGFloat = 120

  private let pelo = Color.white
  private let contorno = Color(red: 0.071, green: 0.243, blue: 0.549)  // #123E8C
  private let orelhaInterna = Color(red: 0.733, green: 0.835, blue: 1.0) // #BBD5FF

  var body: some View {
    GeometryReader { geo in
      // Tudo abaixo é expresso na grade 1024 e escalado de uma vez, para que
      // ajustar uma coordenada aqui signifique a mesma coisa que no TSX.
      let s = min(geo.size.width, geo.size.height) / 1024

      ZStack(alignment: .topLeading) {
        orelhas(s)
        cabeca(s)
        rosto(s)
        badge(s)
      }
      .frame(width: geo.size.width, height: geo.size.height, alignment: .center)
    }
    .aspectRatio(1, contentMode: .fit)
  }

  // MARK: - peças

  /**
   As orelhas. É a silhueta que faz o personagem ser reconhecível mesmo
   minúsculo — se algo tiver que sobreviver a uma redução, é isto.

   Cápsulas rotacionadas em vez das curvas do SVG: em 20pt a diferença entre
   uma curva suave e uma reta inclinada não existe, e a cápsula não precisa de
   um `Path` por camada.
   */
  private func orelhas(_ s: CGFloat) -> some View {
    ZStack(alignment: .topLeading) {
      orelha(s, cx: 434, giro: -12)
      orelha(s, cx: 590, giro: 12)
    }
  }

  private func orelha(_ s: CGFloat, cx: CGFloat, giro: Double) -> some View {
    ZStack(alignment: .topLeading) {
      Capsule()
        .fill(contorno)
        .frame(width: 116 * s, height: 252 * s)
        .rotationEffect(.degrees(giro))
        .offset(x: (cx - 58) * s, y: (78 + dy) * s)
      Capsule()
        .fill(pelo)
        .frame(width: 94 * s, height: 230 * s)
        .rotationEffect(.degrees(giro))
        .offset(x: (cx - 47) * s, y: (89 + dy) * s)
      Capsule()
        .fill(orelhaInterna)
        .frame(width: 40 * s, height: 150 * s)
        .rotationEffect(.degrees(giro))
        .offset(x: (cx - 20) * s, y: (105 + dy) * s)
    }
  }

  private func cabeca(_ s: CGFloat) -> some View {
    Ellipse()
      .fill(pelo)
      .overlay(Ellipse().stroke(contorno, lineWidth: 22 * s))
      .frame(width: 480 * s, height: 452 * s)
      .offset(x: 272 * s, y: (244 + dy) * s)
  }

  private func rosto(_ s: CGFloat) -> some View {
    ZStack(alignment: .topLeading) {
      if mood.eyesOpen {
        olho(s, cx: 431)
        olho(s, cx: 593)
      } else {
        // Pausado: olhos fechados, o mesmo traço do estado `break`.
        olhoFechado(s, cx: 431)
        olhoFechado(s, cx: 593)
      }

      // focinho — ocupa a folga entre os olhos, que é o vão mais apertado
      Path { p in
        p.move(to: CGPoint(x: 494 * s, y: (498 + dy) * s))
        p.addLine(to: CGPoint(x: 530 * s, y: (498 + dy) * s))
        p.addLine(to: CGPoint(x: 512 * s, y: (526 + dy) * s))
        p.closeSubpath()
      }
      .fill(contorno)

      // boca — reta e concentrada
      Capsule()
        .fill(contorno)
        .frame(width: 92 * s, height: 18 * s)
        .offset(x: 466 * s, y: (543 + dy) * s)
    }
  }

  private func olho(_ s: CGFloat, cx: CGFloat) -> some View {
    ZStack(alignment: .topLeading) {
      Circle()
        .fill(contorno)
        .frame(width: 68 * s, height: 68 * s)
        .offset(x: (cx - 34) * s, y: (436 + dy) * s)
      // brilho: o que faz o olho parecer vivo em vez de um furo azul
      Ellipse()
        .fill(Color.white.opacity(0.9))
        .frame(width: 20 * s, height: 28 * s)
        .offset(x: (cx + 1) * s, y: (440 + dy) * s)
    }
  }

  private func olhoFechado(_ s: CGFloat, cx: CGFloat) -> some View {
    Capsule()
      .fill(contorno)
      .frame(width: 64 * s, height: 18 * s)
      .offset(x: (cx - 32) * s, y: (463 + dy) * s)
  }

  /**
   O adereço do marco. Um símbolo SF, não um desenho — em 20pt na Dynamic
   Island um desenho vira borrão, e o SF Symbol é otimizado exatamente para
   sobreviver a esse tamanho.

   Óculos escuros ficam sobre os olhos; os outros vão à direita das orelhas,
   onde não competem com o rosto nem com a silhueta que identifica o bicho.
   */
  @ViewBuilder
  private func badge(_ s: CGFloat) -> some View {
    if let badge = mood.badge {
      if badge == .shades {
        RoundedRectangle(cornerRadius: 14 * s)
          .fill(contorno)
          .overlay(RoundedRectangle(cornerRadius: 14 * s).stroke(accent, lineWidth: 7 * s))
          .frame(width: 250 * s, height: 74 * s)
          .offset(x: 387 * s, y: (434 + dy) * s)
      } else {
        Image(systemName: symbolName(badge))
          .font(.system(size: 130 * s, weight: .semibold))
          .foregroundStyle(accent)
          .offset(x: 700 * s, y: (200 + dy) * s)
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
}
