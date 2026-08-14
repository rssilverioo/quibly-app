import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Encolhe a imagem antes de ela sair do aparelho.
 *
 * ## O problema que isto resolve
 *
 * Nada no caminho redimensionava nada. O app capturava em resolução cheia — uns
 * 4000x3000 num iPhone recente —, a API guardava o arquivo como veio, e o feed
 * baixava esse arquivo inteiro para desenhar num quadrado pequeno.
 *
 * O número que fechou o diagnóstico em 14/08: um **avatar** no CDN pesava
 * **807 KB**, em PNG, para aparecer com 40 pixels de lado. A foto de check-in é
 * maior que isso.
 *
 * O custo aparece duas vezes: na hora de subir, que é quando a pessoa está
 * esperando com o dedo na tela, e depois em cada abertura do feed, para sempre,
 * na conta de dados de todo mundo que vê aquele post.
 *
 * ## Por que no cliente, e não no servidor
 *
 * Redimensionar no servidor conserta o download e não conserta o upload — o
 * megabyte já atravessou a rede da pessoa. E é justamente o upload que ela
 * sente, porque é o único momento em que ela está parada esperando.
 *
 * Fazer nos dois lados seria melhor; fazer no cliente primeiro é o que entrega
 * mais por menos.
 *
 * ## Os números
 *
 * JPEG sempre, mesmo que a origem seja PNG: foto de caderno não tem
 * transparência a preservar, e o PNG de uma foto pesa várias vezes mais.
 *
 * Qualidade 0,72 é onde a compressão para de ser visível numa foto de papel ou
 * de tela. Abaixo disso o texto pequeno começa a borrar, que é exatamente o que
 * a pessoa fotografou.
 */

export type Uso = 'checkin' | 'avatar' | 'capa';

/** Lado maior, em pixels, por uso. */
const LIMITE: Record<Uso, number> = {
  /**
   * 1440 cobre a tela de qualquer telefone atual em 3x sem serrilhar, e é o
   * limite acima do qual ninguém percebe diferença numa foto de estudo.
   */
  checkin: 1440,
  /** Aparece entre 28 e 96pt. 512 dá folga para 3x e para a tela de perfil. */
  avatar: 512,
  /** Capa ocupa a largura da tela, e nunca mais que isso. */
  capa: 1080,
};

const QUALIDADE: Record<Uso, number> = {
  checkin: 0.72,
  avatar: 0.8,
  capa: 0.75,
};

/**
 * Devolve o caminho de um arquivo novo, já reduzido. Em caso de erro devolve o
 * original — comprimir é otimização, e falhar nela não pode impedir alguém de
 * publicar o que estudou.
 */
export async function comprimirImagem(uri: string, uso: Uso): Promise<string> {
  try {
    const contexto = ImageManipulator.manipulate(uri);
    // `resize` com um lado só preserva a proporção; passar os dois distorceria
    // fotos que não estão na orientação esperada.
    contexto.resize({ width: LIMITE[uso] });
    const imagem = await contexto.renderAsync();
    const salva = await imagem.saveAsync({
      compress: QUALIDADE[uso],
      format: SaveFormat.JPEG,
    });
    return salva.uri;
  } catch {
    return uri;
  }
}
