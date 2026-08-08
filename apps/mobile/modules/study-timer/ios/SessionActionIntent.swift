import AppIntents
import Foundation

/**
 O grupo compartilhado entre o app e a extensão.

 É o único canal pelo qual os dois processos trocam dados: a extensão não tem
 acesso ao `UserDefaults.standard` do app, nem ao chaveiro dele.
 */
enum GrupoCompartilhado {
  static let id = "group.com.quibly.app"

  static let chaveSessao = "quibly.session.id"
  static let chaveToken = "quibly.session.actionToken"
  static let chaveApiUrl = "quibly.api.baseUrl"

  /**
   Onde ler o contexto da sessão — e por que a tentativa anterior não bastou.

   `LiveActivityIntent` roda no **processo do app**, então o `UserDefaults`
   padrão daqui é o do próprio app: o mesmo que `StudyTimerModule` escreveu. O
   App Group foi acrescentado quando eu ainda achava que o intent rodava na
   extensão; a premissa caiu e a dependência ficou.

   E ela custou caro: `application-groups` **não estava em nenhum dos dois
   perfis de provisionamento** do build 44 — o App Group precisa ser registrado
   no portal da Apple e o perfil regerado, e declarar a entitlement no config
   não faz isso.

   ## O erro da correção do build 45

   Ela era `UserDefaults(suiteName: id) ?? .standard`, apostando que um grupo
   sem entitlement devolvia `nil`. **Não devolve.** `UserDefaults(suiteName:)`
   só é `nil` quando o nome é inválido — como o próprio bundle id. Para um
   grupo que existe no papel mas ao qual o processo não tem direito, ele
   devolve um objeto perfeitamente válido, apoiado num contêiner que não é o
   compartilhado.

   Ou seja: o `??` nunca disparava. O intent lia um suite vazio, com o
   `.standard` cheio ao lado, e continuava morrendo na segunda guarda — com um
   log dizendo "sem sessão", que é verdade sobre o lugar errado.

   A correção certa não é escolher o armazém, é procurar a chave nos dois. O
   grupo vem primeiro porque, quando for provisionado de fato, ele serve também
   às partes que rodam mesmo dentro da extensão.
   */
  static func valor(_ chave: String) -> String? {
    if let doGrupo = UserDefaults(suiteName: id)?.string(forKey: chave) {
      return doGrupo
    }
    return UserDefaults.standard.string(forKey: chave)
  }
}

/**
 Pausar, retomar e encerrar direto da Live Activity, **sem abrir o app**.

 ## Por que o Swift fala com a API

 Uma Widget Extension não tem runtime de JavaScript. Com o app fechado não há
 store, não há React Native, não há nada em TypeScript para chamar — se o botão
 tem que agir, quem age é este arquivo.

 O que atravessa para cá é o mínimo: três chamadas HTTP. Nenhuma regra de
 negócio, nenhuma decisão sobre a sessão, nenhuma matemática de tempo. O
 servidor continua sendo o dono de tudo isso, e é ele quem recusa uma ação
 impossível.

 ## Por que não o token do Firebase

 Ele autoriza a conta inteira e expira em uma hora; renová-lo exigiria pôr o
 refresh token — que não expira — dentro da extensão. O token daqui autoriza
 três verbos numa única sessão e morre com ela (ver `session-action-token.ts`
 na API). Se vazar, o estrago é alguém pausar um estudo alheio.

 ## Por que este arquivo existe duas vezes

 `LiveActivityIntent` **roda no processo do app**, não no da extensão — é o que a
 Apple documenta e o que faz a ação valer sem trazer o app para a frente.

 A primeira versão vivia só em `targets/widget/`, e o botão chamava um intent que
 o app não conhecia. Nada acontecia, e como o `perform()` falha em silêncio de
 propósito, não sobrava sintoma: o dedo tocava, a Live Activity não mudava, e não
 havia log nem erro.

 Então a extensão precisa do tipo para **declarar** o botão, e o app precisa dele
 para **executar**. Mesmo arranjo de `StudyTimerAttributes`: duas cópias que o
 sistema casa pelo nome do tipo, com um teste garantindo que não divirjam.

 ## O que acontece quando falha

 Nada visível, de propósito. O `perform()` não tem tela onde reclamar, e a
 Live Activity vai ser atualizada pelo app no próximo heartbeat de qualquer
 forma. Falhar em silêncio aqui é preferível a inventar um estado que o
 servidor não confirmou.
 */
@available(iOS 17.0, *)
struct SessionActionIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Controlar sessão de estudo"
  /// Nunca traz o app para a frente: o ponto do intent é não interromper.
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Ação")
  var acao: String

  init() { self.acao = "pause" }
  init(acao: String) { self.acao = acao }

  func perform() async throws -> some IntentResult {
    /*
     Cada guarda diz **qual** delas falhou.

     A primeira versão era um `guard` mudo, e quando o botão não funcionou não
     havia como saber se faltava App Group, token, sessão ou URL — quatro causas
     indistinguíveis, num processo sem tela. `NSLog` aparece em
     `xcrun simctl spawn booted log stream` e no console do Xcode com o aparelho
     conectado, que é o único lugar onde isto se depura.
     */
    guard let sessionId = GrupoCompartilhado.valor(GrupoCompartilhado.chaveSessao) else {
      NSLog("[Quibly] Sem sessão gravada. A sessão começou num build antigo?")
      return .result()
    }
    guard let token = GrupoCompartilhado.valor(GrupoCompartilhado.chaveToken) else {
      NSLog("[Quibly] Sem token. Confira `sessionActionsConfigured` em /health.")
      return .result()
    }
    guard
      let base = GrupoCompartilhado.valor(GrupoCompartilhado.chaveApiUrl),
      let url = URL(string: "\(base)/sessions/\(sessionId)/live/\(acao)")
    else {
      NSLog("[Quibly] URL da API inválida.")
      return .result()
    }

    var pedido = URLRequest(url: url)
    pedido.httpMethod = "POST"
    // Esquema próprio, e não `Bearer`: o token do Firebase e este não são
    // intercambiáveis, e a API recusa o esquema errado de propósito.
    pedido.setValue("SessionAction \(token)", forHTTPHeaderField: "Authorization")
    pedido.setValue("application/json", forHTTPHeaderField: "Content-Type")
    // Curto: o sistema dá pouco tempo a um intent, e uma sessão pendurada
    // esperando rede seria pior que a ação não acontecer.
    pedido.timeoutInterval = 8

    do {
      let (_, resposta) = try await URLSession.shared.data(for: pedido)
      let codigo = (resposta as? HTTPURLResponse)?.statusCode ?? 0
      if !(200..<300).contains(codigo) {
        NSLog("[Quibly] \(acao) recusado pela API: HTTP \(codigo)")
      }
    } catch {
      NSLog("[Quibly] \(acao) falhou: \(error.localizedDescription)")
    }
    return .result()
  }
}
