'use client';

import AnimateOnScroll from '../AnimateOnScroll';
import BadgePill from '../BadgePill';
import GradientHeading from '../GradientHeading';
import StepCard from '../StepCard';
import content, { type Lang } from '../content';

export default function HowItWorks({ lang }: { lang: Lang }) {
  const t = content.howItWorks[lang];

  return (
    <section id="how-it-works" className="py-24 bg-[#FAFAFA]">
      <div className="max-w-6xl mx-auto px-4">
        <AnimateOnScroll variant="fade-up" className="text-center mb-16">
          <BadgePill className="mb-4">{t.badge}</BadgePill>
          <GradientHeading className="text-3xl md:text-4xl text-landing-text-dark mb-4">
            {t.title}
          </GradientHeading>
          <p className="text-landing-text-body text-lg max-w-2xl mx-auto">{t.subtitle}</p>
        </AnimateOnScroll>

        <div className="grid md:grid-cols-3 gap-12">
          {t.steps.map((step, i) => (
            <AnimateOnScroll key={step.number} variant="fade-up" delay={i * 0.15}>
              <StepCard
                number={step.number}
                title={step.title}
                description={step.description}
              />
            </AnimateOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
