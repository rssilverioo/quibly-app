import { requireNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

/**
 * Foco profundo: enquanto a sessão corre, os outros apps ficam bloqueados.
 *
 * ## iOS e só iOS
 *
 * No Android não existe equivalente. O que chega perto é serviço de
 * acessibilidade, que a Play Store trata como uso indevido e costuma reprovar —
 * e que, para funcionar, exige uma permissão que dá ao app poder de ler a tela
 * inteira. Não vale o que custa.
 *
 * Então este módulo é `null` no Android, e a tela **esconde** a opção em vez de
 * mostrá-la desligada: um botão que não faz nada ensina desconfiança.
 *
 * ## Tudo degrada em silêncio
 *
 * Sem permissão, sem iOS 16, com o módulo ausente — nada disso é erro para o
 * usuário. A sessão de estudo continua igual e o servidor continua contando os
 * minutos. O que se perde é o bloqueio, não o estudo.
 */
interface FocoProfundoNativo {
  disponivel(): boolean;
  temPermissao(): boolean;
  pedirPermissao(): Promise<boolean>;
  comecar(duracaoSegundos: number): Promise<boolean>;
  parar(): void;
  reconciliar(): boolean;
  segundosRestantes(): number;
}

/**
 * Se o **build** carrega o foco profundo.
 *
 * Três chaves ligam este recurso, e elas andam juntas — `lib/foco-contrato.test`
 * recusa meia ligação:
 *
 * 1. esta constante;
 * 2. `com.apple.developer.family-controls` no `ios.entitlements` do `app.json`;
 * 3. os `expo-target.config.js` em `targets/foco-monitor` e `targets/foco-escudo`.
 *
 * Ligar só esta faz o interruptor aparecer e a permissão falhar — promete e não
 * cumpre, que é pior que não ter o recurso.
 *
 * **E há uma quarta chave, do lado da Apple**, que custou cinco builds: no App
 * ID existem duas linhas parecidas, `Family Controls (Development)` e
 * `Family Controls (Distribution)`. A EAS marca a primeira ao sincronizar
 * capabilities, e um perfil App Store precisa da **segunda**. Com a de
 * desenvolvimento só, o Xcode recusa a assinatura dizendo que falta a
 * capability — mesmo com a EAS relatando `Enabled: Family Controls`.
 */
const FOCO_NO_BUILD = true;

function resolver(): FocoProfundoNativo | null {
  if (!FOCO_NO_BUILD) return null;
  if (Platform.OS !== 'ios') return null;
  try {
    return requireNativeModule<FocoProfundoNativo>('FocoProfundo');
  } catch {
    // Build sem o módulo linkado. Ver o comentário no `FocoProfundo.podspec`
    // sobre como isso já aconteceu e passou meses despercebido.
    return null;
  }
}

const nativo = resolver();

/** Se o aparelho consegue bloquear apps. Falso esconde a opção. */
export function focoDisponivel(): boolean {
  return nativo?.disponivel() ?? false;
}

export function temPermissaoDeFoco(): boolean {
  return nativo?.temPermissao() ?? false;
}

/** Abre a folha do sistema. Quem aprova é a pessoa, com Face ID ou senha. */
export async function pedirPermissaoDeFoco(): Promise<boolean> {
  return (await nativo?.pedirPermissao()) ?? false;
}

/**
 * Levanta o escudo. `false` quer dizer que não subiu — e a sessão segue assim
 * mesmo, porque foco é acessório do estudo, não condição dele.
 */
export async function comecarFoco(duracaoSegundos: number): Promise<boolean> {
  return (await nativo?.comecar(duracaoSegundos)) ?? false;
}

/**
 * Derruba o escudo.
 *
 * Chamar sem escudo de pé não é erro. Todo caminho de saída da sessão deve
 * passar por aqui — inclusive os de erro, inclusive o cancelamento.
 */
export function pararFoco(): void {
  nativo?.parar();
}

/**
 * Derruba o escudo se ele perdeu a validade — a garantia (3).
 *
 * Chamada na abertura do app e a cada volta ao primeiro plano. É o que salva
 * aparelho reiniciado no meio da sessão, app morto pelo iOS e extensão que não
 * disparou. Devolve `true` quando de fato liberou alguma coisa.
 */
export function reconciliarFoco(): boolean {
  return nativo?.reconciliar() ?? false;
}

export function segundosDeFocoRestantes(): number {
  return nativo?.segundosRestantes() ?? 0;
}
