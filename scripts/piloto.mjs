#!/usr/bin/env node
/**
 * piloto — navega o app no simulador **por toque**, e prova cada passo.
 *
 * O `print-app.mjs` chega às telas por deep link. Isso deixou de fora tudo que
 * depende de um id que só existe depois de o servidor responder (a sala, o
 * feed, o post) e tudo que não tem rota (a biblioteca é uma aba escondida).
 * Este script fecha esse buraco: ele lê a tela, acha o rótulo, e toca nele.
 *
 *   node scripts/piloto.mjs ver
 *   node scripts/piloto.mjs tocar "Suas salas" + esperar 1500 + ver
 *   node scripts/piloto.mjs salvar feed-da-sala "Nova sala"
 *
 * Vários comandos numa chamada só, separados por `+`. Cada chamada custa uma
 * calibração; encadear é mais rápido e, principalmente, mantém a janela em foco
 * entre um toque e o outro.
 *
 * ---------------------------------------------------------------------------
 * A parte difícil é a calibração, e ela é a razão de este arquivo existir.
 *
 * O print do simulador vem em PIXELS DO APARELHO (1206×2622 num iPhone 17). O
 * toque do Quartz vai em PONTOS DA TELA DO MAC. Entre os dois há três
 * transformações que ninguém acerta de cabeça: a janela do Simulador encolhe o
 * aparelho por um fator que muda quando o usuário arrasta o canto; a janela tem
 * uma barra de título de altura não documentada; e a tela do Mac pode ser
 * Retina, com 2 pixels por ponto.
 *
 * Chutar esses três números dá um toque que cai perto — e "perto" aqui navega
 * para a tela errada sem avisar. Então nada é chutado: captura-se a janela do
 * Mac E o print do aparelho, lê-se o texto dos dois, e as palavras que aparecem
 * nos dois viram pares de pontos. Duas correspondências bastam para resolver a
 * escala e o deslocamento; o script exige três e conta o erro que sobrou. Se o
 * erro passar de 4pt, ele para em vez de tocar às cegas.
 *
 * Efeito colateral bom: a calibração só fecha se a janela capturada for mesmo a
 * do aparelho que está sendo fotografado. Com dois simuladores ligados e as
 * janelas empilhadas — que é o estado desta máquina — trocar um pelo outro
 * deixa de ser um erro silencioso e vira uma parada com mensagem.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DESTINO = join(RAIZ, 'docs', 'referencia', 'estado-atual');
const FONTE_OCR = join(RAIZ, 'scripts', 'ocr-tela.swift');
const TOCAR = join(RAIZ, 'scripts', 'tocar.swift');
const TEMP = join(tmpdir(), `quibly-piloto-${process.pid}`);

/** Mesma reserva do print-app: o registro do visual anterior não se recaptura. */
const INTOCAVEIS = /^00-ANTES-/;

/** Erro tolerado na calibração, em pontos de tela. Um alvo tem 44pt. */
const ERRO_MAXIMO = 4;

const cores = process.stdout.isTTY;
const azul = (t) => (cores ? `\x1b[34m${t}\x1b[0m` : t);
const verde = (t) => (cores ? `\x1b[32m${t}\x1b[0m` : t);
const vermelho = (t) => (cores ? `\x1b[31m${t}\x1b[0m` : t);
const cinza = (t) => (cores ? `\x1b[90m${t}\x1b[0m` : t);

function faltou(oQue, comoResolver = []) {
  console.error(`\n${vermelho('✗ ' + oQue)}`);
  if (comoResolver.length) {
    console.error('\nPara destravar:');
    comoResolver.forEach((l, i) => console.error(`  ${i + 1}. ${l}`));
  }
  console.error('');
  process.exit(1);
}

const rodar = (cmd, args, op = {}) => spawnSync(cmd, args, { encoding: 'utf8', ...op });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const normalizar = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// ------------------------------------------------------------------ o OCR

function garantirOcr() {
  const carimbo = Math.floor(statSync(FONTE_OCR).mtimeMs);
  const binario = join(tmpdir(), `quibly-ocr-${carimbo}`);
  if (existsSync(binario)) return binario;
  const r = rodar('swiftc', ['-O', '-o', binario, FONTE_OCR]);
  if (r.status !== 0) {
    faltou(`Não deu para compilar ${FONTE_OCR}: ${(r.stderr || '').trim().split('\n')[0]}`, [
      'xcode-select -p  # confira que o Xcode completo está selecionado',
    ]);
  }
  return binario;
}

/** `[{ x, y, largura, altura, texto, centro: {x, y} }]`, em pixels da imagem. */
function lerCaixas(ocr, png) {
  const r = rodar(ocr, [png, '--caixas']);
  if (r.status !== 0) faltou(`O leitor de tela falhou em ${png}: ${(r.stderr || '').trim()}`);
  return r.stdout
    .split('\n')
    .filter(Boolean)
    .map((linha) => {
      const [x, y, largura, altura, ...resto] = linha.split('\t');
      const texto = resto.join('\t');
      return {
        x: +x, y: +y, largura: +largura, altura: +altura, texto,
        centro: { x: +x + +largura / 2, y: +y + +altura / 2 },
      };
    });
}

// ------------------------------------------------------------- o simulador

function acharSimulador() {
  const pedido = process.env.QUIBLY_SIM;
  const saida = rodar('xcrun', ['simctl', 'list', 'devices', 'booted', '--json']).stdout;
  const todos = [];
  for (const lista of Object.values(JSON.parse(saida).devices)) todos.push(...lista);
  if (!todos.length) {
    faltou('Nenhum simulador ligado.', ['npm run print:ios  # sobe o simulador e instala o app']);
  }
  if (pedido) {
    const achado = todos.find((d) => d.udid === pedido || d.name === pedido);
    if (!achado) faltou(`QUIBLY_SIM="${pedido}" não corresponde a nenhum simulador ligado.`);
    return achado;
  }
  // Com mais de um ligado, o certo é o que tem o app — não o primeiro da lista.
  const comApp = todos.filter(
    (d) => rodar('xcrun', ['simctl', 'get_app_container', d.udid, 'com.quibly.app']).status === 0,
  );
  if (!comApp.length) {
    faltou(`O app com.quibly.app não está instalado em nenhum dos ${todos.length} simuladores ligados.`, [
      'npm run print:ios  # instala e abre o app',
    ]);
  }
  if (comApp.length > 1) {
    faltou(`Dois simuladores ligados têm o app: ${comApp.map((d) => d.name).join(', ')}.`, [
      `Escolha um: QUIBLY_SIM="${comApp[0].name}" node scripts/piloto.mjs …`,
      `Ou desligue o outro: xcrun simctl shutdown ${comApp[1].udid}`,
    ]);
  }
  return comApp[0];
}

function print(sim, destino) {
  const r = rodar('xcrun', ['simctl', 'io', sim.udid, 'screenshot', '--type=png', destino]);
  if (r.status !== 0) faltou(`Falhou ao tirar o print: ${(r.stderr || '').trim()}`);
  return destino;
}

function tamanhoPng(png) {
  const b = readFileSync(png);
  // Cabeçalho IHDR: 8 bytes de assinatura, 4 de tamanho, 4 de tipo, aí W e H.
  return { largura: b.readUInt32BE(16), altura: b.readUInt32BE(20) };
}

function swiftTocar(args) {
  const r = rodar('swift', [TOCAR, ...args]);
  if (r.status !== 0) faltou(`scripts/tocar.swift ${args[0]} falhou:\n${(r.stderr || r.stdout).trim()}`);
  return r.stdout.trim();
}

// ------------------------------------------------------------- a calibração

const CACHE = join(tmpdir(), 'quibly-piloto-calibracao.json');

/**
 * Resolve `pontoDaTela = k * pixelDoAparelho + deslocamento` comparando o que
 * está escrito na janela do Mac com o que está escrito no print do aparelho.
 */
function calibrar(sim, ocr, janela) {
  const doAparelho = print(sim, `${TEMP}-cal-aparelho.png`);
  const daJanela = `${TEMP}-cal-janela.png`;
  const cap = rodar('screencapture', ['-x', '-o', `-l${janela.numero}`, daJanela]);
  if (cap.status !== 0 || !existsSync(daJanela)) {
    faltou('Não deu para capturar a janela do Simulador com `screencapture`.', [
      'System Settings → Privacy & Security → Screen & System Audio Recording: habilite o app que roda este script.',
    ]);
  }

  const tamJanela = tamanhoPng(daJanela);
  // Quantos pixels da imagem cabem num ponto de tela. 2 num Mac Retina.
  const pixelPorPonto = tamJanela.largura / janela.largura;

  const caixasAparelho = lerCaixas(ocr, doAparelho);
  const caixasJanela = lerCaixas(ocr, daJanela);

  // Só serve o que aparece UMA vez de cada lado: um rótulo repetido casaria com
  // a ocorrência errada e envenenaria o ajuste sem dar erro.
  const contar = (caixas) => {
    const mapa = new Map();
    for (const c of caixas) {
      const chave = normalizar(c.texto);
      mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
    }
    return mapa;
  };
  const nA = contar(caixasAparelho);
  const nJ = contar(caixasJanela);

  const pares = [];
  for (const a of caixasAparelho) {
    const chave = normalizar(a.texto);
    if (chave.length < 3) continue;
    if (nA.get(chave) !== 1 || nJ.get(chave) !== 1) continue;
    const j = caixasJanela.find((c) => normalizar(c.texto) === chave);
    if (j) pares.push({ a: a.centro, j: j.centro, texto: a.texto });
  }

  if (pares.length < 3) {
    faltou(
      `A calibração precisa de 3 trechos de texto visíveis nos dois lados e só achou ${pares.length}.`,
      [
        'Deixe a janela do aparelho inteira visível, sem nada por cima e sem sair da tela.',
        'Se o app estiver numa tela quase sem texto, navegue para uma com rótulos e tente de novo.',
        `Conferir na mão: swift scripts/ocr-tela.swift ${doAparelho} --caixas`,
      ],
    );
  }

  // Escala uniforme + deslocamento, por mínimos quadrados em cada eixo. Uniforme
  // de propósito: o Simulador nunca deforma o aparelho, então uma escala por
  // eixo só serviria para o ruído do OCR entrar no resultado.
  const ajustar = (usados) => {
    const porEixo = (eixo) => {
      const xs = usados.map((p) => p.a[eixo]);
      const ys = usados.map((p) => p.j[eixo]);
      const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
      const my = ys.reduce((s, v) => s + v, 0) / ys.length;
      let num = 0, den = 0;
      for (let i = 0; i < xs.length; i++) {
        num += (xs[i] - mx) * (ys[i] - my);
        den += (xs[i] - mx) ** 2;
      }
      return { escala: den === 0 ? 0 : num / den, media: { a: mx, j: my }, largura: Math.max(...xs) - Math.min(...xs) };
    };
    const fx = porEixo('x');
    const fy = porEixo('y');
    // Um só fator: o eixo com mais espalhamento manda, porque é o mais confiável.
    const escala = fy.largura > fx.largura ? fy.escala : fx.escala;
    return {
      k: escala / pixelPorPonto,
      ox: janela.x + (fx.media.j - escala * fx.media.a) / pixelPorPonto,
      oy: janela.y + (fy.media.j - escala * fy.media.a) / pixelPorPonto,
    };
  };

  const erroDe = (mapa, p) =>
    Math.hypot(
      mapa.k * p.a.x + mapa.ox - (janela.x + p.j.x / pixelPorPonto),
      mapa.k * p.a.y + mapa.oy - (janela.y + p.j.y / pixelPorPonto),
    );

  // Um par ruim envenena o ajuste inteiro, e eles acontecem: entre o print do
  // aparelho e a captura da janela passam uns 300ms, e nesse intervalo a tela
  // pode terminar de rolar, um contador pode virar, um toast pode sumir. O par
  // fica com a mesma palavra em dois lugares diferentes. Descartar o pior e
  // reajustar resolve; só se rende quando sobram menos de 3 pares — aí não é
  // ruído, é a janela errada.
  let usados = pares;
  let mapa = ajustar(usados);
  let pior = Math.max(...usados.map((p) => erroDe(mapa, p)));
  while (pior > ERRO_MAXIMO && usados.length > 3) {
    const erros = usados.map((p) => erroDe(mapa, p));
    const piorIndice = erros.indexOf(Math.max(...erros));
    usados = usados.filter((_, i) => i !== piorIndice);
    mapa = ajustar(usados);
    pior = Math.max(...usados.map((p) => erroDe(mapa, p)));
  }

  if (!(mapa.k > 0) || pior > ERRO_MAXIMO) {
    faltou(
      `A calibração não fechou: sobrou um erro de ${pior.toFixed(1)}pt (o teto é ${ERRO_MAXIMO}pt).`,
      [
        'A causa mais comum é a janela capturada não ser a do aparelho fotografado — com dois simuladores ligados as janelas se empilham.',
        `Janela usada: "${janela.nome}". Simulador fotografado: "${sim.name}".`,
        'Se forem aparelhos diferentes, desligue o que sobra: xcrun simctl shutdown <udid>',
        'Outra causa: algo por cima da janela do Simulador (Dock, outra janela, notificação).',
      ],
    );
  }

  unlinkSync(doAparelho);
  unlinkSync(daJanela);
  return { ...mapa, pares: usados.length, descartados: pares.length - usados.length, erro: pior };
}

function calibracao(sim, ocr) {
  swiftTocar(['frente', sim.name]);
  const janela = JSON.parse(swiftTocar(['janela', sim.name]));

  if (existsSync(CACHE)) {
    try {
      const guardado = JSON.parse(readFileSync(CACHE, 'utf8'));
      const mesma =
        guardado.janela.nome === janela.nome &&
        guardado.janela.x === janela.x && guardado.janela.y === janela.y &&
        guardado.janela.largura === janela.largura && guardado.janela.altura === janela.altura &&
        guardado.sim === sim.udid;
      // A janela é a mesma, no mesmo lugar, do mesmo aparelho: a conta não muda.
      if (mesma) return { ...guardado.mapa, janela, reaproveitada: true };
    } catch { /* cache estragado não é motivo de parar */ }
  }

  const mapa = calibrar(sim, ocr, janela);
  writeFileSync(CACHE, JSON.stringify({ sim: sim.udid, janela, mapa }));
  return { ...mapa, janela };
}

// -------------------------------------------------------------- os comandos

/** Estado de uma chamada: tudo que os comandos compartilham. */
const ctx = {};

function paraTela(px, py) {
  return { x: ctx.mapa.k * px + ctx.mapa.ox, y: ctx.mapa.k * py + ctx.mapa.oy };
}

/**
 * Quanto tempo o botão fica apertado. 250ms, não um clique seco.
 *
 * Custou meia manhã descobrir: um clique de 70ms **não aciona botão dentro de
 * lista rolável**. A `UIScrollView` segura o toque por um instante para decidir
 * se aquilo vai virar rolagem (`delaysContentTouches`), e um toque que já
 * terminou antes desse prazo nunca chega ao `Pressable`. O sintoma engana — a
 * lista rolava, a barra de abas respondia, telas sem rolagem respondiam, e só a
 * linha da sala parecia "quebrada". Não estava: era o toque que era curto
 * demais para uma lista.
 */
const APERTO_MS = Number(process.env.QUIBLY_APERTO || 250);

async function tocarPixel(px, py, rotulo) {
  const p = paraTela(px, py);
  // Sempre reativar: qualquer coisa que roube o foco entre um comando e o
  // outro (o Metro abrindo o navegador, o Xcode terminando um build) faria o
  // clique seguinte ser gasto só para trazer a janela de volta.
  swiftTocar(['frente', ctx.sim.name]);
  // A janela pode ter se mexido desde a calibração — basta alguém arrastar a
  // barra de título, ou o próprio Simulador reposicionar ao trocar de tela. Com
  // o mapa velho o clique sai FORA da janela e acerta outro aplicativo, sem
  // erro nenhum. Conferir custa milissegundos.
  const agora = JSON.parse(swiftTocar(['janela', ctx.sim.name]));
  const j = ctx.mapa.janela;
  if (agora.x !== j.x || agora.y !== j.y || agora.largura !== j.largura || agora.altura !== j.altura) {
    faltou('A janela do Simulador se moveu depois da calibração — o toque cairia fora dela.', [
      `Antes: ${j.x},${j.y} ${j.largura}×${j.altura}. Agora: ${agora.x},${agora.y} ${agora.largura}×${agora.altura}.`,
      'Rode o comando de novo: a calibração se refaz sozinha com a posição nova.',
      'Se ela se move sempre, deixe a janela quieta enquanto o piloto trabalha.',
    ]);
  }
  swiftTocar(['pressionar', p.x.toFixed(1), p.y.toFixed(1), String(APERTO_MS)]);
  console.log(`${azul('▸')} toque em ${rotulo} ${cinza(`(aparelho ${Math.round(px)},${Math.round(py)} → tela ${p.x.toFixed(0)},${p.y.toFixed(0)})`)}`);
  await dormir(Number(process.env.QUIBLY_APOS_TOQUE || 1200));
}

function telaAgora() {
  const png = print(ctx.sim, `${TEMP}-agora.png`);
  const caixas = lerCaixas(ctx.ocr, png);
  return { png, caixas, texto: caixas.map((c) => c.texto).join('\n') };
}

function acharTexto(caixas, alvo) {
  const chave = normalizar(alvo);
  const exatos = caixas.filter((c) => normalizar(c.texto) === chave);
  if (exatos.length) return exatos;
  return caixas.filter((c) => normalizar(c.texto).includes(chave));
}

const comandos = {
  async ver() {
    const { caixas } = telaAgora();
    console.log(cinza(`  ${caixas.length} trechos na tela (x,y em pixels do aparelho):`));
    for (const c of caixas) {
      console.log(`  ${String(Math.round(c.centro.x)).padStart(5)},${String(Math.round(c.centro.y)).padEnd(5)}  ${c.texto}`);
    }
  },

  /** `tocar "rótulo" [ocorrência]` — a ocorrência é 1-based, padrão a primeira. */
  async tocar(alvo, qual = '1') {
    const { caixas } = telaAgora();
    const achados = acharTexto(caixas, alvo);
    if (!achados.length) {
      faltou(`"${alvo}" não está na tela.`, [
        'O que está: ' + caixas.map((c) => c.texto).join(' / '),
        'Rode `node scripts/piloto.mjs ver` para as coordenadas.',
      ]);
    }
    const escolhido = achados[Number(qual) - 1];
    if (!escolhido) {
      faltou(`"${alvo}" aparece ${achados.length} vez(es) e você pediu a ${qual}ª.`);
    }
    await tocarPixel(escolhido.centro.x, escolhido.centro.y, `"${escolhido.texto}"`);
  },

  /**
   * `tocar-frac <fx> <fy>` — fração da tela, 0–1. Para o que não tem texto:
   * botão redondo com ícone, miniatura, aba escondida.
   */
  async 'tocar-frac'(fx, fy) {
    const png = print(ctx.sim, `${TEMP}-frac.png`);
    const { largura, altura } = tamanhoPng(png);
    unlinkSync(png);
    await tocarPixel(largura * Number(fx), altura * Number(fy), `${fx} × ${fy} da tela`);
  },

  /** `tocar-xy <x> <y>` em pixels do aparelho, como o `ver` imprime. */
  async 'tocar-xy'(x, y) {
    await tocarPixel(Number(x), Number(y), `${x},${y}`);
  },

  /**
   * `abaixo-de "rótulo" <dy>` — toca `dy` pixels abaixo do centro de um texto.
   * O jeito de acertar o alvo que não tem rótulo mas tem vizinho: o card de uma
   * sala, a miniatura de um post.
   */
  async 'abaixo-de'(alvo, dy) {
    const { caixas } = telaAgora();
    const achados = acharTexto(caixas, alvo);
    if (!achados.length) faltou(`"${alvo}" não está na tela.`);
    await tocarPixel(achados[0].centro.x, achados[0].centro.y + Number(dy), `${dy}px abaixo de "${achados[0].texto}"`);
  },

  async rolar(quanto = '600') {
    const png = print(ctx.sim, `${TEMP}-rolar.png`);
    const { largura, altura } = tamanhoPng(png);
    unlinkSync(png);
    const meio = paraTela(largura / 2, altura / 2);
    const destino = paraTela(largura / 2, altura / 2 - Number(quanto));
    swiftTocar(['frente', ctx.sim.name]);
    swiftTocar(['arrastar', meio.x.toFixed(1), meio.y.toFixed(1), destino.x.toFixed(1), destino.y.toFixed(1), '450']);
    console.log(`${azul('▸')} rolou ${quanto}px`);
    await dormir(900);
  },

  async esperar(ms = '1000') {
    await dormir(Number(ms));
  },

  /**
   * `salvar <arquivo> [marcador…]` — só vira PNG com nome de tela se o marcador
   * estiver escrito nela. Mesma regra do `print-app.mjs`, e pelo mesmo motivo:
   * um arquivo com nome errado parece prova.
   */
  async salvar(arquivo, ...marcadores) {
    if (INTOCAVEIS.test(arquivo)) {
      faltou(`"${arquivo}" é reservado — os 00-ANTES-* são o único registro do visual anterior.`);
    }
    const { png, texto } = telaAgora();
    const lido = normalizar(texto);
    const bateu = marcadores.find((m) => lido.includes(normalizar(m)));
    mkdirSync(DESTINO, { recursive: true });
    if (marcadores.length && !bateu) {
      const destino = join(DESTINO, `FALHOU-${arquivo}.png`);
      renameSync(png, destino);
      console.log(`${vermelho('✗')} nenhum de [${marcadores.join(', ')}] está na tela — salvo como ${cinza(`FALHOU-${arquivo}.png`)}`);
      console.log(cinza(`    o que o OCR leu: ${texto.split('\n').slice(0, 6).join(' / ')}`));
      process.exitCode = 1;
      return;
    }
    const destino = join(DESTINO, `${arquivo}.png`);
    renameSync(png, destino);
    console.log(`${verde('✓')} ${arquivo}.png ${cinza(bateu ? `("${bateu}" na tela)` : '(sem marcador pedido)')}`);
  },
};

// -------------------------------------------------------------------- main

async function main() {
  const bruto = process.argv.slice(2);
  if (!bruto.length) {
    console.log(`
${azul('piloto')} — navega o app por toque e prova cada passo.

  ver                        lê a tela e imprime cada trecho com sua coordenada
  tocar <texto> [n]          toca no rótulo (n = qual ocorrência, padrão 1)
  tocar-xy <x> <y>           toca num pixel do aparelho
  tocar-frac <fx> <fy>       toca numa fração da tela (0–1) — para ícone sem texto
  abaixo-de <texto> <dy>     toca dy pixels abaixo de um rótulo
  rolar [px]                 rola a lista para cima
  esperar [ms]
  salvar <arquivo> [marcador…]   grava em docs/referencia/estado-atual/

Encadeie com ${azul('+')}:
  node scripts/piloto.mjs tocar "Suas salas" + esperar 2000 + salvar feed "Nova sala"
`);
    return;
  }

  // `+` separa comandos. Um argumento que precise do sinal literal passa como
  // "\\+" — não acontece hoje, mas o silêncio aqui seria confuso.
  const series = [[]];
  for (const arg of bruto) {
    if (arg === '+') series.push([]);
    else series[series.length - 1].push(arg === '\\+' ? '+' : arg);
  }

  ctx.ocr = garantirOcr();
  ctx.sim = acharSimulador();
  ctx.mapa = calibracao(ctx.sim, ctx.ocr);
  console.log(
    cinza(
      `  ${ctx.sim.name} · janela "${ctx.mapa.janela.nome}" · ` +
        (ctx.mapa.reaproveitada
          ? 'calibração reaproveitada'
          : `calibrada com ${ctx.mapa.pares} pares` +
            (ctx.mapa.descartados ? ` (${ctx.mapa.descartados} descartado(s))` : '') +
            `, erro ${ctx.mapa.erro.toFixed(1)}pt`),
    ),
  );

  for (const [nome, ...args] of series) {
    const fn = comandos[nome];
    if (!fn) faltou(`Comando desconhecido: "${nome}". Rode sem argumentos para a lista.`);
    await fn(...args);
  }

  for (const sufixo of ['-agora.png', '-frac.png', '-rolar.png']) {
    if (existsSync(TEMP + sufixo)) unlinkSync(TEMP + sufixo);
  }
}

main().catch((erro) => faltou(`Erro inesperado: ${erro.stack || erro.message}`));
