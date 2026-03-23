'use client';

import { motion } from 'framer-motion';
import AnimateOnScroll from '../AnimateOnScroll';
import GradientButton from '../GradientButton';
import GradientHeading from '../GradientHeading';
import BadgePill from '../BadgePill';
import PhoneFrame from '../PhoneFrame';
import content, { type Lang } from '../content';

/* ── Quiz Screen Mockup ───────────────────────────────── */
function QuizMockup() {
  const opts = [
    { letter: 'A', text: 'A localized regional conflict' },
    { letter: 'B', text: 'A hypothetical global conflict' },
    { letter: 'C', text: 'A historical event from the 20th century' },
    { letter: 'D', text: 'A period of economic prosperity' },
  ];

  return (
    <div className="w-full h-full bg-[#0A0A0F] px-4 pt-12 pb-4 flex flex-col">
      <div className="flex items-center justify-center mb-3">
        <span className="text-white/50 text-xs absolute left-4">←</span>
        <span className="text-white text-xs font-semibold">WW3</span>
      </div>
      <div className="flex gap-1 justify-center mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20" />
        ))}
      </div>
      <p className="text-[10px] text-white/40 font-medium tracking-wider mb-1">QUESTION 1 OF 15</p>
      <p className="text-white font-bold text-sm leading-snug mb-4">
        World War III is primarily described as what type of event?
      </p>
      <div className="space-y-2 flex-1">
        {opts.map((opt) => (
          <div key={opt.letter} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
            <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-bold text-white/50 flex-shrink-0">
              {opt.letter}
            </span>
            <span className="text-white/80 text-[11px] leading-tight">{opt.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Flashcard Screen Mockup ──────────────────────────── */
function FlashcardMockup() {
  return (
    <div className="w-full h-full bg-[#0A0A0F] px-4 pt-12 pb-4 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-xs">←</span>
          <span className="text-white text-xs font-semibold">Mitochondria</span>
        </div>
        <span className="text-white/40 text-[10px]">14 of 25</span>
      </div>
      <div className="h-1 bg-white/10 rounded-full mb-auto">
        <div className="h-full w-[56%] bg-blue-500 rounded-full" />
      </div>
      <div className="flex-1 flex items-center justify-center py-6">
        <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-5 flex flex-col min-h-[200px]">
          <span className="text-[10px] text-white/30 font-medium tracking-wider mb-auto">FRONT</span>
          <p className="text-white font-semibold text-base text-center my-auto leading-snug">
            How does ATP synthase produce ATP?
          </p>
          <div />
        </div>
      </div>
      <p className="text-white/30 text-xs text-center">Tap to flip</p>
    </div>
  );
}

/* ── Streak Screen Mockup ─────────────────────────────── */
function StreakMockup() {
  const streakDays = [3, 9, 11, 13];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="w-full h-full bg-[#0A0A0F] px-4 pt-12 pb-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="text-white font-bold text-sm">Study Streak</span>
        <span className="text-white/40 text-xs">✕</span>
      </div>
      <div className="flex rounded-xl border border-white/10 bg-white/[0.03] mb-4">
        <div className="flex-1 text-center py-2.5 border-r border-white/10">
          <p className="text-sm">🔥</p>
          <p className="text-white font-bold text-lg leading-none">15</p>
          <p className="text-[9px] text-white/40 tracking-wider mt-0.5">CURRENT</p>
        </div>
        <div className="flex-1 text-center py-2.5">
          <p className="text-sm">🔥</p>
          <p className="text-white font-bold text-lg leading-none">15</p>
          <p className="text-[9px] text-white/40 tracking-wider mt-0.5">LONGEST</p>
        </div>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/30 text-[10px]">‹</span>
        <span className="text-white text-xs font-semibold">March 2026</span>
        <span className="text-white/30 text-[10px]">›</span>
      </div>
      <div className="grid grid-cols-7 gap-y-1.5 mb-1">
        {['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'].map((d) => (
          <span key={d} className="text-[8px] text-white/30 text-center font-medium">{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const isStreak = streakDays.includes(day);
          const isToday = day === 13;
          return (
            <div key={day} className="flex items-center justify-center h-6">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-medium ${
                isStreak ? 'bg-blue-500 text-white'
                  : isToday ? 'border border-white/40 text-white'
                    : 'text-white/40'
              }`}>
                {day}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-auto flex rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="flex-1 text-center py-2 border-r border-white/10">
          <p className="text-white font-bold text-sm">3</p>
          <p className="text-[9px] text-white/40">Days studied</p>
        </div>
        <div className="flex-1 text-center py-2">
          <p className="text-white font-bold text-sm">0h 17m</p>
          <p className="text-[9px] text-white/40">Total time</p>
        </div>
      </div>
    </div>
  );
}

/* ── Hero Section ─────────────────────────────────────── */
export default function Hero({ lang }: { lang: Lang }) {
  const t = content.hero[lang];
  const appLink = 'https://apps.apple.com/app/quibly/id6746427498';

  const phoneFloat = (delay: number) => ({
    y: [0, -10, 0],
    transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' as const, delay },
  });

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-hero-gradient">
      {/* Animated gradient orbs */}
      <div className="orb-1 absolute top-[10%] left-[15%] w-[450px] h-[450px] bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="orb-2 absolute bottom-[10%] right-[10%] w-[350px] h-[350px] bg-blue-400/15 rounded-full blur-[80px] pointer-events-none" />
      <div className="orb-3 absolute top-[50%] left-[50%] w-[300px] h-[300px] bg-blue-500/10 rounded-full blur-[90px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 pt-28 pb-16 w-full">
        {/* ── Centered text ── */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <AnimateOnScroll variant="fade-up" delay={0}>
            <BadgePill variant="dark" className="mb-6 liquid-glass">
              ⚡ {t.badge}
            </BadgePill>
          </AnimateOnScroll>

          <AnimateOnScroll variant="fade-up" delay={0.1}>
            <GradientHeading as="h1" className="text-4xl md:text-5xl lg:text-7xl mb-6 leading-[1.1]">
              <span className="text-white">{t.title1}</span>
              <br />
              <span className="bg-gradient-to-r from-blue-300 via-blue-200 to-white bg-clip-text text-transparent">
                {t.titleGradient}
              </span>
            </GradientHeading>
          </AnimateOnScroll>

          <AnimateOnScroll variant="fade-up" delay={0.2}>
            <p className="text-lg md:text-xl text-blue-200/70 max-w-2xl mx-auto mb-8">
              {t.subtitle}
            </p>
          </AnimateOnScroll>

          <AnimateOnScroll variant="fade-up" delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <GradientButton href={appLink} size="lg">
                🍎 {t.ctaAppStore}
              </GradientButton>
              <GradientButton href="#google-play" variant="outline" size="lg" className="liquid-glass border-white/15">
                ▶️ {t.ctaGooglePlay}
              </GradientButton>
            </div>
          </AnimateOnScroll>
        </div>

        {/* ── Phone showcase with liquid glass backdrop ── */}
        <div className="hidden md:block relative">
          {/* Glass panel behind phones */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.5, ease: 'easeOut' }}
            className="absolute inset-x-8 lg:inset-x-20 top-4 bottom-4 rounded-3xl liquid-glass liquid-glass-shine"
          />

          <div className="relative flex items-end justify-center gap-4 lg:gap-6 px-4">
            {/* Quiz — left */}
            <motion.div
              initial={{ opacity: 0, y: 80, rotate: -10 }}
              animate={{ opacity: 1, y: 0, rotate: -6 }}
              transition={{ duration: 0.9, delay: 0.6, ease: 'easeOut' }}
            >
              <motion.div animate={phoneFloat(0)}>
                <PhoneFrame size="sm" className="-rotate-6 mb-8">
                  <QuizMockup />
                </PhoneFrame>
              </motion.div>
            </motion.div>

            {/* Flashcard — center (raised, larger) */}
            <motion.div
              initial={{ opacity: 0, y: 80 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
              className="z-10"
            >
              <motion.div animate={phoneFloat(0.6)}>
                <PhoneFrame>
                  <FlashcardMockup />
                </PhoneFrame>
              </motion.div>
            </motion.div>

            {/* Streak — right */}
            <motion.div
              initial={{ opacity: 0, y: 80, rotate: 10 }}
              animate={{ opacity: 1, y: 0, rotate: 6 }}
              transition={{ duration: 0.9, delay: 0.8, ease: 'easeOut' }}
            >
              <motion.div animate={phoneFloat(1.2)}>
                <PhoneFrame size="sm" className="rotate-6 mb-8">
                  <StreakMockup />
                </PhoneFrame>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
