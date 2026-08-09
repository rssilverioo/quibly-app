import Foundation

#if canImport(FamilyControls)
import FamilyControls
import ManagedSettings
import SwiftUI
import UIKit
#endif

/**
 Os apps que continuam liberados durante o foco.

 ## Por que a pessoa escolhe, e não nós

 Não é preferência de produto: é o que a API permite. Os tokens de app são
 **opacos por desenho** — não dá para listar o que está instalado, descobrir que
 app é cada token, nem escrever "libere o Spotify". A Apple entrega a escolha
 dentro de um seletor **do sistema**, e o que volta é cifrado. Nunca sabemos o
 que a pessoa marcou, e é assim que tem que ser.

 Acaba sendo melhor que qualquer lista nossa. Cada um ouve música num app
 diferente, e "app de música" é uma categoria que a gente adivinharia mal.

 ## Por que não fica em `EstadoDoFoco`

 Aquele arquivo é o contrato entre **três processos** e existe em três cópias
 byte a byte idênticas. A seleção só é lida pelo app, na hora de levantar o
 escudo — as extensões não têm o que fazer com ela. Somar coisa lá aumentaria a
 superfície do arquivo que mais custa caro quando diverge.

 ## Por que a escolha é da pessoa, e não da sessão

 Vale para todo foco, não para um pomodoro. Ninguém quer reescolher o app de
 música a cada bloco de 25 minutos, e uma exceção que muda a cada sessão seria
 uma decisão a mais num momento em que a pessoa quer começar a estudar.
 */
@available(iOS 16.0, *)
enum AppsLiberados {
  private static let chave = "foco.liberados"

  private static var defaults: UserDefaults? {
    UserDefaults(suiteName: EstadoDoFoco.grupo)
  }

  #if canImport(FamilyControls)
  /**
   O que está guardado. Seleção vazia quer dizer "bloqueie tudo".

   Falha na decodificação também vira vazia, e de propósito: uma seleção
   corrompida não pode virar "não bloqueie nada". Errar para o lado de bloquear
   custa um app inacessível por 25 minutos; para o outro, custa o recurso
   inteiro sem ninguém perceber.
   */
  static var selecao: FamilyActivitySelection {
    guard let dados = defaults?.data(forKey: chave),
          let selecao = try? JSONDecoder().decode(FamilyActivitySelection.self, from: dados)
    else { return FamilyActivitySelection() }
    return selecao
  }

  static func guardar(_ selecao: FamilyActivitySelection) {
    guard let dados = try? JSONEncoder().encode(selecao) else { return }
    defaults?.set(dados, forKey: chave)
  }

  /** Quantos apps a pessoa liberou. É só o que a interface pode dizer sobre eles. */
  static var quantidade: Int { selecao.applicationTokens.count }

  /**
   Abre o seletor do sistema.

   Um `UIHostingController` porque `FamilyActivityPicker` é SwiftUI e o app é
   React Native — não há hierarquia SwiftUI onde encaixá-lo. Apresentado a
   partir do controlador mais acima na pilha, e não do raiz: apresentar do raiz
   com uma folha já aberta na frente não faz nada, em silêncio.
   */
  static func apresentar(aoFechar: @escaping (Int) -> Void) {
    DispatchQueue.main.async {
      guard let janela = UIApplication.shared.connectedScenes
        .compactMap({ $0 as? UIWindowScene })
        .flatMap({ $0.windows })
        .first(where: { $0.isKeyWindow }),
        var topo = janela.rootViewController
      else { aoFechar(quantidade); return }

      while let apresentado = topo.presentedViewController { topo = apresentado }

      let tela = TelaDeSelecao(aoFechar: { quantos in
        topo.dismiss(animated: true) { aoFechar(quantos) }
      })
      topo.present(UIHostingController(rootView: tela), animated: true)
    }
  }
  #endif
}

#if canImport(FamilyControls)
/**
 A folha do seletor.

 O botão de fechar é nosso porque o `FamilyActivityPicker` não traz um: ele é só
 a lista. Sem a barra, a folha só sai arrastando para baixo — que funciona e não
 se anuncia.

 A seleção é gravada **a cada mudança**, não ao fechar. Arrastar a folha para
 baixo é o gesto que a maioria usa, e ele não passa por botão nenhum; guardar só
 no "Pronto" perderia a escolha de quem fecha assim.
 */
@available(iOS 16.0, *)
private struct TelaDeSelecao: View {
  let aoFechar: (Int) -> Void
  @State private var selecao = AppsLiberados.selecao

  var body: some View {
    NavigationStack {
      FamilyActivityPicker(selection: $selecao)
        .navigationTitle(Textos.titulo)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .confirmationAction) {
            Button(Textos.pronto) { aoFechar(selecao.applicationTokens.count) }
          }
        }
    }
    .onChange(of: selecao) { nova in AppsLiberados.guardar(nova) }
  }
}

/** A extensão não carrega o i18n do app; são duas frases e elas ficam aqui. */
@available(iOS 16.0, *)
private enum Textos {
  private static var emPortugues: Bool {
    Locale.preferredLanguages.first?.hasPrefix("pt") ?? false
  }
  static var titulo: String { emPortugues ? "Continua liberado" : "Stays allowed" }
  static var pronto: String { emPortugues ? "Pronto" : "Done" }
}
#endif
