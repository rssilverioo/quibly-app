'use client';

import { motion, useReducedMotion, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * As peças de movimento da landing, em cima do Framer Motion.
 *
 * ## A regra
 *
 * Movimento aqui **revela**, não decora. Cada bloco entra uma vez, quando
 * chega à tela, e depois fica quieto. Nada gira, nada pisca, nada anda em
 * loop — com uma exceção: o coelho do herói flutua devagar, porque é um
 * personagem e personagem parado parece adesivo.
 *
 * ## Por que `whileInView` e não `animate`
 *
 * A página é longa. Animar tudo na carga faz a seção de planos entrar
 * enquanto ninguém está olhando, e quem chega lá encontra tudo parado.
 * `whileInView` com `once` faz cada bloco entrar quando é visto, e só uma vez.
 *
 * ## Movimento reduzido
 *
 * `useReducedMotion` lê `prefers-reduced-motion`. Com ele ligado, as variantes
 * viram só opacidade — o conteúdo continua entrando, sem deslocamento.
 */

const facil = [0.22, 1, 0.36, 1] as const;

function variantes(reduzido: boolean, dy = 28, escala = 1): Variants {
  return {
    oculto: reduzido ? { opacity: 0 } : { opacity: 0, y: dy, scale: escala },
    visivel: { opacity: 1, y: 0, scale: 1 },
  };
}

/** Um bloco que sobe e aparece quando entra na tela. */
export function Aparece({
  children,
  atraso = 0,
  className,
  dy,
  escala,
  como = 'div',
}: {
  children: ReactNode;
  atraso?: number;
  className?: string;
  dy?: number;
  escala?: number;
  como?: 'div' | 'section' | 'figure' | 'p' | 'h2';
}) {
  const reduzido = useReducedMotion() ?? false;
  const Tag = motion[como];
  return (
    <Tag
      className={className}
      initial="oculto"
      whileInView="visivel"
      viewport={{ once: true, margin: '-60px' }}
      variants={variantes(reduzido, dy, escala)}
      transition={{ duration: 0.7, delay: atraso, ease: facil }}
    >
      {children}
    </Tag>
  );
}

/**
 * Um container que faz os filhos `Item` entrarem um atrás do outro.
 * Usado no texto do herói, nos passos e nos cartões de plano.
 */
export function Escalonado({
  children,
  className,
  intervalo = 0.09,
  como = 'div',
}: {
  children: ReactNode;
  className?: string;
  intervalo?: number;
  como?: 'div' | 'ol' | 'ul';
}) {
  const Tag = motion[como];
  return (
    <Tag
      className={className}
      initial="oculto"
      whileInView="visivel"
      viewport={{ once: true, margin: '-40px' }}
      variants={{ oculto: {}, visivel: { transition: { staggerChildren: intervalo, delayChildren: 0.05 } } }}
    >
      {children}
    </Tag>
  );
}

export function Item({
  children,
  className,
  como = 'div',
  levanta,
}: {
  children: ReactNode;
  className?: string;
  como?: 'div' | 'li' | 'span';
  /** Sobe alguns pixels no hover — para cartões que são "coisas". */
  levanta?: boolean;
}) {
  const reduzido = useReducedMotion() ?? false;
  const Tag = motion[como];
  return (
    <Tag
      className={className}
      variants={variantes(reduzido, 24, 0.98)}
      transition={{ duration: 0.6, ease: facil }}
      whileHover={levanta && !reduzido ? { y: -6 } : undefined}
    >
      {children}
    </Tag>
  );
}

/** O coelho flutuando: sobe e desce 8px num ciclo lento. */
export function Flutua({ children, className }: { children: ReactNode; className?: string }) {
  const reduzido = useReducedMotion() ?? false;
  return (
    <motion.div
      className={className}
      initial={reduzido ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.9, ease: facil, delay: 0.15 }}
    >
      <motion.div
        animate={reduzido ? undefined : { y: [0, -9, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

/** A barra de navegação descendo na carga. */
export function Desce({ children, className }: { children: ReactNode; className?: string }) {
  const reduzido = useReducedMotion() ?? false;
  return (
    <motion.header
      className={className}
      initial={reduzido ? { opacity: 0 } : { opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: facil }}
    >
      {children}
    </motion.header>
  );
}
