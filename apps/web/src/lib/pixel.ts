/**
 * O Meta Pixel do site.
 *
 * ## O que ele mede
 *
 * A landing e o `/download` são a ponta de cima do funil de tráfego pago:
 * anúncio → site → loja → app. O SDK da Meta no app conta a instalação; o
 * pixel conta quem chegou ao site e quem tocou num botão de loja. A diferença
 * entre os dois é o quanto a página perde.
 *
 * ## Os eventos
 *
 * - `PageView`: padrão da Meta, disparado uma vez por página.
 * - `DownloadClick`: qualquer botão de loja. É o evento para otimizar campanha
 *   de tráfego enquanto a de instalação não tem volume.
 * - `DownloadClick_iOS` / `DownloadClick_Android`: o mesmo clique, separado
 *   por loja, para comparar as duas sem custom conversion.
 *
 * Os três de clique são `trackCustom`; a Meta não tem evento padrão para
 * "foi para a loja".
 *
 * ## O ID é público
 *
 * O ID do pixel vai no HTML de qualquer site que o usa; não é segredo. Fica
 * aqui como constante para o pixel não depender de variável de ambiente que
 * alguém esquece de configurar na hospedagem — e, vazio, o pixel simplesmente
 * não carrega.
 */
export const PIXEL_ID = '';

type Fbq = (...args: unknown[]) => void;

function fbq(): Fbq | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { fbq?: Fbq };
  return w.fbq ?? null;
}

/** Um clique num botão de loja. `loja` separa iOS de Android. */
export function rastrearCliqueDeLoja(loja: 'ios' | 'android') {
  const f = fbq();
  if (!f) return;
  f('trackCustom', 'DownloadClick', { loja });
  f('trackCustom', loja === 'ios' ? 'DownloadClick_iOS' : 'DownloadClick_Android');
}
