import ExpoModulesCore

#if canImport(FamilyControls)
import DeviceActivity
import FamilyControls
import ManagedSettings
#endif

/**
 O foco profundo: enquanto a sessão corre, os outros apps ficam bloqueados.

 ## O que a Apple deixa e não deixa fazer

 Os tokens de app são **opacos por desenho**. Não dá para listar o que está
 instalado, nem descobrir que app é cada token, nem escrever "bloqueie o
 Instagram". O que dá é o inverso: bloquear **tudo** e abrir exceções que a
 própria pessoa escolheu num seletor do sistema, cujo resultado nós nunca vemos.

 Isso é bom para nós. O pedido do dono do produto é "bloquear todos os apps", e
 essa é exatamente a forma que a API tem.

 ## O escudo não pode sobreviver à sessão

 É o requisito que organiza este arquivo inteiro. Um escudo esquecido não é um
 bug de conforto: é o telefone da pessoa inutilizado até ela descobrir sozinha
 que precisa ir aos Ajustes ou apagar o Quibly.

 Nenhuma garantia sozinha basta, então são quatro, independentes:

 1. **O fim normal.** A sessão acaba, o JS chama `parar()`. Cobre o caso comum e
    só ele — não cobre app morto, e é por isso que existem as outras três.

 2. **O relógio do sistema.** `DeviceActivityCenter` agenda uma janela, e o
    `intervalDidEnd` da extensão derruba o escudo. Roda em **outro processo**,
    então continua valendo com o app encerrado pelo usuário ou pelo iOS.

 3. **A reconciliação na abertura.** Todo `start` do app pergunta: existe escudo
    de pé sem sessão que o justifique? Derruba. Cobre reinício do aparelho,
    crash e a extensão não ter disparado.

 4. **O teto absoluto.** Quatro horas, em `EstadoDoFoco`. É a rede embaixo das
    outras três: mesmo que todas falhem, existe uma hora em que acaba.

 ## A janela mínima da Apple é de 15 minutos

 `DeviceActivitySchedule` recusa intervalo menor. Um pomodoro de 5 ou 10 minutos
 **não** consegue agendar a garantia (2) — e por isso o agendamento é
 best-effort e nunca condição para o escudo subir: quem manda é o limite gravado
 em `EstadoDoFoco`, que as garantias (3) e (4) conferem sozinhas.

 ## Nunca bloqueamos o Quibly

 A saída tem que estar do lado de fora do escudo. O sistema não aplica a loja de
 ajustes ao app que a criou, e mesmo assim o `parar()` continua alcançável pela
 tela do escudo — ver o alvo `shield-action`.
 */
public class FocoProfundoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("FocoProfundo")

    /**
     Se o aparelho consegue fazer isto.

     iOS 16+ com Tempo de Uso disponível. Falso não é erro: é um botão que não
     aparece.
     */
    Function("disponivel") { () -> Bool in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) { return true }
      #endif
      return false
    }

    /**
     Pede a autorização do Tempo de Uso.

     Quem aprova é a pessoa, com Face ID ou a senha do Tempo de Uso, numa folha
     do sistema que não controlamos. Pode ser negada, e pode ser revogada nos
     Ajustes depois — o que é correto e a gente não tenta contornar.
     */
    AsyncFunction("pedirPermissao") { () async throws -> Bool in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        return AuthorizationCenter.shared.authorizationStatus == .approved
      }
      #endif
      return false
    }

    /**
     Abre o seletor do sistema para escolher o que continua liberado.

     Devolve quantos apps ficaram escolhidos — é a única coisa que dá para saber
     sobre eles. Nem o app nem o servidor jamais veem **quais** são: os tokens
     são cifrados e só a Apple os interpreta.
     */
    AsyncFunction("escolherLiberados") { (promessa: Promise) in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        AppsLiberados.apresentar { quantos in promessa.resolve(quantos) }
        return
      }
      #endif
      promessa.resolve(0)
    }

    /** Quantos apps a pessoa liberou. Zero quer dizer "bloqueie tudo". */
    Function("quantosLiberados") { () -> Int in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) { return AppsLiberados.quantidade }
      #endif
      return 0
    }

    Function("temPermissao") { () -> Bool in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        return AuthorizationCenter.shared.authorizationStatus == .approved
      }
      #endif
      return false
    }

    /**
     Levanta o escudo por `duracaoSegundos`.

     A ordem aqui não é estilo. **A marca de validade é gravada antes do
     escudo**: morrer entre as duas linhas deixa, no pior caso, um limite sem
     escudo — inofensivo. Na ordem inversa deixaria escudo sem limite, que é
     justamente o estado do qual não se sai.
     */
    AsyncFunction("comecar") { (duracaoSegundos: Double) async throws -> Bool in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        guard AuthorizationCenter.shared.authorizationStatus == .approved else { return false }

        let duracao = min(max(duracaoSegundos, 60), EstadoDoFoco.tetoDeSeguranca)
        let fim = Date().addingTimeInterval(duracao)

        EstadoDoFoco.marcarInicio(expiraEm: fim)

        let store = ManagedSettingsStore(named: EstadoDoFoco.loja)
        /*
         Tudo, menos o que a pessoa liberou.

         `.all(except:)` é a forma que a API oferece, e ela é o inverso do que a
         intuição sugere: não se escolhe o que bloquear, se bloqueia tudo e se
         abrem exceções. Os tokens são opacos — não dá para enumerar o que está
         instalado nem descobrir que app é cada um —, então as exceções só podem
         vir do seletor do sistema. Ver `AppsLiberados`.

         Seleção vazia devolve o comportamento de antes: bloqueia tudo.
        */
        store.shield.applicationCategories = .all(except: AppsLiberados.selecao.applicationTokens)
        // Os sites não têm exceção porque o seletor de domínios é outro fluxo, e
        // ninguém pediu por ele. Liberar um app não implica liberar o site dele.
        store.shield.webDomainCategories = .all()

        Self.agendarFim(em: fim)
        return true
      }
      #endif
      return false
    }

    /** Derrubar o escudo. Sempre disponível, sempre idempotente. */
    Function("parar") {
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *) {
        DeviceActivityCenter().stopMonitoring([
          DeviceActivityName(EstadoDoFoco.atividade),
        ])
        EstadoDoFoco.liberar()
      }
      #endif
    }

    /**
     A reconciliação — garantia (3).

     Chamada na abertura do app e a cada volta para o primeiro plano. Se o
     escudo venceu, ou se existe sem marca que o explique, cai.

     Isto é o que salva o caso feio: aparelho reiniciado no meio da sessão, app
     morto pelo iOS, extensão que não disparou. Sem esta função, cada um desses
     deixa o telefone bloqueado sem prazo.
     */
    Function("reconciliar") { () -> Bool in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *), EstadoDoFoco.venceu {
        DeviceActivityCenter().stopMonitoring([
          DeviceActivityName(EstadoDoFoco.atividade),
        ])
        EstadoDoFoco.liberar()
        return true
      }
      #endif
      return false
    }

    /** Quanto ainda falta, em segundos. Zero quer dizer que não há escudo. */
    Function("segundosRestantes") { () -> Double in
      #if canImport(FamilyControls)
      if #available(iOS 16.0, *), let fim = EstadoDoFoco.expiraEm {
        return max(0, fim.timeIntervalSinceNow)
      }
      #endif
      return 0
    }
  }

  /**
   Agenda o fim pelo relógio do sistema — garantia (2).

   Best-effort de propósito. A Apple recusa janela menor que 15 minutos, e um
   pomodoro de 10 é legítimo; falhar aqui não pode impedir o foco de começar,
   porque as garantias (3) e (4) já cobrem o mesmo risco por outro caminho.
   */
  @available(iOS 16.0, *)
  private static func agendarFim(em fim: Date) {
    #if canImport(FamilyControls)
    let calendario = Calendar.current
    let agora = Date()
    let schedule = DeviceActivitySchedule(
      intervalStart: calendario.dateComponents([.hour, .minute, .second], from: agora),
      intervalEnd: calendario.dateComponents([.hour, .minute, .second], from: fim),
      repeats: false
    )
    do {
      try DeviceActivityCenter().startMonitoring(
        DeviceActivityName(EstadoDoFoco.atividade),
        during: schedule
      )
    } catch {
      // Silêncio proposital. A janela curta é o caso esperado, não uma anomalia,
      // e derrubar a sessão de foco por causa de um backstop seria trocar um
      // risco coberto por uma falha certa.
    }
    #endif
  }
}
