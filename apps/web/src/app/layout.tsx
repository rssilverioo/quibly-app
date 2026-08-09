import type { Metadata } from 'next';
import { Bricolage_Grotesque, Nunito, Azeret_Mono } from 'next/font/google';
import './globals.css';

/**
 * Três faces, três papéis.
 *
 * Estava Inter + EB Garamond — o par que aparece em praticamente toda página
 * gerada, e que não diz nada sobre este produto.
 *
 * **Bricolage Grotesque** no display: variável, com largura e peso ajustáveis,
 * e um desenho levemente irregular que soa editorial em vez de corporativo.
 *
 * **Nunito** no corpo, porque é a fonte do app. Quem sai do site e abre o
 * Quibly encontra a mesma letra — continuidade de marca vale mais aqui do que
 * qualquer ganho de legibilidade marginal.
 *
 * **Azeret Mono** só nos contadores. Contar dias é a mecânica do produto, e
 * número em mono lê como placar; em fonte de texto, lê como parágrafo.
 */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--fonte-display',
  display: 'swap',
});
const corpo = Nunito({
  subsets: ['latin'],
  variable: '--fonte-corpo',
  display: 'swap',
});
const mono = Azeret_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--fonte-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Quibly — Study rooms that count the days you show up',
  description:
    'Create a room, bring the people you study with, and start a challenge. The timer keeps running with the app closed, and the ranking counts days you turned up — not the one night you crammed.',
  other: {
    // O azul do coelho novo. `#3B82F6` era um azul do Tailwind, não da marca —
    // ele pintava a barra do navegador de uma cor que não existe em lugar nenhum
    // do produto.
    'theme-color': '#015FFD',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${corpo.variable} ${mono.variable} ${corpo.className}`}>
        {children}
      </body>
    </html>
  );
}
