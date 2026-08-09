import DeviceActivity
import Foundation

/**
 Acorda no fim da janela agendada e derruba o escudo.

 É a garantia (2) das quatro descritas em `FocoProfundoModule.swift`: a única
 que continua valendo com o app encerrado, porque roda em processo próprio, que
 o iOS acorda sozinho.

 ## Por que ele derruba em quase tudo que recebe

 `intervalDidEnd` é o caminho normal. Os outros também derrubam, e não é
 desleixo: **não existe evento cujo tratamento correto seja deixar o escudo de
 pé sem saber por quê**. Errar para o lado de liberar custa uma sessão de foco
 encurtada; errar para o outro custa um telefone bloqueado sem prazo.

 ## Por que ele confere o relógio antes

 `intervalDidStart` chega no começo da janela, quando o escudo **deve** ficar.
 Por isso a decisão não é "qual evento chegou" e sim "a marca ainda vale" —
 `EstadoDoFoco.venceu` responde isso, e responde `true` também quando não há
 marca nenhuma, que é o estado de um escudo órfão.
 */
class FocoMonitor: DeviceActivityMonitor {
  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    EstadoDoFoco.liberar()
  }

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    // O começo da janela é justamente quando o escudo deve existir. Só age se a
    // marca já não valer — caso de janela reaproveitada por um agendamento
    // antigo que ninguém cancelou.
    if EstadoDoFoco.venceu { EstadoDoFoco.liberar() }
  }

  override func eventDidReachThreshold(
    _ event: DeviceActivityEvent.Name,
    activity: DeviceActivityName
  ) {
    super.eventDidReachThreshold(event, activity: activity)
    if EstadoDoFoco.venceu { EstadoDoFoco.liberar() }
  }

  /**
   O aviso de que a janela vai acabar.

   O sistema manda isto **antes** do fim, então aqui a marca ainda vale e nada
   deve acontecer — a não ser que ela já tenha vencido, que é sinal de que o
   `intervalDidEnd` não veio.
   */
  override func intervalWillEndWarning(for activity: DeviceActivityName) {
    super.intervalWillEndWarning(for: activity)
    if EstadoDoFoco.venceu { EstadoDoFoco.liberar() }
  }
}
