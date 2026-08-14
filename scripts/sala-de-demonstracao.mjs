#!/usr/bin/env node
/**
 * Povoa uma sala **privada** com contas de demonstração, para gravar vídeo.
 *
 * ## O que isto é, e o que não é
 *
 * É uma ferramenta de marketing: encher uma sala que só o dono do produto vê,
 * para que o vídeo mostre o app funcionando em vez de uma tela vazia. Toda
 * captura de loja é encenada; esta é a forma honesta de encenar.
 *
 * **Não é** para sala pública. Se uma pessoa real entra numa sala e vê "cinco
 * estudando agora" que não existem, ela decide ficar por causa de gente que não
 * está lá — isso é fabricar prova social, e custa a confiança inteira quando
 * alguém percebe. A sala tem que ser privada, e o script recusa rodar sem que
 * você confirme isso na linha de comando.
 *
 * ## O que ele consegue, e o que não consegue
 *
 * Consegue: criar as contas, entrar na sala, e manter sessões **de verdade**
 * correndo, com batimento a cada 30 segundos. É isso que faz a tela mostrar
 * "estudando agora" — não existe campo para preencher, é estado vivo.
 *
 * Não consegue: histórico. O servidor calcula duração de `startedAt` até
 * `endedAt` pelo relógio dele, então hora só existe se o tempo passou. Não há
 * como dar "180 horas" nem "sequência de 40 dias" a ninguém. É a mesma
 * propriedade que impede um usuário de forjar tempo — ela não abre exceção
 * para nós, e é assim que tem que ser.
 *
 * O `started_at_hint` (sessão nascida offline) retroage o início, mas o
 * servidor corta ao plano da sessão: no máximo ~4h para um pomodoro de 50/10, e
 * nunca para ontem. O script usa isso para as horas do dia parecerem plausíveis.
 *
 * ## Credenciais
 *
 * Usa a chave **pública** do Firebase (`AIzaSy…`), que é desenhada para viver
 * no cliente — a mesma que o app carrega. Nenhum segredo é lido, escrito ou
 * pedido. Exige que o provedor E-mail/Senha esteja habilitado no console.
 *
 * ## Uso
 *
 *   node scripts/sala-de-demonstracao.mjs --convite ABC123 --confirmo-sala-privada
 *
 * Numa segunda rodada, reaproveite as contas passando a senha da primeira:
 *
 *   node scripts/sala-de-demonstracao.mjs --convite ABC123 --confirmo-sala-privada \
 *     --senha demo-1cc4a6094257
 *
 * A senha das contas é gerada na hora e impressa uma vez, para você conseguir
 * entrar nelas pelo app se quiser gravar de outro ângulo.
 */

import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));

const API = process.env.QUIBLY_API ?? 'https://rabbit.tryquibly.com';

/**
 * A chave sai do `eas.json`, não da mão de quem roda.
 *
 * Ela é **pública** por definição — o prefixo `EXPO_PUBLIC_` significa que vai
 * embutida em todo build e qualquer pessoa com o app a extrai. Não há segredo
 * a proteger aqui; o que havia era atrito: pedir que alguém a copiasse à mão
 * garantia que uma hora o texto de exemplo seria colado no lugar dela.
 */
function chaveDoRepo() {
  if (process.env.QUIBLY_FIREBASE_KEY) return process.env.QUIBLY_FIREBASE_KEY;
  const eas = JSON.parse(
    readFileSync(join(AQUI, '../apps/mobile/eas.json'), 'utf8'),
  );
  for (const perfil of Object.values(eas.build ?? {})) {
    const k = perfil?.env?.EXPO_PUBLIC_FIREBASE_API_KEY;
    if (k) return k;
  }
  return '';
}

const FIREBASE_KEY = chaveDoRepo();

const IDENTITY = 'https://identitytoolkit.googleapis.com/v1';

/** As seis. Nomes comuns, sem piada interna — o vídeo é público. */
const ELENCO = [
  { nome: 'Marina Alves', handle: 'marina', materia: 'Cálculo II', estuda: true },
  { nome: 'Pedro Henrique', handle: 'pedroh', materia: 'Física', estuda: true },
  { nome: 'Júlia Costa', handle: 'juliac', materia: 'Anatomia', estuda: true },
  { nome: 'Rafael Lima', handle: 'rafalima', materia: 'Direito Penal', estuda: true },
  { nome: 'Bea Fernandes', handle: 'beaf', materia: 'Química', estuda: false },
  { nome: 'Caio Menezes', handle: 'caiom', materia: 'História', estuda: false },
];

/** Minutos que cada uma "já estudou" hoje. Números irregulares parecem reais. */
const MINUTOS_DE_HOJE = [222, 135, 118, 97, 64, 41];

const arg = (nome) => {
  const i = process.argv.indexOf(`--${nome}`);
  return i === -1 ? null : (process.argv[i + 1] ?? true);
};

async function json(url, { metodo = 'POST', token, corpo } = {}) {
  const r = await fetch(url, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  const dado = texto ? JSON.parse(texto) : null;
  if (!r.ok) {
    throw new Error(
      `${metodo} ${url.replace(FIREBASE_KEY, '…')} → ${r.status} ${
        dado?.error?.message ?? dado?.message ?? texto.slice(0, 200)
      }`,
    );
  }
  return dado;
}

/**
 * Cria a conta no Firebase e devolve o token. Reaproveita se já existir.
 *
 * A senha é gerada por execução, então uma segunda rodada não consegue entrar
 * nas contas da primeira. Isso aconteceu de verdade: um teste interrompido
 * deixou uma conta para trás, e a rodada seguinte morreu num
 * `INVALID_LOGIN_CREDENTIALS` que não dizia o que fazer. Agora diz.
 */
async function conta(email, senha) {
  try {
    const r = await json(`${IDENTITY}/accounts:signUp?key=${FIREBASE_KEY}`, {
      corpo: { email, password: senha, returnSecureToken: true },
    });
    return { token: r.idToken, nova: true };
  } catch (err) {
    if (!String(err.message).includes('EMAIL_EXISTS')) throw err;
    try {
      const r = await json(
        `${IDENTITY}/accounts:signInWithPassword?key=${FIREBASE_KEY}`,
        { corpo: { email, password: senha, returnSecureToken: true } },
      );
      return { token: r.idToken, nova: false };
    } catch (e2) {
      if (!/INVALID_LOGIN_CREDENTIALS|INVALID_PASSWORD/.test(e2.message)) throw e2;
      throw new Error(
        `A conta ${email} já existe com outra senha.\n\n` +
          '  Rode de novo passando a senha da primeira vez:\n' +
          '    --senha demo-xxxxxxxxxxxx\n\n' +
          '  Ou apague as contas antigas pelo app (Ajustes → Delete Account)\n' +
          '  e comece limpo.',
      );
    }
  }
}

async function main() {
  const convite = arg('convite');
  if (!convite || typeof convite !== 'string') {
    console.error('Falta --convite CODIGO (o código da sala privada).');
    process.exit(1);
  }
  if (!arg('confirmo-sala-privada')) {
    console.error(
      'Falta --confirmo-sala-privada.\n\n' +
        'Este script só deve rodar numa sala que ninguém de fora vê. Numa sala\n' +
        'pública, contas de demonstração viram prova social falsa para gente real.',
    );
    process.exit(1);
  }
  if (!FIREBASE_KEY.startsWith('AIzaSy') || FIREBASE_KEY.length < 30) {
    console.error(
      'Não achei a chave pública do Firebase em apps/mobile/eas.json\n' +
        '(EXPO_PUBLIC_FIREBASE_API_KEY). Defina QUIBLY_FIREBASE_KEY se ela\n' +
        'estiver noutro lugar.',
    );
    process.exit(1);
  }

  /* `--senha` reaproveita as contas de uma rodada anterior. Ver `conta()`. */
  const senha =
    typeof arg('senha') === 'string'
      ? arg('senha')
      : `demo-${randomBytes(6).toString('hex')}`;
  console.log(`API: ${API}`);
  console.log(`Senha das contas (anote, aparece uma vez): ${senha}\n`);

  const vivas = [];

  for (const [i, pessoa] of ELENCO.entries()) {
    const email = `demo.${pessoa.handle}@tryquibly.com`;
    const { token, nova } = await conta(email, senha);

    await json(`${API}/auth/profile`, {
      token,
      corpo: { username: pessoa.nome, handle: pessoa.handle },
    }).catch((e) => {
      // Perfil já existente devolve conflito; seguir é o certo.
      if (!/409|already|P2002/i.test(e.message)) throw e;
    });

    await json(`${API}/leagues/join`, {
      token,
      corpo: { invite_code: convite, display_name: pessoa.nome },
    }).catch((e) => {
      if (!/already|409/i.test(e.message)) throw e;
    });

    const materia = await json(`${API}/subjects`, {
      token,
      corpo: { name: pessoa.materia, color: '#0043BA' },
    }).catch(() => null);

    console.log(
      `  ${nova ? 'criada ' : 'reusada'}  ${pessoa.nome.padEnd(16)} @${pessoa.handle}`,
    );

    if (!pessoa.estuda || !materia?.id) continue;

    /*
     A sessão retroagida: o servidor corta o início ao que o plano justifica.
     Um pomodoro de 50/10 permite ~4h, que é o teto do que dá para mostrar.
    */
    const minutos = Math.min(MINUTOS_DE_HOJE[i] ?? 60, 240);
    const sessao = await json(`${API}/sessions/start`, {
      token,
      corpo: {
        subject_id: materia.id,
        timer_mode: 'pomodoro',
        work_duration: 50,
        break_duration: 10,
        proof_mode: false,
        client_session_id: crypto.randomUUID(),
        started_at_hint: new Date(Date.now() - minutos * 60_000).toISOString(),
      },
    });
    vivas.push({ pessoa, token, id: sessao.id });
    console.log(`            estudando há ~${minutos} min`);
  }

  if (vivas.length === 0) {
    console.log('\nNinguém estudando. Nada a manter vivo.');
    return;
  }

  console.log(
    `\n${vivas.length} sessões vivas. Batendo a cada 30s — Ctrl+C para parar.\n` +
      'Enquanto isto roda, a sala mostra essas pessoas estudando agora.\n',
  );

  const bater = async () => {
    for (const v of vivas) {
      await json(`${API}/sessions/${v.id}/heartbeat`, { token: v.token }).catch(
        (e) => console.warn(`  ! ${v.pessoa.handle}: ${e.message}`),
      );
    }
    process.stdout.write(`  ${new Date().toLocaleTimeString()} ok\r`);
  };

  await bater();
  const relogio = setInterval(bater, 30_000);

  /** Ctrl+C encerra as sessões — deixá-las abertas sujaria a sala por 4h. */
  process.on('SIGINT', async () => {
    clearInterval(relogio);
    console.log('\n\nEncerrando as sessões…');
    for (const v of vivas) {
      await json(`${API}/sessions/${v.id}/end`, { token: v.token, corpo: {} }).catch(
        () => {},
      );
    }
    console.log('Pronto.');
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(`\nFalhou: ${e.message}`);
  process.exit(1);
});
