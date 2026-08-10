import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **O escudo não pode sobreviver à sessão.**
 *
 * É o requisito que organiza `FocoProfundoModule.swift`, e a primeira das
 * quatro garantias que ele lista mora aqui, do lado do JS: "a sessão acaba, o
 * JS chama `parar()`".
 *
 * Em 10/08 o dono do produto encontrou o furo. A garantia cobria só o fim
 * **explícito** — quem apertava encerrar em `active.tsx`. Quando a sessão
 * morria sozinha (cinco minutos sem rede e o servidor a varre), o timer parava,
 * a Live Activity sumia, a notificação era cancelada, e o escudo continuava de
 * pé. A pessoa perdia o progresso **e** ficava com o telefone trancado, sem
 * nada na tela ligando as duas coisas.
 *
 * Nenhuma das outras três garantias resolve esse caso: o relógio do sistema só
 * derruba no prazo original da sessão, a reconciliação na abertura concorda que
 * o escudo ainda vale, e o teto de quatro horas é rede de segurança — não é
 * comportamento aceitável.
 *
 * Este teste é de código-fonte de propósito. O que se quer garantir não é o
 * comportamento de um handler específico, é a **invariante**: se um caminho
 * declara a sessão morta, ele solta o escudo. Um handler novo amanhã — outra
 * forma de a sessão acabar — cai neste teste antes de chegar ao aparelho de
 * alguém.
 */

const fonte = readFileSync(
  join(__dirname, '../stores/session.store.ts'),
  'utf8',
);

/** Sem comentários: o texto explicativo cita os símbolos e daria falso positivo. */
const codigo = fonte
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

describe('o escudo do foco profundo', () => {
  it('a store sabe soltá-lo', () => {
    expect(codigo).toContain("from '../modules/foco-profundo/src'");
    expect(codigo).toMatch(/function soltarOEscudo/);
  });

  it('todo caminho que declara a sessão morta solta o escudo', () => {
    /*
     `isDisconnected: true` é a marca de "esta sessão acabou sem a pessoa
     mandar". Cada ocorrência precisa de um `soltarOEscudo()` no **mesmo** bloco.

     A primeira versão deste teste usava uma janela fixa de 400 caracteres, e
     era inútil: ao remover o `soltarOEscudo()` de um handler, a janela vazava
     para o handler seguinte e encontrava o dele. Passava verde com o defeito de
     volta — conferido.

     Agora a janela fecha no que vier primeiro: o fim do bloco (`},` no recuo
     dos handlers) ou a próxima morte de sessão. Assim um handler responde
     apenas por si.
    */
    const mortes = [...codigo.matchAll(/isDisconnected:\s*true/g)];
    expect(mortes.length).toBeGreaterThan(0);

    for (const m of mortes) {
      const resto = codigo.slice(m.index!);
      const fimDoBloco = resto.search(/\n\s{0,8}\},/);
      const proximaMorte = resto.slice(1).search(/isDisconnected:\s*true/);
      const limite = Math.min(
        ...[fimDoBloco, proximaMorte, 400].filter((n) => n > 0),
      );
      const bloco = resto.slice(0, limite);
      expect(
        bloco,
        `um caminho declara isDisconnected: true sem soltar o escudo — o telefone fica trancado`,
      ).toContain('soltarOEscudo()');
    }
  });

  it('o fim explícito continua soltando antes da rede', () => {
    /*
     Em `active.tsx` o `pararFoco()` vem **antes** do `endSession()`, e fora do
     `try`. Se a chamada falhar, a tela pede para tentar de novo — e derrubar o
     escudo só no sucesso deixaria os apps bloqueados exatamente quando o app
     está sem resposta. A ordem é a garantia; inverter passa despercebido.
    */
    const tela = readFileSync(
      join(__dirname, '../app/session/active.tsx'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');

    const solta = tela.indexOf('pararFoco()');
    const encerra = tela.indexOf('await endSession()');
    expect(solta).toBeGreaterThan(-1);
    expect(encerra).toBeGreaterThan(-1);
    expect(solta, 'pararFoco() precisa vir antes de endSession()').toBeLessThan(
      encerra,
    );
  });
});
