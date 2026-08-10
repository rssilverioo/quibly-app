import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A sessão guardada no aparelho.
 *
 * ## Por que existe
 *
 * Três buracos, todos com a mesma causa — o app não lembrava de nada sem o
 * servidor:
 *
 * 1. **Não dava para começar sem rede.** `startSession` esperava a resposta da
 *    API. E modo avião é o que a pessoa liga *antes* de sentar para estudar,
 *    não no meio: o caso mais comum era o que não funcionava.
 * 2. **App morto offline perdia a tela.** A sessão continuava viva no servidor,
 *    mas a recuperação lia `elapsed_seconds` — o que também precisa de rede.
 * 3. **Cronômetro livre não sobrevivia ao silêncio.** Sem duração declarada não
 *    há plano que justifique ficar calado (ver `silencioToleradoAte` na API), e
 *    ele caía na janela curta.
 *
 * ## O registro de batidas, e por que ele não é falsificável de graça
 *
 * `batidas` é uma lista de instantes em que o app esteve vivo — uma a cada
 * intervalo de batimento, gravada mesmo sem rede. Na volta ela vai para o
 * servidor como **prova de continuidade** do intervalo em que ele não ouviu
 * nada.
 *
 * O que impede a trapaça não é a lista em si: é o teto. O servidor conhece o
 * último batimento que ele mesmo carimbou e conhece o instante da reconexão,
 * ambos pelo relógio dele. A prova só pode **preencher** esse intervalo, nunca
 * excedê-lo. Ou seja, o máximo que alguém consegue afirmar é ter estudado num
 * período que de fato passou — exatamente o que já conseguiria deixando o app
 * aberto. O que a prova muda é o esforço: de "deixar aberto" para "fabricar um
 * registro".
 *
 * ## Por que o relógio do aparelho basta aqui
 *
 * As batidas usam `Date.now()`, que a pessoa pode mexer nos Ajustes. Não
 * importa: quem decide quanto tempo passou é o servidor, e a prova é conferida
 * contra o intervalo medido por ele. Mexer no relógio local não compra segundo
 * nenhum — só faz a prova ser recusada por não bater.
 *
 * ## Uma sessão por vez
 *
 * Uma chave só, sobrescrita. O produto não tem sessões simultâneas — a API
 * recusa começar a segunda —, então guardar uma lista seria modelar um estado
 * que não existe.
 */

const CHAVE = '@quibly/sessao-viva';

/**
 * Teto do registro de batidas.
 *
 * A 30s por batida, 2000 cobrem mais de 16 horas — acima do teto diário de
 * estudo da API, então nenhuma sessão legítima esbarra nisto. Existe para o
 * caso patológico: um registro que cresce sem limite acabaria estourando o
 * AsyncStorage, e a falha apareceria como sessão que não salva.
 */
const MAXIMO_DE_BATIDAS = 2000;

export interface SessaoEmCache {
  /** O id do servidor. `null` enquanto a sessão só existe aqui. */
  id: string | null;
  /**
   * Identidade local, criada na hora de começar.
   *
   * Existe para a sessão nascida offline ter nome antes de o servidor lhe dar
   * um, e para o registro no servidor ser **idempotente**: duas tentativas de
   * registrar a mesma sessão local não podem virar duas sessões.
   */
  idLocal: string;
  subjectId: string;
  leagueId: string | null;
  timerMode: string;
  workDuration: number;
  breakDuration: number;
  /** Relógio do aparelho, em epoch ms. Só uma dica — ver o cabeçalho. */
  comecouEm: number;
  /** Instantes em que o app esteve vivo, para a prova de continuidade. */
  batidas: number[];
}

/** Falha em silêncio: cache é otimização, e nunca motivo para não estudar. */
async function escrever(sessao: SessaoEmCache | null): Promise<void> {
  try {
    if (sessao === null) await AsyncStorage.removeItem(CHAVE);
    else await AsyncStorage.setItem(CHAVE, JSON.stringify(sessao));
  } catch {
    // Disco cheio, storage corrompido: a sessão continua na memória e no
    // servidor. Perder o cache é perder uma rede de segurança, não a sessão.
  }
}

export async function guardar(sessao: SessaoEmCache): Promise<void> {
  await escrever(sessao);
}

export async function limpar(): Promise<void> {
  await escrever(null);
}

/**
 * Lê o que está guardado, ou `null`.
 *
 * Valida a forma em vez de confiar: o conteúdo veio de uma versão anterior do
 * app, e um campo que mudou de tipo viraria `NaN` no cronômetro em vez de erro
 * — que é o modo de falha mais caro que este app já teve.
 */
export async function ler(): Promise<SessaoEmCache | null> {
  try {
    const cru = await AsyncStorage.getItem(CHAVE);
    if (!cru) return null;
    const s = JSON.parse(cru) as Partial<SessaoEmCache>;
    if (
      typeof s.idLocal !== 'string' ||
      typeof s.subjectId !== 'string' ||
      typeof s.timerMode !== 'string' ||
      typeof s.comecouEm !== 'number' ||
      !Number.isFinite(s.comecouEm) ||
      typeof s.workDuration !== 'number' ||
      typeof s.breakDuration !== 'number' ||
      !Array.isArray(s.batidas)
    ) {
      // Forma desconhecida é lixo, e lixo aqui é pior que vazio: apagar deixa a
      // pessoa começar de novo; manter deixa o app tropeçando toda abertura.
      await escrever(null);
      return null;
    }
    return {
      id: typeof s.id === 'string' ? s.id : null,
      idLocal: s.idLocal,
      subjectId: s.subjectId,
      leagueId: typeof s.leagueId === 'string' ? s.leagueId : null,
      timerMode: s.timerMode,
      workDuration: s.workDuration,
      breakDuration: s.breakDuration,
      comecouEm: s.comecouEm,
      batidas: s.batidas.filter(
        (b): b is number => typeof b === 'number' && Number.isFinite(b),
      ),
    };
  } catch {
    return null;
  }
}

/**
 * Acrescenta uma batida ao registro guardado.
 *
 * Devolve a sessão atualizada, ou `null` se não havia nada guardado — quem
 * chama não precisa ler antes.
 */
export async function registrarBatida(
  agora = Date.now(),
): Promise<SessaoEmCache | null> {
  const sessao = await ler();
  if (!sessao) return null;

  const batidas = [...sessao.batidas, agora];
  const atualizada: SessaoEmCache = {
    ...sessao,
    // Corta pelo começo: as batidas recentes são as que provam o intervalo que
    // o servidor não viu. As antigas ele já carimbou sozinho.
    batidas:
      batidas.length > MAXIMO_DE_BATIDAS
        ? batidas.slice(batidas.length - MAXIMO_DE_BATIDAS)
        : batidas,
  };
  await escrever(atualizada);
  return atualizada;
}

/**
 * As batidas que provam o intervalo que o servidor não viu.
 *
 * Tudo anterior ao último batimento que ele carimbou é ruído: ele já sabe. E
 * mandar o registro inteiro a cada reconexão cresceria sem motivo.
 */
export function provaDesde(
  sessao: SessaoEmCache,
  ultimoBatimentoDoServidor: number,
): number[] {
  return sessao.batidas.filter((b) => b > ultimoBatimentoDoServidor);
}
