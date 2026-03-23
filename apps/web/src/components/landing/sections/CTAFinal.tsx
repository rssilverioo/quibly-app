'use client';

import { motion } from 'framer-motion';
import AnimateOnScroll from '../AnimateOnScroll';
import GradientHeading from '../GradientHeading';
import GradientButton from '../GradientButton';
import content, { type Lang } from '../content';

const emojis = [
  { char: '📚', x: '8%', y: '18%', delay: 0 },
  { char: '🧠', x: '88%', y: '12%', delay: 0.5 },
  { char: '⚡', x: '12%', y: '78%', delay: 1 },
  { char: '🏆', x: '82%', y: '75%', delay: 1.5 },
];

export default function CTAFinal({ lang }: { lang: Lang }) {
  const t = content.ctaFinal[lang];
  const appLink = 'https://apps.apple.com/app/quibly/id6746427498';

  return (
    <section className="relative py-24 bg-landing-cta-bg overflow-hidden">
      {/* Floating emojis */}
      {emojis.map((e) => (
        <motion.span
          key={e.char}
          className="absolute text-3xl pointer-events-none select-none opacity-30"
          style={{ left: e.x, top: e.y }}
          animate={{ y: [0, -14, 0], rotate: [0, 6, 0] }}
          transition={{ duration: 3.5, repeat: Infinity, delay: e.delay, ease: 'easeInOut' }}
        >
          {e.char}
        </motion.span>
      ))}

      <div className="relative max-w-3xl mx-auto px-4 text-center">
        {/* Glass container */}
        <AnimateOnScroll variant="fade-up">
          <div className="liquid-glass-card liquid-glass-shine relative rounded-3xl px-8 py-14 md:px-14">
            <GradientHeading className="text-3xl md:text-4xl text-landing-text-dark mb-4">
              {t.title}
            </GradientHeading>

            <p className="text-landing-text-body text-lg mb-8 max-w-xl mx-auto">
              {t.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <GradientButton href={appLink} size="lg">
                🍎 {t.ctaAppStore}
              </GradientButton>
              <GradientButton href="#google-play" variant="white" size="lg">
                ▶️ {t.ctaGooglePlay}
              </GradientButton>
            </div>
          </div>
        </AnimateOnScroll>
      </div>
    </section>
  );
}
