import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A Biblioteca Google Play Faturamento, que chega três dependências abaixo.
 *
 * ## O que aconteceu em 17/08
 *
 * A Google avisou, com prazo em 31/08: *"Faça upgrade para uma versão mais
 * recente da Biblioteca Google Play Faturamento para evitar que suas
 * atualizações sejam recusadas"*. O app estava na **7.1.1**, e o mínimo passou
 * a ser a 8.
 *
 * O número não aparece em nenhum arquivo nosso. Ele desce por uma corrente:
 *
 *   react-native-purchases 8.12.0        (o que declarávamos no package.json)
 *     -> purchases-hybrid-common 14.3.0  (fixado no build.gradle da lib)
 *       -> purchases 8.24.0
 *         -> billing 7.1.1               ← o número que a Google recusa
 *
 * Subir para `react-native-purchases` 10.7.1 troca a corrente inteira por
 * hybrid-common 18.30.0 -> purchases 10.16.1 -> **billing 8.3.0**.
 *
 * ## O que se conferiu antes de subir dois números maiores
 *
 * Um salto de major costuma quebrar API, e o iOS **já está publicado** vendendo
 * com essa biblioteca — quebrar lá para consertar o Android seria um mau
 * negócio. Então, antes:
 *
 * - As seis funções que `services/iap.ts` usa (`configure`, `getOfferings`,
 *   `getCustomerInfo`, `getStorefront`, `purchasePackage`, `restorePurchases`)
 *   e os três tipos foram procurados nos `.d.ts` da 10.7.1. Todos existem.
 * - O `.aar` da `purchases` 10.16.1 traz metadata Kotlin **1.8.0**, longe do
 *   teto de 2.2.0 do projeto — não repete o impasse que o SDK de anúncios criou
 *   no mesmo dia (ver [[admob-android]]).
 * - `tsc --noEmit` passou sem tocar em `services/iap.ts`.
 *
 * ## Por que um teste, e não só o commit
 *
 * O número que a Google audita está a três dependências de distância do nosso
 * `package.json`. Ninguém lendo `"react-native-purchases": "10.7.1"` sabe dizer
 * qual biblioteca de faturamento vai no binário — eu mesmo só descobri baixando
 * POMs do Maven. Um downgrade acidental, ou um `npm install` que resolva para
 * uma versão antiga, volta a 7.x sem aviso, e o preço é uma recusa da Play
 * depois do upload.
 *
 * Este teste não consulta a rede: ele guarda o **piso do pacote npm**, que é o
 * que temos localmente e o único elo que controlamos.
 */

const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

/**
 * A primeira `react-native-purchases` cuja corrente chega em billing 8.
 *
 * Medido, não estimado — traçando os POMs do Maven versão por versão:
 *
 *   |    npm | billing |
 *   |--------|---------|
 *   | 8.12.0 |   7.1.1 |
 *   |  9.0.0 |   8.0.0 |
 *   | 10.0.0 |   8.3.0 |
 *   | 10.7.1 |   8.3.0 |
 */
const PISO = 9;

describe('Biblioteca Google Play Faturamento', () => {
  it('a versão declarada de react-native-purchases traz billing 8+', () => {
    const declarada: string | undefined = pkg.dependencies?.['react-native-purchases'];
    expect(declarada, 'react-native-purchases saiu das dependências').toBeTruthy();

    const maior = Number(/(\d+)/.exec(declarada!)?.[1]);

    expect(
      maior >= PISO,
      `react-native-purchases ${declarada} traz a Biblioteca de Faturamento antiga.\n` +
        `Da major ${PISO} em diante a corrente chega em billing 8+, que é o mínimo\n` +
        'que a Play aceita desde 31/08/2026. Abaixo disso a atualização é recusada\n' +
        'depois do upload. Ver o cabeçalho deste arquivo.',
    ).toBe(true);
  });

  /**
   * A versão instalada tem de concordar com a declarada.
   *
   * `^8.0.0` no `package.json` com a 10 instalada passaria no teste acima e
   * mandaria a 8 para o build de outra máquina, onde o `npm install` resolve de
   * novo. O que vai para o binário é o que está instalado.
   */
  it('a versão instalada concorda com a declarada', () => {
    const instalada = JSON.parse(
      readFileSync(
        join(__dirname, '..', 'node_modules/react-native-purchases/package.json'),
        'utf8',
      ),
    ).version as string;

    expect(Number(instalada.split('.')[0])).toBeGreaterThanOrEqual(PISO);
  });
});
