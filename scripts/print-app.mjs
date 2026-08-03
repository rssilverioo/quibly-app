#!/usr/bin/env node
/**
 * print-app — sobe o app no simulador iOS e cospe PNGs das telas.
 *
 * Existe para tirar o dono do produto do caminho crítico. Antes disto, ele era
 * a única pessoa capaz de ver o app: todo mundo escrevia código, mandava print
 * para ele julgar, e ele virava o controle de qualidade. A capa da sala custou
 * três rodadas por causa disso.
 *
 *   npm run print:ios                    # telas padrão
 *   npm run print:ios -- league/room/ID  # rotas extras, por deep link
 *
 * Duas regras governam este arquivo:
 *
 * 1. NUNCA travar em silêncio (lição do commit 362fc5d). Toda parada diz o que
 *    falta e o comando exato que resolve.
 *
 * 2. NUNCA salvar um print com nome que não corresponde à tela. A primeira
 *    versão pedia a rota e salvava o arquivo com o nome pedido, sem conferir se
 *    o app tinha navegado. Quando o deep link da biblioteca falhou, cada print
 *    seguinte herdou o nome da tela anterior: `lista-de-salas.png` era o perfil.
 *    Um print com nome errado é pior que print nenhum — parece prova, e a noite
 *    inteira julga design por esses arquivos. Por isso agora toda tela é lida
 *    por OCR e conferida contra um marcador antes de virar arquivo; o que não
 *    confere vira `FALHOU-*.png` e derruba o código de saída.
 *
 * Três coisas aprendidas apanhando, registradas para não se perderem:
 *
 * - **Corrida com o hot reload.** Com vários agentes editando a mesma árvore, o
 *   Metro recarrega o bundle no meio da captura e o app volta para a raiz. Foi
 *   assim que `precos.png` saiu mostrando a lista de salas. Daí as TENTATIVAS:
 *   não é defeito da tela, é uma corrida, e a resposta é tentar de novo.
 *
 * - **Um simulador de cada vez.** Duas execuções simultâneas disputam o mesmo
 *   simulador e cada uma navega por cima da outra. Se outro agente estiver
 *   capturando, espere — não há como as duas darem certo ao mesmo tempo.
 *
 * - **O OCR quebra linha onde a tela quebra.** "Unmatched Route" volta em duas
 *   linhas; por isso a comparação normaliza espaços. Sem isso a verificação
 *   passa por engano, que é o pior defeito possível aqui.
 */

import { spawnSync, spawn } from 'node:child_process';
import {
  existsSync,
  readFileSync,
  mkdirSync,
  readdirSync,
  statSync,
  openSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = join(RAIZ, 'apps', 'mobile');
const DESTINO = join(RAIZ, 'docs', 'referencia', 'estado-atual');
const FONTE_OCR = join(RAIZ, 'scripts', 'ocr-tela.swift');
const BUNDLE_ID = 'com.quibly.app';
const ESQUEMA = 'quibly';
const PORTA_METRO = Number(process.env.QUIBLY_METRO_PORT || 8081);

/**
 * Arquivos que este script nunca pode tocar. `00-ANTES-*` é o único registro
 * que sobrou do visual anterior à reformulação — não existe como recapturar.
 */
const INTOCAVEIS = /^00-ANTES-/;

/** Quantas vezes tentar cada tela antes de dar a captura por perdida. */
const TENTATIVAS = 3;

/**
 * Overlays do ambiente de desenvolvimento que aparecem por cima do app. Não são
 * bug do produto e não invalidam a captura — mas cobrem a tab bar, então o
 * script diz em quais prints eles estão.
 */
const SUJEIRA_DE_DEV = [
  { marca: 'open debugger', nome: 'aviso do debugger' },
  { marca: 'revenuecat', nome: 'erro do RevenueCat' },
  { marca: "the 'state' or 'screen'", nome: 'deep link rejeitado' },
];

/**
 * As telas que valem como "estado atual".
 *
 * `marcadores` é a prova de que a tela certa apareceu: basta UM bater no texto
 * lido por OCR. São trechos de copy — se alguém renomear um título, a
 * verificação falha de propósito, e o certo é atualizar o marcador aqui, não
 * remover a checagem.
 *
 * Fora desta lista, e sem conserto possível por deep link:
 *   - biblioteca: é `NativeTabs.Trigger hidden`; cinco formas de URL testadas
 *     (`library`, `/library`, `//library`, `(tabs)/library`, `%28tabs%29/...`),
 *     nenhuma navega. O "Ver Tudo" da aba Estudar era a última esperança e
 *     também não leva a lugar nenhum — `router.push('/(tabs)/library')` não faz
 *     nada (conferido por toque em 03/08). A biblioteca não tem caminho.
 *   - login: a raiz redireciona quem está autenticado para fora de `(auth)`.
 *     Só dá para ver saindo da conta — e a sessão do simulador é justamente o
 *     que faz todo o resto funcionar, então não vale o preço.
 *
 * Tudo que depende de um id que só existe depois de o servidor responder —
 * a sala, o feed, publicar foto, o placar, o chat — vive no `piloto.mjs`, que
 * navega por toque (`npm run piloto`). Este arquivo continua sendo o das telas
 * que um deep link alcança sozinho.
 */
const TELAS_PADRAO = [
  {
    rota: '',
    arquivo: 'lista-de-salas',
    descricao: 'lista de salas',
    marcadores: ['Your rooms', 'Suas salas'],
  },
  {
    rota: 'profile',
    arquivo: 'perfil',
    descricao: 'perfil',
    marcadores: ['Rookie', '@rodrigo'],
  },
  {
    rota: 'study',
    arquivo: 'estudo',
    descricao: 'aba estudo',
    marcadores: ['Start Studying', 'Começar a Estudar', 'pomodoro'],
  },
  {
    rota: 'league',
    arquivo: 'ligas',
    descricao: 'índice de ligas (tela legada)',
    marcadores: ['Leagues', 'Ligas', 'Create League', 'Criar liga'],
  },
  {
    rota: 'session/setup',
    arquivo: 'sessao-timer',
    descricao: 'sessão / timer',
    marcadores: ['Start Study Session', 'Iniciar sessão', 'SUBJECT', 'MATÉRIA'],
  },
  {
    rota: 'league/create',
    arquivo: 'criar-sala',
    descricao: 'criar sala',
    marcadores: ['New room', 'Nova sala', 'Room name', 'Nome da sala'],
  },
  {
    rota: 'league/challenge/new',
    arquivo: 'criar-desafio',
    descricao: 'criar desafio',
    marcadores: ['New challenge', 'Novo desafio', 'Challenge name'],
  },
  {
    rota: 'onboarding',
    arquivo: 'onboarding',
    descricao: 'onboarding',
    marcadores: ['Welcome to Quibly', 'Bem-vindo'],
  },
  {
    // Sem um código válido a tela mostra o estado de convite inexistente — que
    // é justamente o estado que ninguém tinha visto desenhado.
    rota: 'league/join/ABC123',
    arquivo: 'entrar-por-link-codigo-invalido',
    descricao: 'entrar por link (código inválido)',
    marcadores: ['invite', 'convite', 'Enter another code', 'outro código'],
  },
  {
    rota: 'pricing',
    arquivo: 'precos',
    descricao: 'preços',
    marcadores: ['Pricing', 'Preços', 'Monthly', 'Mensal'],
  },
  {
    // A tela pós-timer — a mais importante do produto. ATENÇÃO: com um
    // `sessionId` inventado ela cai no estado de erro ("ainda não apareceu no
    // feed"), que é o que este print mostra. O estado publicado de verdade —
    // com foto, sala e confirmação — exige um sessionId real, e por isso está
    // na lista de desbloqueio do dono. O nome do arquivo diz qual estado é
    // justamente para o print não afirmar o que não provou.
    rota: 'session/published?sessionId=probe&minutes=47&xp=120&subjectName=Calculo',
    arquivo: 'pos-timer-ESTADO-DE-ERRO-sessao-inexistente',
    descricao: 'pós-timer (estado de erro — sessão inexistente)',
    marcadores: ['View in feed', 'Ver no feed', 'shown up in the feed', 'apareceu no feed'],
  },
];

// ---------------------------------------------------------------- utilidades

const cores = process.stdout.isTTY;
const azul = (t) => (cores ? `\x1b[34m${t}\x1b[0m` : t);
const verde = (t) => (cores ? `\x1b[32m${t}\x1b[0m` : t);
const vermelho = (t) => (cores ? `\x1b[31m${t}\x1b[0m` : t);
const amarelo = (t) => (cores ? `\x1b[33m${t}\x1b[0m` : t);
const cinza = (t) => (cores ? `\x1b[90m${t}\x1b[0m` : t);

const passo = (msg) => console.log(`${azul('▸')} ${msg}`);
const ok = (msg) => console.log(`${verde('✓')} ${msg}`);
const aviso = (msg) => console.log(`${amarelo('!')} ${msg}`);

/** Morre dizendo o que falta e o que fazer. Nunca "algo deu errado". */
function faltou(oQueFalta, comoResolver = []) {
  console.error(`\n${vermelho('✗ ' + oQueFalta)}`);
  if (comoResolver.length) {
    console.error('\nPara destravar:');
    comoResolver.forEach((linha, i) => console.error(`  ${i + 1}. ${linha}`));
  }
  console.error('');
  process.exit(1);
}

const rodar = (cmd, args, opcoes = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...opcoes });
const existeComando = (cmd) => rodar('which', [cmd]).status === 0;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------- verificação do meio

function exigirMacComXcode() {
  if (process.platform !== 'darwin') {
    faltou(`Simulador iOS só existe no macOS — esta máquina é "${process.platform}".`, [
      'Rode este script num Mac.',
    ]);
  }
  if (!existeComando('xcrun')) {
    faltou('As ferramentas de linha de comando do Xcode não estão instaladas (`xcrun` não existe).', [
      'xcode-select --install',
    ]);
  }
  const xcode = rodar('xcodebuild', ['-version']);
  if (xcode.status !== 0) {
    faltou('`xcodebuild` não roda — provavelmente só há Command Line Tools, sem o Xcode completo.', [
      'Instale o Xcode pela App Store.',
      'sudo xcode-select -s /Applications/Xcode.app/Contents/Developer',
      'sudo xcodebuild -license accept',
    ]);
  }
  ok(`${xcode.stdout.split('\n')[0]} encontrado`);
}

function exigirAmbienteDoApp() {
  const env = join(MOBILE, '.env');
  if (!existsSync(env)) {
    faltou('`apps/mobile/.env` não existe — sem ele o app manda a string literal "YOUR_API_KEY" e o login morre com `auth/api-key-not-valid`.', [
      'cp apps/mobile/.env.example apps/mobile/.env',
      'Preencha as chaves EXPO_PUBLIC_FIREBASE_* com os valores de apps/mobile/GoogleService-Info.plist',
    ]);
  }

  const conteudo = readFileSync(env, 'utf8');
  const exigidas = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
  ];
  const faltando = exigidas.filter((chave) => {
    const linha = conteudo.split('\n').find((l) => l.trim().startsWith(`${chave}=`));
    return !linha || linha.split('=').slice(1).join('=').trim() === '';
  });
  if (faltando.length) {
    faltou(`\`apps/mobile/.env\` existe mas está sem valor em: ${faltando.join(', ')}.`, [
      'Abra apps/mobile/GoogleService-Info.plist e copie os valores correspondentes.',
      'Sem eles o app abre e morre na tela de login com `auth/api-key-not-valid`.',
    ]);
  }
  ok('apps/mobile/.env com as chaves do Firebase preenchidas');

  if (!existsSync(join(MOBILE, 'node_modules'))) {
    faltou('Dependências não instaladas (`apps/mobile/node_modules` não existe).', ['npm install']);
  }
  if (!existsSync(join(MOBILE, 'ios'))) {
    faltou('O projeto nativo iOS não existe (`apps/mobile/ios`). O app usa módulos nativos (Firebase, RevenueCat, liquid-glass), então Expo Go não serve — é preciso build nativo.', [
      'cd apps/mobile && npx expo prebuild --platform ios',
    ]);
  }
  if (!existsSync(join(MOBILE, 'ios', 'Pods'))) {
    faltou('Os Pods do CocoaPods não estão instalados (`apps/mobile/ios/Pods`).', [
      'cd apps/mobile && npx pod-install',
    ]);
  }
  ok('projeto nativo iOS presente, com Pods instalados');
}

// ------------------------------------------------------------------- o OCR

/**
 * Compila o leitor de tela uma vez e guarda o binário no temp do sistema.
 * Interpretado (`swift arquivo.swift`) são ~5s por print; compilado, ~0,5s.
 */
function garantirOcr() {
  if (!existsSync(FONTE_OCR)) {
    faltou('`scripts/ocr-tela.swift` sumiu — sem ele não dá para conferir qual tela apareceu.', [
      'Recupere o arquivo com: git checkout scripts/ocr-tela.swift',
    ]);
  }
  const carimbo = Math.floor(statSync(FONTE_OCR).mtimeMs);
  const binario = join(tmpdir(), `quibly-ocr-${carimbo}`);
  if (existsSync(binario)) return binario;

  passo('compilando o leitor de tela (uma vez só)…');
  const r = rodar('swiftc', ['-O', '-o', binario, FONTE_OCR]);
  if (r.status !== 0) {
    faltou(`Não deu para compilar scripts/ocr-tela.swift: ${(r.stderr || '').trim().split('\n')[0]}`, [
      'Confira que o Xcode completo está selecionado: xcode-select -p',
      'sudo xcode-select -s /Applications/Xcode.app/Contents/Developer',
    ]);
  }
  return binario;
}

/**
 * O texto da tela sem o relógio da barra de status, para comparar duas
 * capturas sem que a virada de um minuto conte como "a tela mudou".
 */
function assinatura(texto) {
  return texto.bruto
    .split('\n')
    .filter((linha) => !/^\s*\d{1,2}:\d{2}\s*$/.test(linha))
    .join('\n')
    .trim();
}

/** Lê a tela e devolve o texto bruto e em minúsculas. */
function lerTela(ocr, png) {
  const r = rodar(ocr, [png]);
  if (r.status !== 0) {
    faltou(`O leitor de tela falhou em ${basename(png)}: ${(r.stderr || '').trim()}`, [
      `Rode na mão para ver: swift scripts/ocr-tela.swift ${png}`,
    ]);
  }
  // O OCR quebra linha onde a tela quebra: "Unmatched Route" volta como duas
  // linhas, e um marcador de duas palavras pode chegar partido. Comparar sempre
  // com os espaços normalizados — senão a verificação passa por engano, que é o
  // pior defeito possível aqui.
  return {
    bruto: r.stdout.trim(),
    minusculo: r.stdout.toLowerCase().replace(/\s+/g, ' ').trim(),
  };
}

// ------------------------------------------------------------- o simulador

function listarDispositivos() {
  const saida = rodar('xcrun', ['simctl', 'list', 'devices', 'available', '--json']).stdout;
  try {
    const json = JSON.parse(saida);
    const todos = [];
    for (const [runtime, lista] of Object.entries(json.devices)) {
      for (const d of lista) todos.push({ ...d, runtime });
    }
    return todos;
  } catch {
    return [];
  }
}

function escolherSimulador() {
  const dispositivos = listarDispositivos();
  if (!dispositivos.length) {
    faltou('Nenhum simulador iOS disponível nesta máquina.', [
      'Abra o Xcode → Settings → Components e baixe um runtime do iOS.',
      'Confira depois com: xcrun simctl list devices available',
    ]);
  }
  const pedido = process.env.QUIBLY_SIM;
  if (pedido) {
    const achado = dispositivos.find((d) => d.udid === pedido || d.name === pedido);
    if (!achado) {
      faltou(`QUIBLY_SIM="${pedido}" não corresponde a nenhum simulador disponível.`, [
        'Veja os nomes válidos com: xcrun simctl list devices available',
        'Ou desligue a variável para o script escolher sozinho.',
      ]);
    }
    return achado;
  }
  const ligado = dispositivos.find((d) => d.state === 'Booted' && d.name.startsWith('iPhone'));
  if (ligado) return ligado;

  const iphones = dispositivos.filter((d) => d.name.startsWith('iPhone'));
  if (!iphones.length) {
    faltou('Há simuladores, mas nenhum iPhone — o app é `supportsTablet: false`.', [
      'Xcode → Window → Devices and Simulators → + e crie um iPhone.',
    ]);
  }
  return iphones[iphones.length - 1];
}

function ligarSimulador(sim) {
  if (sim.state !== 'Booted') {
    passo(`ligando o simulador ${sim.name}…`);
    rodar('xcrun', ['simctl', 'boot', sim.udid]);
  }
  rodar('open', ['-a', 'Simulator']);
  const espera = rodar('xcrun', ['simctl', 'bootstatus', sim.udid, '-b'], { timeout: 180000 });
  if (espera.error) {
    faltou(`O simulador ${sim.name} não terminou de ligar em 3 minutos.`, [
      'xcrun simctl shutdown all',
      `xcrun simctl erase ${sim.udid}   # apaga os dados desse simulador, inclusive o login`,
      'E rode de novo.',
    ]);
  }
  ok(`simulador pronto: ${sim.name} — ${sim.udid}`);
}

// ------------------------------------------------------------ o build nativo

function acharAppCompilado() {
  const base = join(process.env.HOME, 'Library', 'Developer', 'Xcode', 'DerivedData');
  if (!existsSync(base)) return null;
  const candidatos = [];
  for (const dir of readdirSync(base)) {
    if (!dir.startsWith('Quibly-')) continue;
    const app = join(base, dir, 'Build', 'Products', 'Debug-iphonesimulator', 'Quibly.app');
    if (existsSync(app)) candidatos.push({ caminho: app, mtime: statSync(app).mtimeMs });
  }
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => b.mtime - a.mtime);
  return candidatos[0].caminho;
}

function compilar(sim) {
  console.log(cinza('\n  Primeiro build nativo desta máquina. Isto leva de 10 a 30 minutos.'));
  console.log(cinza('  As próximas execuções reaproveitam o build e levam segundos.\n'));
  const r = spawnSync('npx', ['expo', 'run:ios', '--device', sim.udid, '--no-bundler'], {
    cwd: MOBILE,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    faltou('O build nativo falhou — o erro do Xcode está acima.', [
      'Se falou em assinatura: build de simulador não precisa de conta paga; abra apps/mobile/ios/Quibly.xcworkspace no Xcode e rode uma vez na mão para ver o erro completo.',
      'Se falou em Pods: cd apps/mobile && npx pod-install',
      'Se falou em disco cheio: rm -rf ~/Library/Developer/Xcode/DerivedData/Quibly-*',
    ]);
  }
}

function instalar(sim) {
  let app = acharAppCompilado();
  if (!app) {
    compilar(sim);
    app = acharAppCompilado();
    if (!app) {
      faltou('O build terminou mas nenhum Quibly.app apareceu em DerivedData.', [
        'Abra apps/mobile/ios/Quibly.xcworkspace no Xcode e rode na mão para ver o que saiu.',
      ]);
    }
  }
  const r = rodar('xcrun', ['simctl', 'install', sim.udid, app]);
  if (r.status !== 0) {
    faltou(`Não deu para instalar o app no simulador: ${r.stderr.trim()}`, [
      `xcrun simctl shutdown ${sim.udid} && xcrun simctl boot ${sim.udid}`,
      'E rode de novo.',
    ]);
  }
  ok(`app instalado (${cinza(app.replace(process.env.HOME, '~'))})`);
}

// ----------------------------------------------------------------- o Metro

async function metroNoAr() {
  try {
    const r = await fetch(`http://localhost:${PORTA_METRO}/status`, {
      signal: AbortSignal.timeout(2000),
    });
    return (await r.text()).includes('packager-status:running');
  } catch {
    return false;
  }
}

async function garantirMetro() {
  if (await metroNoAr()) {
    ok(`Metro já no ar na porta ${PORTA_METRO} — reaproveitando`);
    return;
  }
  passo('subindo o Metro…');
  // O log vai para arquivo, não para /dev/null: quando o Metro não sobe, a
  // razão está nele — e um erro que aponta para arquivo vazio é pior que nada.
  const log = join(tmpdir(), `quibly-metro-${Date.now()}.log`);
  const fd = openSync(log, 'a');
  const filho = spawn('npx', ['expo', 'start', '--port', String(PORTA_METRO)], {
    cwd: MOBILE,
    detached: true,
    stdio: ['ignore', fd, fd],
  });
  filho.unref();
  console.log(cinza(`  log do Metro: ${log}`));

  for (let i = 0; i < 60; i++) {
    await dormir(2000);
    if (await metroNoAr()) {
      ok(`Metro no ar na porta ${PORTA_METRO}`);
      return;
    }
  }
  faltou(`O Metro não subiu na porta ${PORTA_METRO} em 2 minutos.`, [
    `Veja se a porta está ocupada: lsof -i :${PORTA_METRO}`,
    'Rode na mão para ver o erro: cd apps/mobile && npx expo start',
    `Log desta tentativa: ${log}`,
  ]);
}

// --------------------------------------------------------- capturar e provar

/** Assinatura da tela atual, antes de tentar navegar. */
function lerAntes(sim, ocr, temporario) {
  const png = `${temporario}.antes.png`;
  const r = rodar('xcrun', ['simctl', 'io', sim.udid, 'screenshot', '--type=png', png]);
  if (r.status !== 0) return null;
  const assin = assinatura(lerTela(ocr, png));
  if (existsSync(png)) unlinkSync(png);
  return assin;
}

async function capturar(sim, ocr, tela, temporario) {
  // Rotas extras não têm marcador — quem as passa na linha de comando conhece
  // a tela, o script não. Sem prova nenhuma, um deep link que não navega
  // salvaria a tela anterior com o nome da rota pedida: exatamente o defeito
  // que este arquivo existe para não repetir. Então guarda-se a tela de antes
  // e exige-se que ela tenha mudado.
  const antes = tela.marcadores ? null : lerAntes(sim, ocr, temporario);

  const url = tela.rota ? `${ESQUEMA}://${tela.rota}` : `${ESQUEMA}://`;
  rodar('xcrun', ['simctl', 'openurl', sim.udid, url]);
  await dormir(Number(process.env.QUIBLY_ESPERA || 4000));

  const r = rodar('xcrun', ['simctl', 'io', sim.udid, 'screenshot', '--type=png', temporario]);
  if (r.status !== 0) {
    faltou(`Falhou ao tirar o print de "${tela.arquivo}": ${r.stderr.trim()}`, [
      'Confira que o simulador está com a janela aberta (open -a Simulator).',
    ]);
  }

  const texto = lerTela(ocr, temporario);

  // Sinal duro: o router recebeu a URL e não achou rota para ela.
  if (texto.minusculo.includes('unmatched route')) {
    return {
      ok: false,
      motivo: `a rota "${tela.rota}" não existe (o app mostrou "Unmatched Route")`,
      texto,
    };
  }

  if (!tela.marcadores) {
    if (antes !== null && assinatura(texto) === antes) {
      return {
        ok: false,
        motivo: `o deep link "${tela.rota}" não navegou — a tela continuou exatamente a mesma`,
        texto,
      };
    }
    return { ok: true, texto, semProva: true };
  }

  const bateu = tela.marcadores.find((m) => texto.minusculo.includes(m.toLowerCase()));
  if (!bateu) {
    return {
      ok: false,
      motivo: `a tela que apareceu não é "${tela.descricao}" — nenhum dos marcadores [${tela.marcadores.join(', ')}] está nela`,
      texto,
    };
  }
  return { ok: true, texto, marcador: bateu };
}

// -------------------------------------------------------------------- main

async function main() {
  const extras = process.argv.slice(2).filter((a) => !a.startsWith('-'));

  console.log(`\n${azul('print-app')} — subindo o Quibly no simulador iOS\n`);

  exigirMacComXcode();
  exigirAmbienteDoApp();
  const ocr = garantirOcr();

  const sim = escolherSimulador();
  ligarSimulador(sim);
  instalar(sim);
  await garantirMetro();

  passo('abrindo o app…');
  const lanc = rodar('xcrun', ['simctl', 'launch', sim.udid, BUNDLE_ID]);
  if (lanc.status !== 0) {
    faltou(`O app não abriu: ${lanc.stderr.trim()}`, [
      `xcrun simctl uninstall ${sim.udid} ${BUNDLE_ID} e rode de novo`,
    ]);
  }
  console.log(cinza('  esperando o bundle do Metro (primeira vez demora)…'));
  await dormir(Number(process.env.QUIBLY_ESPERA_BOOT || 25000));

  mkdirSync(DESTINO, { recursive: true });

  const telas = [
    ...TELAS_PADRAO,
    ...extras.map((rota) => ({
      rota,
      arquivo: rota.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, ''),
      descricao: `rota extra: ${rota}`,
      marcadores: null,
    })),
  ];

  console.log('');
  const temporario = join(tmpdir(), `quibly-print-${process.pid}.png`);
  const falhas = [];
  const sujos = [];
  let salvos = 0;

  for (const tela of telas) {
    if (INTOCAVEIS.test(tela.arquivo)) {
      faltou(`O nome "${tela.arquivo}" é reservado — arquivos 00-ANTES-* são o único registro do visual anterior e não podem ser sobrescritos.`, [
        'Use outro nome de rota/arquivo.',
      ]);
    }

    // Enquanto vários agentes editam a mesma árvore, o Metro recarrega o bundle
    // sem avisar e o app volta para a raiz no meio da captura — foi assim que
    // `precos` saiu mostrando a lista de salas. Não é defeito da tela, é uma
    // corrida; a resposta certa é tentar de novo, não falhar na primeira.
    let r;
    for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
      r = await capturar(sim, ocr, tela, temporario);
      if (r.ok || tentativa === TENTATIVAS) break;
      aviso(`  ${tela.arquivo}: ${r.motivo} — tentando de novo (${tentativa}/${TENTATIVAS - 1})`);
      if (existsSync(temporario)) unlinkSync(temporario);
      await dormir(5000);
    }

    const destino = join(DESTINO, `${r.ok ? '' : 'FALHOU-'}${tela.arquivo}.png`);
    renameSync(temporario, destino);

    if (r.ok) {
      salvos++;
      const prova = r.semProva
        ? cinza('(sem marcador — rota extra)')
        : cinza(`("${r.marcador}" na tela)`);
      ok(`${tela.descricao} → ${cinza(destino.replace(RAIZ + '/', ''))} ${prova}`);
    } else {
      falhas.push({ tela, motivo: r.motivo, texto: r.texto.bruto });
      console.log(`${vermelho('✗')} ${tela.descricao}: ${r.motivo}`);
      console.log(cinza(`    salvo como FALHOU-${tela.arquivo}.png para você ver o que apareceu`));
    }

    // O LogBox do Metro empilha avisos de desenvolvimento exatamente sobre a
    // tab bar — que é elemento de design a ser julgado. Não dá para dispensar
    // sem tocar em código de app (ver cabeçalho), então o mínimo honesto é
    // dizer em quais prints o overlay está, para ninguém julgar o que ele cobre.
    const overlay = SUJEIRA_DE_DEV.filter(({ marca }) => r.texto.minusculo.includes(marca));
    if (overlay.length) {
      sujos.push({ arquivo: tela.arquivo, quais: overlay.map((o) => o.nome).join(', ') });
      aviso(`  overlay de desenvolvimento sobre este print: ${overlay.map((o) => o.nome).join(', ')}`);
    }
  }

  if (existsSync(temporario)) unlinkSync(temporario);

  console.log(`\n${verde(`${salvos} prints conferidos`)} em docs/referencia/estado-atual/`);

  if (sujos.length) {
    console.log(`\n${amarelo('Overlay de desenvolvimento cobrindo parte destes prints:')}`);
    for (const s of sujos) console.log(`  ${amarelo('!')} ${s.arquivo}.png — ${s.quais}`);
    console.log(
      cinza(
        '  É o LogBox do Metro, não o app. Ele se empilha sobre a tab bar.\n' +
          '  Suprimir exige uma linha em código de app (fora do escopo deste script):\n' +
          "  em apps/mobile/app/_layout.tsx, junto do LogBox.ignoreLogs já existente:\n" +
          "    if (process.env.EXPO_PUBLIC_SEM_LOGBOX === '1') LogBox.ignoreAllLogs();\n" +
          '  e capturar com EXPO_PUBLIC_SEM_LOGBOX=1.',
      ),
    );
  }

  if (falhas.length) {
    console.log(`\n${vermelho(`${falhas.length} tela(s) não puderam ser provadas:`)}\n`);
    for (const f of falhas) {
      console.log(`  ${vermelho('✗')} ${f.tela.arquivo} — ${f.motivo}`);
      console.log(cinza(`      o que o OCR leu: ${f.texto.split('\n').slice(0, 4).join(' / ')}`));
    }
    console.log(
      `\n${amarelo('Nenhum destes virou print com nome de tela.')} Um arquivo com nome errado\n` +
        'parece prova e engana quem julga design por ele — por isso saem como FALHOU-*.\n' +
        'Se a copy da tela mudou, atualize `marcadores` em scripts/print-app.mjs.\n',
    );
    process.exit(1);
  }

  console.log(cinza('\n  Telas que dependem de id entram assim:'));
  console.log(cinza('    npm run print:ios -- league/room/<id> league/feed/<id>\n'));
}

main().catch((erro) => {
  faltou(`Erro inesperado: ${erro.message}`, [
    'Rode com QUIBLY_ESPERA=8000 se a máquina estiver lenta.',
    'Se persistir, cole a mensagem acima no relatório.',
  ]);
});
