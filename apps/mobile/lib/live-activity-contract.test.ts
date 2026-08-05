import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ler = (caminho: string) =>
  readFileSync(new URL(caminho, import.meta.url).pathname, 'utf8');

/** Compilado dentro do **app**, pelo autolinking do módulo Expo. */
const noApp = '../modules/study-timer/ios/StudyTimerAttributes.swift';
/** Compilado dentro da **extensão**, pelo `@bacons/apple-targets`. */
const noWidget = '../targets/widget/StudyTimerAttributes.swift';

/**
 * `StudyTimerAttributes` é compilado duas vezes — uma no app, outra no widget —
 * e o ActivityKit casa os dois lados pelo **nome do tipo**, não pelo módulo.
 *
 * Na prática funciona, e é o arranjo que a maioria dos projetos usa. O que ele
 * tem de perigoso é o modo de falhar: se as duas cópias divergirem em um campo,
 * **não há erro de compilação**. Os dois targets compilam, o app pede a
 * atividade, e o sistema a recusa em silêncio — o widget simplesmente não
 * aparece. É indistinguível de "Live Activity não implementada", que é
 * exatamente o estado do qual estamos saindo.
 *
 * O plugin caseiro evitava isso copiando o arquivo a cada `prebuild`. Com o
 * `@bacons/apple-targets` a pasta do target é versionada, então a cópia é real
 * e pode divergir. Este teste troca a falha silenciosa por uma vermelha.
 *
 * Se ele falhar: copie o arquivo do módulo para `targets/widget/`, não o
 * contrário — o módulo é a fonte, porque é ele que o app usa para abrir e
 * atualizar a atividade.
 */
describe('o contrato da Live Activity é o mesmo dos dois lados', () => {
  it('keeps the app and widget copies of StudyTimerAttributes byte-identical', () => {
    expect(ler(noWidget)).toBe(ler(noApp));
  });

  it('still declares the fields the widget renders', () => {
    // Uma salvaguarda contra o teste acima virar tautologia: se alguém apagar o
    // conteúdo dos dois arquivos, eles continuam idênticos e continuam errados.
    const contrato = ler(noApp);
    expect(contrato).toContain('struct StudyTimerAttributes');
    expect(contrato).toContain('ContentState');
  });
});
