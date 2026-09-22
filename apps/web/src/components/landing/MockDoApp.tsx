import Image from 'next/image';

/**
 * Os dois iPhones com o app — feed da sala e ranking, no tema claro, em
 * português. `public/app/mock-claro.png`, PNG com fundo transparente.
 *
 * Substitui o coelho com o celular no herói e no /download: o coelho
 * prometia o personagem, isto mostra o produto. O `next/image` serve
 * WebP redimensionado, então o PNG de 1,3 MB do repo não chega ao
 * navegador nesse tamanho.
 */
export default function MockDoApp({ size = 520, prioridade }: { size?: number; prioridade?: boolean }) {
  return (
    <Image
      src="/app/mock-claro.png"
      alt="Duas telas do Quibly: o feed de uma sala com as sessões de estudo e o ranking de dias"
      width={1312}
      height={1199}
      priority={prioridade}
      sizes={`(max-width: 820px) 92vw, ${size}px`}
      className="mock-app"
      style={{ width: `min(${size}px, 92vw)`, height: 'auto' }}
    />
  );
}
