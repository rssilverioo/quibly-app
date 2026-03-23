'use client';

import AnimateOnScroll from '../AnimateOnScroll';
import BadgePill from '../BadgePill';
import GradientHeading from '../GradientHeading';
import SplitComparisonPanel from '../SplitComparisonPanel';
import content, { type Lang } from '../content';

export default function Comparison({ lang }: { lang: Lang }) {
  const t = content.comparison[lang];
  const appLink = 'https://apps.apple.com/app/quibly/id6746427498';

  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <AnimateOnScroll variant="fade-up" className="text-center mb-16">
          <BadgePill className="mb-4">{t.badge}</BadgePill>
          <GradientHeading className="text-3xl md:text-4xl text-landing-text-dark mb-4">
            {t.title}
          </GradientHeading>
          <p className="text-landing-text-body text-lg max-w-2xl mx-auto">{t.subtitle}</p>
        </AnimateOnScroll>

        <AnimateOnScroll variant="fade-up" delay={0.2}>
          <SplitComparisonPanel
            free={t.free}
            pro={t.pro}
            appLink={appLink}
          />
        </AnimateOnScroll>
      </div>
    </section>
  );
}
