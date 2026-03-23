'use client';

import AnimateOnScroll from '../AnimateOnScroll';
import BadgePill from '../BadgePill';
import GradientHeading from '../GradientHeading';
import FeatureCard from '../FeatureCard';
import content, { type Lang } from '../content';

const cardVariants = ['dark', 'light', 'emerald', 'orange'] as const;

export default function Features({ lang }: { lang: Lang }) {
  const t = content.features[lang];

  return (
    <section id="features" className="relative py-24 bg-gradient-to-b from-white via-blue-50/30 to-white">
      {/* Subtle decorative orb for glass backdrop effect */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4">
        <AnimateOnScroll variant="fade-up" className="text-center mb-16">
          <BadgePill className="mb-4">{t.badge}</BadgePill>
          <GradientHeading className="text-3xl md:text-4xl text-landing-text-dark mb-4">
            {t.title}
          </GradientHeading>
          <p className="text-landing-text-body text-lg max-w-2xl mx-auto">{t.subtitle}</p>
        </AnimateOnScroll>

        <div className="grid sm:grid-cols-2 gap-6">
          {t.cards.map((card, i) => (
            <AnimateOnScroll key={card.title} variant="fade-up" delay={i * 0.1}>
              <FeatureCard
                emoji={card.emoji}
                title={card.title}
                description={card.description}
                variant={cardVariants[i]}
              />
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
