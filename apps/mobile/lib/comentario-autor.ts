/**
 * Quem escreveu um comentário: nome, foto e se assina.
 *
 * ## O defeito que isto conserta
 *
 * O card lia `comment.username` e `comment.profile`. A API não manda nenhum dos
 * dois: o Prisma faz a junção em `user`, e o `SnakeCaseInterceptor` entrega
 * `user`. Então **todo comentário aparecia como "desconhecido"**, com a inicial
 * de "desconhecido" no lugar da foto — e como isso é um estado desenhado, e não
 * uma tela quebrada, o defeito passava por ausência de dado.
 *
 * É o mesmo engano que já tinha sido encontrado e corrigido no chat, em
 * `lib/chat-messages`. Apareceu duas vezes porque `FeedComment`, no pacote
 * compartilhado, declara `profile?: Profile` — o tipo descreve um servidor que
 * nunca existiu, e o TypeScript concorda com quem o lê.
 *
 * ## Por que continua lendo as três formas
 *
 * `user` é o que chega hoje. Os campos planos e `profile` ficam aceitos porque
 * o tipo compartilhado os promete, e ler os três custa uma linha — a alternativa
 * é a tela quebrar de novo, em silêncio, no dia em que o servidor mudar.
 */
export interface ComentarioComAutor {
  user?: {
    username?: string;
    avatar_url?: string | null;
    plan?: 'FREE' | 'PRO';
  };
  profile?: { username?: string; avatar_url?: string | null; plan?: 'FREE' | 'PRO' };
  username?: string;
  avatar_url?: string | null;
  plan?: 'FREE' | 'PRO';
}

export function autorDoComentario(comentario: ComentarioComAutor): {
  nome: string | null;
  avatar: string | null;
  /** Se assina. Só a forma do avatar depende disto — ver `MolduraPro`. */
  pro: boolean;
} {
  return {
    // `null` e não um rótulo pronto: quem desenha é que sabe em que idioma
    // dizer "desconhecido", e essa decisão não cabe aqui.
    nome: comentario.user?.username ?? comentario.username ?? comentario.profile?.username ?? null,
    avatar:
      comentario.user?.avatar_url ?? comentario.avatar_url ?? comentario.profile?.avatar_url ?? null,
    pro: (comentario.user?.plan ?? comentario.plan ?? comentario.profile?.plan) === 'PRO',
  };
}
