import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * O identificador do AdMob existe em **dois lugares**, e os dois vão para a loja.
 *
 * `app.json` é a fonte; `ios/Quibly/Info.plist` é o que o app realmente lê. Num
 * projeto Expo normal o segundo é gerado do primeiro — mas `ios/` está
 * versionado aqui (por causa das extensões de foco e do widget), e por isso o
 * EAS **não roda `prebuild`**. Mexer só no `app.json` não muda nada no build.
 *
 * Foi o que quase aconteceu em 10/08: o `app.json` já tinha o ID real e o
 * `Info.plist` continuava com o de teste do Google. O app teria ido para a
 * revisão da Apple servindo anúncio de teste — que não rende nada e, pior, não
 * conta como veiculação para a conta do AdMob, que está a menos de um mês de
 * ser desativada por inatividade.
 *
 * É o mesmo modo de falha do preço e da contagem de dias: duas fontes para o
 * mesmo fato, divergindo em silêncio. Aqui o silêncio custa a receita inteira.
 */

const raiz = join(__dirname, '..');
const ler = (caminho: string) => readFileSync(join(raiz, caminho), 'utf8');

/** O publisher público de teste do Google. Serve anúncio para qualquer um. */
const TESTE = '3940256099942544';
/** O nosso, o mesmo de `apps/web/public/app-ads.txt`. */
const NOSSO = '7106022757613059';

describe('AdMob — o identificador que vai para a loja', () => {
  const appJson = ler('app.json');
  const infoPlist = ler('ios/Quibly/Info.plist');

  const idDoAppJson = /"iosAppId":\s*"([^"]+)"/.exec(appJson)?.[1];
  const idDoPlist = /<key>GADApplicationIdentifier<\/key>\s*<string>([^<]+)<\/string>/
    .exec(infoPlist)?.[1];

  it('está declarado nos dois lugares', () => {
    expect(idDoAppJson).toBeDefined();
    expect(idDoPlist).toBeDefined();
  });

  it('os dois concordam — é o `Info.plist` que o build usa', () => {
    expect(idDoPlist).toBe(idDoAppJson);
  });

  it('no iOS não é o publisher de teste do Google', () => {
    // Android segue no de teste de propósito: não há app Android registrado no
    // AdMob, e um ID de teste é melhor que um ID errado. Quando o Android for
    // ao ar, este teste ganha a linha dele.
    expect(idDoPlist).not.toContain(TESTE);
    expect(idDoPlist).toContain(NOSSO);
  });

  it('o publisher é o mesmo do app-ads.txt, senão o inventário não se verifica', () => {
    const appAds = readFileSync(
      join(raiz, '../../apps/web/public/app-ads.txt'),
      'utf8',
    );
    // Só as linhas de valor. O arquivo documenta o formato num comentário que
    // contém um `pub-0000000000000000` de exemplo — ler o arquivo inteiro casa
    // com o exemplo antes da linha real, que é o que este teste pegou de cara.
    const doArquivo = appAds
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => /pub-(\d+)/.exec(l)?.[1])
      .find(Boolean);
    expect(doArquivo).toBe(NOSSO);
    expect(idDoPlist).toContain(doArquivo!);
  });
});
