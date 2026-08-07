import type { Metadata } from 'next';
import { Inter, EB_Garamond } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: 'Quibly — Turn PDFs into Interactive Study with AI',
  description:
    'Upload any PDF and AI creates flashcards with images and quizzes automatically. Study smarter with gamification, XP, and streaks.',
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
      <body className={`${inter.variable} ${ebGaramond.variable} ${inter.className}`}>
        {children}
      </body>
    </html>
  );
}
