export type Plataforma = 'ios' | 'android' | 'outra';

/**
 * De que aparelho veio o acesso, pelo `User-Agent`.
 *
 * ## Para que serve
 *
 * O link da bio do Instagram é **um só** e vai para todo mundo. Quem abre no
 * iPhone precisa da App Store, quem abre no Android precisa da Play, e quem
 * abre no computador precisa ver as duas. Um botão só, três destinos.
 *
 * ## Por que no servidor
 *
 * Detectar no cliente custa um quadro de página em branco antes do redirecionamento
 * — e no navegador embutido do Instagram, que é lento e às vezes bloqueia
 * script, esse quadro vira a experiência inteira. Lendo o cabeçalho, a resposta
 * já sai certa.
 *
 * ## Por que os robôs contam como "outra"
 *
 * O robô que monta a prévia do link no Instagram e no WhatsApp precisa **ver a
 * página**, não ser redirecionado: é dela que ele tira o título e a imagem do
 * cartão. Como nenhum deles se identifica como iPhone ou Android, cair em
 * `outra` já os atende — e a página de escolha é exatamente o que se quer
 * mostrar num cartão de link.
 */
export function plataformaDe(userAgent: string | null | undefined): Plataforma {
  if (!userAgent) return 'outra';
  const ua = userAgent.toLowerCase();

  // Android antes de iOS: alguns navegadores Android trazem "like Mac OS X" na
  // string por herança do WebKit, e a ordem inversa os classificaria errado.
  if (ua.includes('android')) return 'android';

  // `ipad` continua aqui pelo iPadOS 12 e por navegadores em modo mobile. O
  // iPad moderno se declara Macintosh e cai em `outra` — o que dá nele a página
  // de escolha, que é um destino honesto, e não um erro.
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) return 'ios';

  return 'outra';
}
