'use client';

import AnimateOnScroll from '../AnimateOnScroll';
import BadgePill from '../BadgePill';
import GradientHeading from '../GradientHeading';
import StatCard from '../StatCard';
import PhoneFrame from '../PhoneFrame';
import content, { type Lang } from '../content';

function StatsMockup() {
  return (
    <div className="w-full h-full bg-[#0A0A0F] px-4 pt-12 pb-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-white/50 text-xs">←</span>
        <span className="text-white text-xs font-semibold">My Progress</span>
      </div>

      {/* XP card */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-white/40 text-[10px]">Total XP</span>
          <span className="text-yellow-400 text-[10px]">⚡ Level 8</span>
        </div>
        <p className="text-white font-bold text-xl">2,450</p>
        <div className="h-1 bg-white/10 rounded-full mt-2">
          <div className="h-full w-[72%] bg-blue-500 rounded-full" />
        </div>
      </div>

      {/* Streak card */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 mb-3">
        <span className="text-white/40 text-[10px]">Current Streak</span>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-lg">🔥</span>
          <p className="text-white font-bold text-xl">12 days</p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <span className="text-white/40 text-[10px]">Cards Reviewed</span>
          <p className="text-white font-bold text-base mt-0.5">348</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <span className="text-white/40 text-[10px]">Quiz Accuracy</span>
          <p className="text-white font-bold text-base mt-0.5">87%</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <span className="text-white/40 text-[10px]">PDFs Uploaded</span>
          <p className="text-white font-bold text-base mt-0.5">12</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <span className="text-white/40 text-[10px]">Study Time</span>
          <p className="text-white font-bold text-base mt-0.5">8h 42m</p>
        </div>
      </div>
    </div>
  );
}

export default function Stats({ lang }: { lang: Lang }) {
  const t = content.stats[lang];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <AnimateOnScroll variant="fade-up" className="text-center mb-16">
          <BadgePill className="mb-4">{t.badge}</BadgePill>
          <GradientHeading className="text-3xl md:text-4xl text-landing-text-dark mb-4">
            {t.title}
          </GradientHeading>
          <p className="text-landing-text-body text-lg max-w-2xl mx-auto">{t.subtitle}</p>
        </AnimateOnScroll>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Phone mockup */}
          <AnimateOnScroll variant="slide-left" delay={0.1} className="hidden lg:flex justify-center">
            <PhoneFrame>
              <StatsMockup />
            </PhoneFrame>
          </AnimateOnScroll>

          {/* Stat cards grid */}
          <div className="grid grid-cols-2 gap-4">
            {t.items.map((item, i) => (
              <AnimateOnScroll key={item.label} variant="fade-up" delay={i * 0.1}>
                <StatCard value={item.value} label={item.label} />
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
