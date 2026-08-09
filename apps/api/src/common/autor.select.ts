import { Prisma } from '@prisma/client';

/**
 * As colunas de quem aparece com nome e rosto ao lado de um conteúdo — autor de
 * post, de comentário, de mensagem, linha do ranking, membro de sala.
 *
 * ## Por que é uma constante, e não cinco campos copiados
 *
 * Este mesmo literal estava escrito em dez lugares. Enquanto foram três campos,
 * copiar custava pouco; o problema apareceu quando o **conjunto** passou a
 * significar algo — "o que o app precisa para desenhar uma pessoa".
 *
 * Cada campo novo aqui vira uma caçada por `select` esquecido, e o esquecido
 * não quebra: o campo chega `undefined`, o app desenha a pessoa sem a marca, e
 * ninguém descobre até alguém reparar que o próprio avatar aparece de um jeito
 * na sala e de outro no ranking.
 *
 * ## Por que só isto
 *
 * O que **não** está aqui é a parte importante. `Profile` tem e-mail, plano de
 * assinatura, país, metas, streak — e um `include` sem `select` levaria tudo
 * junto para dentro de uma lista pública. Já aconteceu neste repositório: o
 * perfil por handle devolvia `{ ...profile }` e o e-mail vazava com ele.
 */
export const AUTOR = {
  username: true,
  handle: true,
  avatarUrl: true,
  /**
   * O selo — dado por nós, nunca vendido. Diz **é mesmo essa pessoa**
   * (`BLUE`) ou **esta pessoa ensina** (`GOLD`).
   */
  verification: true,
  /**
   * O plano, que o app usa só para a **forma** do avatar: quem assina aparece
   * em escudo. Ver `components/plano/MolduraPro` no mobile.
   *
   * É deliberadamente o enum cru e não um booleano `pro`. Um booleano decidiria
   * aqui o que é assunto do app, e no dia em que existir um terceiro plano o
   * servidor teria que escolher de que lado ele cai — mentindo para todas as
   * telas de uma vez.
   */
  plan: true,
} as const satisfies Prisma.ProfileSelect;

/** `AUTOR` mais o `id`, para quando a linha também é um destino de toque. */
export const AUTOR_COM_ID = { id: true, ...AUTOR } as const satisfies Prisma.ProfileSelect;
