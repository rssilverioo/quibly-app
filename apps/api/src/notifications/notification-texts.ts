/**
 * Os textos das notificações, por idioma.
 *
 * ## Por que existe uma segunda tradução, se o app já tem i18n
 *
 * Porque quem escreve estes textos é o **servidor**, e ele não tem o i18next
 * nem os JSON do bundle do app. Uma notificação de mensagem nova é composta
 * enquanto o aparelho de quem vai receber está bloqueado — não há app rodando
 * para traduzir nada.
 *
 * É o mesmo motivo pelo qual a Live Activity recebe os rótulos prontos do app
 * (ver `StudyTimerAttributes`), invertido: lá quem sabe o idioma é o app; aqui
 * quem sabe é o servidor, porque é ele que fala com o aparelho.
 *
 * ## Por que idioma do aparelho, e não da conta
 *
 * A notificação chega na tela de bloqueio, no meio das de todos os outros
 * apps. Ali quem manda é o idioma do celular — e é por isso que `locale` vive
 * no `PushToken`, que é o aparelho, e não no `Profile`, que é a pessoa.
 */

type Textos = {
  chatTitulo: (sala: string) => string;
  /** Quando a sala não tem nome. Raro, e melhor que um título vazio. */
  salaSemNome: string;
  chatCorpo: (autor: string, previa: string) => string;
  reacaoTitulo: string;
  reacaoCorpo: (quem: string) => string;
  comentarioTitulo: string;
  comentarioCorpo: (quem: string, previa: string) => string;
  conquistaTitulo: string;
  conquistaCorpo: (nomes: string) => string;
};

const pt: Textos = {
  chatTitulo: (sala) => sala,
  salaSemNome: 'Mensagem nova',
  chatCorpo: (autor, previa) => `${autor}: ${previa}`,
  reacaoTitulo: 'Reagiram ao seu post',
  reacaoCorpo: (quem) => `${quem} reagiu ao seu check-in`,
  comentarioTitulo: 'Comentaram no seu post',
  comentarioCorpo: (quem, previa) => `${quem}: ${previa}`,
  conquistaTitulo: 'Conquista desbloqueada',
  conquistaCorpo: (nomes) => nomes,
};

const en: Textos = {
  chatTitulo: (sala) => sala,
  salaSemNome: 'New message',
  chatCorpo: (autor, previa) => `${autor}: ${previa}`,
  reacaoTitulo: 'New reaction',
  reacaoCorpo: (quem) => `${quem} reacted to your check-in`,
  comentarioTitulo: 'New comment',
  comentarioCorpo: (quem, previa) => `${quem}: ${previa}`,
  conquistaTitulo: 'Achievement unlocked',
  conquistaCorpo: (nomes) => nomes,
};

/**
 * Inglês é o padrão, e não português.
 *
 * O app é distribuído mundialmente e a maioria dos idiomas do mundo cai aqui.
 * Quem fala português recebe português porque o aparelho diz `pt-BR`, não
 * porque a empresa é brasileira.
 */
const PADRAO = en;

/**
 * Os textos para um locale de aparelho.
 *
 * Compara só a primeira parte: `pt-BR`, `pt-PT` e `pt` são o mesmo texto aqui,
 * e exigir a etiqueta completa faria um iPhone português cair em inglês por
 * causa do sufixo.
 */
export function textosPara(locale: string | null | undefined): Textos {
  const base = (locale ?? '').split('-')[0].toLowerCase();
  return base === 'pt' ? pt : PADRAO;
}

/** Os idiomas que temos, para agrupar os envios. */
export function idiomaDe(locale: string | null | undefined): 'pt' | 'en' {
  return (locale ?? '').split('-')[0].toLowerCase() === 'pt' ? 'pt' : 'en';
}
