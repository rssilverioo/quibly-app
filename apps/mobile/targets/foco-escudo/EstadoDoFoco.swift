import Foundation
import ManagedSettings

/**
 O contrato entre o app e as extensões do escudo.

 São **três processos diferentes** — o app, o `DeviceActivityMonitor` e a tela do
 escudo — e nenhum enxerga a memória do outro. Tudo que os três precisam saber
 mora aqui: o nome da loja de ajustes, as chaves do App Group e o relógio.

 Duplicar qualquer um desses literais nos outros arquivos é como o bug fica: o
 monitor levantaria uma loja e o app baixaria outra, e o telefone ficaria
 bloqueado sem que nenhum código pareça errado.
 */
enum EstadoDoFoco {
  /**
   A loja de ajustes do Quibly, com nome próprio.

   Nomeada e não `ManagedSettingsStore()` sem argumento: a loja padrão é
   compartilhada com qualquer outra coisa que o app venha a fazer com
   ManagedSettings, e `clearAllSettings()` nela apagaria ajustes que não são
   nossos. Com nome, o que a gente levanta é só o que a gente derruba.
   */
  static let loja = ManagedSettingsStore.Name("com.quibly.foco")

  /** O único canal entre o app e as extensões. Já existe para a Live Activity. */
  static let grupo = "group.com.quibly.app"

  /** Nome da janela vigiada pelo `DeviceActivityMonitor`. */
  static let atividade = "com.quibly.foco.sessao"

  private static let chaveLimite = "foco.expiraEm"
  private static let chaveInicio = "foco.comecouEm"

  /**
   O teto absoluto de uma sessão de foco.

   Existe para o caso em que **todo** o resto falhou. Nenhuma sessão de estudo
   legítima passa disso, e um bug que passe encontra aqui um fim.

   Quatro horas e não vinte e quatro: o custo de errar para baixo é a pessoa ter
   que reativar o foco; para cima, é um telefone bloqueado por um dia.
   */
  static let tetoDeSeguranca: TimeInterval = 4 * 60 * 60

  private static var defaults: UserDefaults? { UserDefaults(suiteName: grupo) }

  /**
   Grava até quando o escudo tem direito de existir.

   O instante fica gravado **antes** de o escudo subir. Se o processo morrer
   entre uma coisa e outra, o pior caso é um limite gravado sem escudo nenhum —
   inofensivo. Na ordem inversa, o pior caso é escudo sem limite, que é o
   estado de que não se sai.
   */
  static func marcarInicio(expiraEm: Date) {
    let limite = min(expiraEm, Date().addingTimeInterval(tetoDeSeguranca))
    defaults?.set(limite.timeIntervalSince1970, forKey: chaveLimite)
    defaults?.set(Date().timeIntervalSince1970, forKey: chaveInicio)
  }

  static func limparMarca() {
    defaults?.removeObject(forKey: chaveLimite)
    defaults?.removeObject(forKey: chaveInicio)
  }

  /** Até quando o escudo vale. `nil` quer dizer que ninguém o autorizou. */
  static var expiraEm: Date? {
    guard let bruto = defaults?.object(forKey: chaveLimite) as? TimeInterval else { return nil }
    return Date(timeIntervalSince1970: bruto)
  }

  /**
   Se o escudo perdeu a validade.

   **Sem marca alguma conta como vencido**, e é de propósito: um escudo que
   ninguém sabe explicar não é um escudo, é um defeito. Reinstalar o app, apagar
   os dados ou perder o App Group cai aqui — e o resultado tem que ser telefone
   liberado, nunca telefone preso.
   */
  static var venceu: Bool {
    guard let limite = expiraEm else { return true }
    return Date() >= limite
  }

  /**
   Derruba o escudo e apaga a marca.

   É a única função que baixa o escudo, e as três origens — fim normal pelo app,
   `intervalDidEnd` do monitor e a reconciliação na abertura — chamam esta
   mesma. Idempotente de propósito: chamar duas vezes não é erro, e um caminho
   de saída que só funciona uma vez não é caminho de saída.
   */
  static func liberar() {
    let store = ManagedSettingsStore(named: loja)
    store.clearAllSettings()
    limparMarca()
  }
}
