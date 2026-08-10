/**
 * Converte as chaves da resposta da API de `snake_case` para `camelCase`.
 *
 * ## Por que isto existe
 *
 * A API tem um `SnakeCaseInterceptor` **global**: toda resposta HTTP sai com as
 * chaves em `snake_case`. É decisão dela, e boa — o app mobile e o WebSocket
 * usam a mesma conversão, então o mesmo objeto nunca chega com dois formatos.
 *
 * O painel admin, porém, foi escrito lendo `camelCase`: `avatarUrl`,
 * `flashcardSets`, `createdAt`, `_count.flashcardSets`. São 69 campos em 9
 * páginas, e nenhum deles existe na resposta.
 *
 * O modo de falha é traiçoeiro porque tem duas caras. Campo simples lido errado
 * vira `undefined` e a tela mostra vazio — parece dado faltando, não defeito.
 * Array lido errado vira `undefined` e o `.map()` derruba a página inteira,
 * que é o "erro na rota" relatado em 10/08.
 *
 * ## Por que aqui, e não nas 69 declarações
 *
 * Renomear campo por campo conserta o que existe hoje e não conserta a próxima
 * página que alguém escrever — e quem escreve vai continuar escrevendo
 * `camelCase`, porque é a convenção do TypeScript e é o que o resto deste
 * projeto usa. Uma conversão na borda torna a página certa por construção.
 *
 * É também a **inversa exata** de `transformKeys` da API. As duas juntas fazem
 * a fronteira ser invisível: o servidor pensa em `camelCase`, transmite em
 * `snake_case`, e o navegador volta a pensar em `camelCase`.
 *
 * ## O que deliberadamente não se converte
 *
 * `_count` já não tem maiúscula e atravessa intacto — mas o que está **dentro**
 * dele é convertido, porque `_count.flashcard_sets` precisa virar
 * `_count.flashcardSets`. Por isso a recursão não trata `_` como caso especial:
 * só o nome da chave é reescrito, e o valor sempre desce.
 */

/** `avatar_url` → `avatarUrl`. Um `_` isolado à esquerda é preservado. */
export function paraCamel(chave: string): string {
  // A âncora `[a-z0-9]` antes do `_` é o que protege `_count`: sem ela,
  // `_count` viraria `Count` e o campo desapareceria.
  return chave.replace(/([a-z0-9])_([a-z])/g, (_, antes: string, depois: string) =>
    `${antes}${depois.toUpperCase()}`,
  );
}

export function converterChaves<T = unknown>(valor: unknown): T {
  if (valor === null || valor === undefined) return valor as T;
  if (Array.isArray(valor)) return valor.map((v) => converterChaves(v)) as T;
  // `Date` não chega aqui — a API serializa para string —, mas um objeto que
  // não é literal (File, Blob) não deve ser desmontado.
  if (typeof valor !== 'object' || Object.getPrototypeOf(valor) !== Object.prototype) {
    return valor as T;
  }

  const saida: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
    saida[paraCamel(chave)] = converterChaves(v);
  }
  return saida as T;
}
