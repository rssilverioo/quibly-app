import Foundation
import ManagedSettings
import ManagedSettingsUI
import UIKit

/**
 A tela do bloqueio.

 ## O que ela precisa dizer, e por quê

 O texto padrão do sistema é *"Você não pode usar este app porque ele está
 restrito"*. Quem lê isso no meio do dia não liga o bloqueio à escolha que fez
 quinze minutos antes dentro do Quibly — a leitura natural é que o telefone
 quebrou, e o passo seguinte é procurar como desinstalar alguma coisa.

 Então a tela responde três perguntas, nesta ordem: **quem** bloqueou, **por
 quê**, e **quanto falta**. Sem a terceira, o bloqueio parece indefinido, e
 bloqueio sem prazo visível é o que faz a pessoa desligar tudo em vez de esperar.

 ## Por que não há botão de desbloquear aqui

 Os botões desta tela são os que a Apple oferece, e a ação deles vive noutra
 extensão. A saída fica no Quibly, que **nunca** é bloqueado: é lá que a pessoa
 vê o cronômetro e desiste se quiser. Uma saída de um toque na própria tela do
 escudo tornaria o escudo decorativo.

 Isso é atrito, não cadeia — e a diferença importa: quem realmente quiser sair
 desliga nos Ajustes, e está certo que consiga.
 */
/*
 O **nome desta classe não é nosso**: ele está escrito no `Info.plist` do alvo,
 em `NSExtensionPrincipalClass`, e é por ele que o sistema instancia a extensão.

 Divergir não quebra o build. A extensão é assinada, embarcada e carregada — e
 nunca instanciada, porque a classe que o plist pede não existe. Para o foco
 profundo isso significa que o escudo **nunca cai pelo relógio do sistema**: a
 garantia (2) some sem deixar rastro. Um teste guarda os dois lados.
*/

class ShieldConfigurationExtension: ShieldConfigurationDataSource {
  private func configuracao() -> ShieldConfiguration {
    let restante = EstadoDoFoco.expiraEm?.timeIntervalSinceNow ?? 0
    let minutos = max(0, Int(ceil(restante / 60)))

    let subtitulo: String
    if minutos <= 0 {
      // A marca venceu mas a tela ainda apareceu: o escudo está caindo. Dizer
      // "0 minutos" soaria como defeito; dizer que já acabou é o que é.
      subtitulo = Textos.acabou
    } else if minutos == 1 {
      subtitulo = Textos.faltaUmMinuto
    } else {
      subtitulo = String(format: Textos.faltamMinutos, minutos)
    }

    return ShieldConfiguration(
      backgroundBlurStyle: .systemMaterial,
      backgroundColor: UIColor(red: 0.004, green: 0.373, blue: 0.992, alpha: 1),
      icon: UIImage(named: "CoelhoEscudo"),
      title: .init(text: Textos.titulo, color: .white),
      subtitle: .init(text: subtitulo, color: UIColor.white.withAlphaComponent(0.85)),
      primaryButtonLabel: .init(text: Textos.voltar, color: UIColor(red: 0.004, green: 0.373, blue: 0.992, alpha: 1)),
      primaryButtonBackgroundColor: .white
    )
  }

  override func configuration(shielding application: Application) -> ShieldConfiguration {
    configuracao()
  }

  override func configuration(
    shielding application: Application,
    in category: ActivityCategory
  ) -> ShieldConfiguration {
    configuracao()
  }

  override func configuration(shielding webDomain: WebDomain) -> ShieldConfiguration {
    configuracao()
  }

  override func configuration(
    shielding webDomain: WebDomain,
    in category: ActivityCategory
  ) -> ShieldConfiguration {
    configuracao()
  }
}

/**
 Os textos, em português e inglês.

 Uma extensão não carrega o i18n do React Native, então a tradução acontece
 aqui, na língua do **aparelho**. É pouco texto e não vai crescer: se crescer, o
 lugar certo passa a ser um `.strings` compartilhado pelo App Group.
 */
private enum Textos {
  private static var emPortugues: Bool {
    Locale.preferredLanguages.first?.hasPrefix("pt") ?? false
  }

  static var titulo: String {
    emPortugues ? "Você está estudando" : "You're studying"
  }
  static var acabou: String {
    emPortugues ? "A sessão acabou. Já pode voltar." : "The session is over. You're free to go."
  }
  static var faltaUmMinuto: String {
    emPortugues ? "Falta 1 minuto no Quibly." : "1 minute left on Quibly."
  }
  static var faltamMinutos: String {
    emPortugues ? "Faltam %d minutos no Quibly." : "%d minutes left on Quibly."
  }
  static var voltar: String {
    emPortugues ? "Voltar ao foco" : "Back to focus"
  }
}
