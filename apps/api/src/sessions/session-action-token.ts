import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * O token que deixa a Live Activity pausar, retomar e encerrar **uma** sessão.
 *
 * ## Por que não reaproveitar o token do Firebase
 *
 * Os botões da Live Activity precisam funcionar com o app fechado, e não há
 * runtime de JavaScript numa extensão de widget — quem chama a API é o Swift,
 * sozinho. Isso obriga a guardar alguma credencial fora do app.
 *
 * O ID token do Firebase seria a escolha preguiçosa e a errada: ele autoriza a
 * **conta inteira**, expira em uma hora, e renová-lo exigiria pôr o refresh
 * token — que não expira — dentro da extensão. Um vazamento ali custaria a
 * conta.
 *
 * Este token autoriza três verbos numa única sessão, e morre com ela. Se
 * vazar, o estrago é alguém pausar um estudo alheio: constrangedor, não grave.
 *
 * ## Por que HMAC e não uma linha no banco
 *
 * Um token aleatório guardado na sessão precisaria de migração, de uma consulta
 * por chamada e de limpeza depois. O HMAC carrega o que precisa e se verifica
 * sozinho — e a revogação sai de graça, porque encerrar a sessão já faz o
 * serviço recusar as três operações.
 *
 * ## O formato
 *
 * `<payload em base64url>.<assinatura em base64url>` — parecido com um JWT e de
 * propósito **não** é um: sem `alg` no cabeçalho não existe o ataque de trocar
 * o algoritmo por `none`, que é o modo clássico de furar JWT feito à mão.
 */

export interface AcaoDeSessao {
  sessionId: string;
  userId: string;
  /** Segundos desde a época. */
  expiraEm: number;
}

/**
 * Validade do token, em segundos.
 *
 * Vinte e cinco horas: uma hora além da janela do contador da Live Activity, que
 * é o teto de qualquer sessão real. Curto o bastante para o token não virar
 * credencial permanente, longo o bastante para não expirar no meio de um estudo
 * — que seria o pior desfecho, porque o botão pararia de funcionar sem sintoma.
 */
export const VALIDADE_SEGUNDOS = 25 * 60 * 60;

const b64url = (buf: Buffer) => buf.toString('base64url');

function assinar(payload: string, segredo: string): string {
  return b64url(createHmac('sha256', segredo).update(payload).digest());
}

/**
 * Cunha o token de uma sessão. `null` quando não há segredo configurado.
 *
 * Devolver `null` em vez de lançar é deliberado: sem `SESSION_ACTION_SECRET` o
 * recurso simplesmente não existe, e a sessão tem que começar do mesmo jeito. A
 * Live Activity perde os botões e não perde o cronômetro.
 *
 * **Nunca há segredo padrão.** Um valor de reserva no código seria público no
 * repositório, e um token assinado com ele valeria para qualquer instalação.
 */
export function cunharTokenDeAcao(
  sessionId: string,
  userId: string,
  segredo: string | undefined,
  agora = new Date(),
): string | null {
  if (!segredo) return null;

  const dados: AcaoDeSessao = {
    sessionId,
    userId,
    expiraEm: Math.floor(agora.getTime() / 1000) + VALIDADE_SEGUNDOS,
  };

  const payload = b64url(Buffer.from(JSON.stringify(dados)));
  return `${payload}.${assinar(payload, segredo)}`;
}

/**
 * O que o token afirma, se a assinatura confere e ele não venceu.
 *
 * `null` para qualquer defeito — formato, assinatura, validade. Quem chama não
 * ganha nada sabendo *qual* dos três falhou, e distinguir daria a um atacante um
 * oráculo para separar "assinatura errada" de "token vencido".
 */
export function lerTokenDeAcao(
  token: string | undefined,
  segredo: string | undefined,
  agora = new Date(),
): AcaoDeSessao | null {
  if (!token || !segredo) return null;

  const [payload, assinatura] = token.split('.');
  if (!payload || !assinatura) return null;

  const esperada = assinar(payload, segredo);
  /**
   * Comparação em tempo constante.
   *
   * `===` sai na primeira diferença, e o tempo de resposta revela quantos bytes
   * bateram — o suficiente para descobrir a assinatura byte a byte com pedidos
   * repetidos. `timingSafeEqual` exige o mesmo comprimento, então a diferença de
   * tamanho é checada antes e fora dela.
   */
  if (assinatura.length !== esperada.length) return null;
  if (!timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperada))) return null;

  try {
    const dados = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      typeof dados?.sessionId !== 'string' ||
      typeof dados?.userId !== 'string' ||
      typeof dados?.expiraEm !== 'number'
    ) {
      return null;
    }
    if (dados.expiraEm * 1000 <= agora.getTime()) return null;
    return dados as AcaoDeSessao;
  } catch {
    return null;
  }
}
