import Image from 'next/image';

/**
 * O coelho ilustrado, o mesmo PNG do app (`apps/mobile/assets/coelhos`),
 * em cópia de 600px em `public/coelhos/`.
 *
 * Convive com o `Coelho` vetorial, que continua nos lugares pequenos —
 * navegação e rodapé — onde 28px de PNG não valem a requisição. Aqui a
 * ilustração ocupa 150 a 360px e é a mesma arte que a pessoa vai encontrar
 * no app: o site promete o personagem que o app entrega.
 */
export default function CoelhoImagem({
  nome,
  alt,
  size,
  prioridade,
}: {
  nome: 'celular-quibly' | 'focused' | 'celebrate' | 'correndo-faixa';
  alt: string;
  size: number;
  prioridade?: boolean;
}) {
  return (
    <Image
      src={`/coelhos/${nome}.png`}
      alt={alt}
      width={size}
      height={size}
      priority={prioridade}
      className="coelho-imagem"
      style={{ width: `min(${size}px, 70vw)`, height: 'auto' }}
    />
  );
}
