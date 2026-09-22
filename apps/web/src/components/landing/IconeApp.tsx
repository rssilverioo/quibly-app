/**
 * O ícone do app — a mesma arte do ícone na loja (coelho correndo de mochila
 * sobre o azul). Substitui o `Coelho` vetorial nos lugares pequenos: ao lado
 * do wordmark na navegação, no rodapé e no cabeçalho de /download.
 */

import Image from 'next/image';

export default function IconeApp({ size }: { size: number }) {
  return (
    <Image
      src="/coelhos/icone-app.png"
      alt=""
      width={size}
      height={size}
      className="icone-app"
    />
  );
}
