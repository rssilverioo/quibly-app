'use client';

import AnimateOnScroll from '../AnimateOnScroll';
import BadgePill from '../BadgePill';
import GradientHeading from '../GradientHeading';
import FAQAccordion from '../FAQAccordion';
import content, { type Lang } from '../content';

export default function FAQ({ lang }: { lang: Lang }) {
  const t = content.faq[lang];

  return (
    <section id="faq" className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4">
        <AnimateOnScroll variant="fade-up" className="text-center mb-12">
          <BadgePill className="mb-4">{t.badge}</BadgePill>
          <GradientHeading className="text-3xl md:text-4xl text-landing-text-dark">
            {t.title}
          </GradientHeading>
        </AnimateOnScroll>

        <AnimateOnScroll variant="fade-in" delay={0.2}>
          <FAQAccordion items={[...t.items]} />
        </AnimateOnScroll>
      </div>
    </section>
  );
}
