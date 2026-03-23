'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AnimateOnScroll from '../AnimateOnScroll';
import BadgePill from '../BadgePill';
import GradientHeading from '../GradientHeading';
import PhoneFrame from '../PhoneFrame';
import content, { type Lang } from '../content';

/* ── Colors matching mobile app exactly ─────────────── */
const C = {
  bg: '#0A0A0F',
  surface: '#141420',
  surfaceLight: '#1E1E2E',
  border: '#2A2A3E',
  primary: '#1E40AF',
  primaryLight: '#2B53D8',
  secondary: '#00D4AA',
  error: '#FF4757',
  warning: '#FFB84D',
  gold: '#FFD700',
  text: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
};

/* ── Step indicator ─────────────────────────────────── */
const steps = ['upload', 'flashcard', 'quiz', 'xp'] as const;
type Step = (typeof steps)[number];

const stepLabels: Record<string, Record<Step, string>> = {
  en: { upload: 'Upload PDF', flashcard: 'Study Flashcards', quiz: 'Take Quiz', xp: 'Earn XP' },
  pt: { upload: 'Upload PDF', flashcard: 'Estudar Flashcards', quiz: 'Fazer Quiz', xp: 'Ganhar XP' },
};

/* ── Screen 1: Upload ───────────────────────────────── */
function UploadScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full flex flex-col px-4 pt-14 pb-4"
      style={{ background: C.bg }}
    >
      <div className="flex items-center gap-2 mb-6">
        <span style={{ color: C.textMuted }} className="text-xs">←</span>
        <span style={{ color: C.text }} className="text-sm font-semibold">Upload Document</span>
      </div>

      {/* Type toggle */}
      <div className="flex rounded-xl overflow-hidden mb-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex-1 text-center py-2.5 text-xs font-semibold" style={{ background: C.primary, color: C.text }}>
          📚 Flashcards
        </div>
        <div className="flex-1 text-center py-2.5 text-xs" style={{ color: C.textMuted }}>
          ❓ Quiz
        </div>
      </div>

      {/* Upload zone */}
      <motion.div
        className="flex-1 rounded-2xl flex flex-col items-center justify-center gap-3"
        style={{ border: `2px dashed ${C.border}`, background: C.surface }}
        animate={{ borderColor: [C.border, C.primary, C.border] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
          style={{ background: C.primary + '22' }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          📄
        </motion.div>
        <p style={{ color: C.text }} className="text-sm font-semibold">Upload a PDF</p>
        <p style={{ color: C.textMuted }} className="text-[10px]">Select a file to get started</p>
      </motion.div>

      {/* Simulated file appearing */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.5 }}
        className="mt-4 rounded-xl px-4 py-3 flex items-center gap-3"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
      >
        <span className="text-lg">📕</span>
        <div className="flex-1 min-w-0">
          <p style={{ color: C.text }} className="text-xs font-semibold truncate">Biology_Chapter_5.pdf</p>
          <p style={{ color: C.textMuted }} className="text-[10px]">2.4 MB</p>
        </div>
        <span style={{ color: C.secondary }} className="text-[10px]">✓</span>
      </motion.div>

      {/* Generate button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2 }}
        className="mt-3 rounded-xl py-3 text-center text-sm font-semibold"
        style={{ background: C.primary, color: C.text }}
      >
        Generate Flashcards
      </motion.div>
    </motion.div>
  );
}

/* ── Screen 2: Flashcard Study ──────────────────────── */
function FlashcardScreen() {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFlipped(true), 1800);
    return () => clearTimeout(t1);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full flex flex-col px-4 pt-14 pb-4"
      style={{ background: C.bg }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span style={{ color: C.textMuted }} className="text-xs">←</span>
          <span style={{ color: C.text }} className="text-xs font-semibold">Cell Biology</span>
        </div>
        <span style={{ color: C.textMuted }} className="text-[10px]">3 of 15</span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full mb-auto" style={{ background: C.surfaceLight }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: C.primary }}
          initial={{ width: '13%' }}
          animate={{ width: '20%' }}
          transition={{ delay: 1, duration: 0.5 }}
        />
      </div>

      {/* Card with flip */}
      <div className="flex-1 flex items-center justify-center py-4">
        <div className="w-full relative" style={{ height: 220 }}>
          <AnimatePresence mode="wait">
            {!flipped ? (
              <motion.div
                key="front"
                className="absolute inset-0 rounded-2xl p-5 flex flex-col"
                style={{ background: C.surface, border: `1.5px solid ${C.primary}40` }}
                initial={{ rotateY: 0 }}
                exit={{ rotateY: 90, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span style={{ color: C.textMuted }} className="text-[10px] font-semibold tracking-wider">FRONT</span>
                <p style={{ color: C.text }} className="text-base font-semibold text-center my-auto leading-snug">
                  What is the primary function of mitochondria in a cell?
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="back"
                className="absolute inset-0 rounded-2xl p-5 flex flex-col"
                style={{ background: C.surfaceLight, border: `1.5px solid ${C.secondary}40` }}
                initial={{ rotateY: -90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <span style={{ color: C.textMuted }} className="text-[10px] font-semibold tracking-wider">BACK</span>
                <p style={{ color: C.text }} className="text-base font-semibold text-center my-auto leading-snug">
                  To produce ATP through cellular respiration — the cell&apos;s energy currency.
                </p>
                <div className="rounded-lg px-3 py-2 mt-auto" style={{ background: C.primary + '15' }}>
                  <p style={{ color: C.textSecondary }} className="text-[10px] text-center leading-relaxed">
                    Mitochondria have their own DNA and double membrane structure.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Tap to flip / XP toast */}
      <AnimatePresence>
        {!flipped ? (
          <motion.p
            key="hint"
            style={{ color: C.textMuted }}
            className="text-[11px] text-center mb-2"
            exit={{ opacity: 0 }}
          >
            Tap to flip
          </motion.p>
        ) : (
          <motion.div
            key="xp"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center mb-2"
          >
            <span
              className="px-3 py-1 rounded-full text-[10px] font-bold"
              style={{ background: C.gold + '20', color: C.gold }}
            >
              ⚡ +10 XP
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav buttons */}
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <span style={{ color: C.textMuted }} className="text-xs">‹</span>
        </div>
        <div className="flex-1 h-12 rounded-xl flex items-center justify-center text-sm font-semibold" style={{ background: C.primary, color: C.text }}>
          Next →
        </div>
      </div>
    </motion.div>
  );
}

/* ── Screen 3: Quiz ─────────────────────────────────── */
function QuizScreen() {
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setSelected(2), 2000);
    const t2 = setTimeout(() => setRevealed(true), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const opts = [
    { l: 'A', t: 'Energy storage' },
    { l: 'B', t: 'Protein synthesis' },
    { l: 'C', t: 'ATP production' },
    { l: 'D', t: 'Cell division' },
  ];

  const getStyle = (i: number) => {
    if (!revealed) {
      if (selected === i) return { bg: C.primary + '22', border: C.primary, text: C.text };
      return { bg: C.surface, border: C.border, text: C.text };
    }
    if (i === 2) return { bg: C.secondary + '22', border: C.secondary, text: C.secondary };
    if (selected === i && i !== 2) return { bg: C.error + '22', border: C.error, text: C.error };
    return { bg: C.surface, border: C.border, text: C.textMuted };
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full flex flex-col px-4 pt-14 pb-4"
      style={{ background: C.bg }}
    >
      {/* Header */}
      <div className="flex items-center justify-center mb-3">
        <span style={{ color: C.textMuted }} className="text-xs absolute left-4">←</span>
        <span style={{ color: C.text }} className="text-xs font-semibold">Cell Biology Quiz</span>
      </div>

      {/* Progress dots */}
      <div className="flex gap-1.5 justify-center mb-4">
        {[C.secondary, C.secondary, C.primary, C.border, C.border].map((c, i) => (
          <div key={i} className="w-2 h-2 rounded-full" style={{ background: c }} />
        ))}
      </div>

      {/* Question */}
      <p style={{ color: C.textMuted }} className="text-[10px] font-semibold tracking-wider mb-1">QUESTION 3 OF 5</p>
      <p style={{ color: C.text }} className="text-sm font-bold leading-snug mb-5">
        What is the primary function of mitochondria?
      </p>

      {/* Options */}
      <div className="space-y-2.5 flex-1">
        {opts.map((opt, i) => {
          const s = getStyle(i);
          return (
            <motion.div
              key={opt.l}
              className="flex items-center gap-3 rounded-xl px-3.5 py-3"
              style={{ background: s.bg, border: `1.5px solid ${s.border}` }}
              animate={revealed && i === 2 ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <span
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                style={{ border: `1.5px solid ${s.border}`, color: s.text }}
              >
                {opt.l}
              </span>
              <span style={{ color: s.text }} className="text-[12px] font-medium">{opt.t}</span>
            </motion.div>
          );
        })}
      </div>

      {/* Result feedback */}
      <AnimatePresence>
        {revealed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-3"
          >
            <p style={{ color: C.secondary }} className="text-sm font-bold">✓ Correct!</p>
            <span
              className="inline-block mt-1 px-3 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: C.gold + '20', color: C.gold }}
            >
              ⚡ +20 XP
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Screen 4: XP / Level Up ────────────────────────── */
function XPScreen() {
  const [levelUp, setLevelUp] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLevelUp(true), 1500);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full h-full flex flex-col px-4 pt-14 pb-4"
      style={{ background: C.bg }}
    >
      {/* Header */}
      <p style={{ color: C.text }} className="text-lg font-bold mb-1">Hey Rodrigo! 👋</p>
      <div className="flex items-center gap-2 mb-5">
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
          style={{ border: `1.5px solid ${C.secondary}`, color: C.secondary, background: C.secondary + '15' }}
        >
          Consistent
        </span>
        <span
          className="px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
          style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.warning }}
        >
          🔥 7
        </span>
      </div>

      {/* Stats row */}
      <div className="rounded-xl flex mb-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        {[
          { icon: '⏱', val: '12h', label: 'HOURS', color: C.primary },
          { icon: '⚡', val: '8', label: 'LEVEL', color: C.warning },
          { icon: '🎯', val: '85', label: 'LOCK-IN', color: C.primaryLight },
          { icon: '⭐', val: '2.4K', label: 'XP', color: C.gold },
        ].map((s, i) => (
          <div key={s.label} className="flex-1 text-center py-3" style={i < 3 ? { borderRight: `1px solid ${C.border}` } : {}}>
            <p className="text-sm mb-0.5">{s.icon}</p>
            <p style={{ color: C.text }} className="text-sm font-bold">{s.val}</p>
            <p style={{ color: C.textSecondary }} className="text-[8px] tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* XP progress bar */}
      <div className="rounded-xl px-4 py-3 mb-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex justify-between mb-1.5">
          <span style={{ color: C.textSecondary }} className="text-[10px]">Level 8 → Level 9</span>
          <span style={{ color: C.textSecondary }} className="text-[10px]">2,450 / 3,000 XP</span>
        </div>
        <div className="h-2 rounded-full" style={{ background: C.surfaceLight }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: C.primary }}
            initial={{ width: '72%' }}
            animate={{ width: levelUp ? '100%' : '82%' }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Level up overlay */}
      <AnimatePresence>
        {levelUp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center rounded-2xl"
            style={{ background: C.surface, border: `1px solid ${C.border}` }}
          >
            <motion.p
              className="text-3xl mb-2"
              animate={{ rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6 }}
            >
              🎉
            </motion.p>
            <p style={{ color: C.text }} className="text-lg font-bold">Level Up!</p>
            <motion.div
              className="w-16 h-16 rounded-full flex items-center justify-center mt-3 mb-2"
              style={{ background: C.primary + '30', border: `2px solid ${C.primary}` }}
              animate={{ scale: [0.8, 1.1, 1] }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <span style={{ color: C.text }} className="text-xl font-bold">9</span>
            </motion.div>
            <p style={{ color: C.textSecondary }} className="text-xs">Keep studying to level up!</p>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-3 px-4 py-1.5 rounded-full text-[10px] font-bold"
              style={{ background: C.gold + '20', color: C.gold }}
            >
              ⚡ +550 XP earned today
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Main Demo Section ──────────────────────────────── */
export default function AppDemo({ lang }: { lang: Lang }) {
  const t = content.appDemo[lang];
  const [activeStep, setActiveStep] = useState<number>(0);
  const [autoPlay, setAutoPlay] = useState(true);

  const advanceStep = useCallback(() => {
    setActiveStep((prev) => (prev + 1) % steps.length);
  }, []);

  // Auto-advance every 5s
  useEffect(() => {
    if (!autoPlay) return;
    const interval = setInterval(advanceStep, 5000);
    return () => clearInterval(interval);
  }, [autoPlay, advanceStep]);

  const handleStepClick = (i: number) => {
    setAutoPlay(false);
    setActiveStep(i);
    // Resume auto after 10s
    setTimeout(() => setAutoPlay(true), 10000);
  };

  const screens = [UploadScreen, FlashcardScreen, QuizScreen, XPScreen];
  const ActiveScreen = screens[activeStep];
  const labels = stepLabels[lang] || stepLabels.en;

  return (
    <section id="demo" className="py-24 bg-gradient-to-b from-white via-blue-50/20 to-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <AnimateOnScroll variant="fade-up" className="text-center mb-12">
          <BadgePill className="mb-4">{t.badge}</BadgePill>
          <GradientHeading className="text-3xl md:text-4xl text-landing-text-dark mb-4">
            {t.title}
          </GradientHeading>
          <p className="text-landing-text-body text-lg max-w-2xl mx-auto">{t.subtitle}</p>
        </AnimateOnScroll>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Phone */}
          <AnimateOnScroll variant="fade-up" delay={0.1} className="flex justify-center">
            <div className="relative">
              {/* Glow behind phone */}
              <div className="absolute inset-0 -m-8 bg-blue-400/10 rounded-full blur-[60px] pointer-events-none" />
              <PhoneFrame>
                <AnimatePresence mode="wait">
                  <ActiveScreen key={activeStep} />
                </AnimatePresence>
              </PhoneFrame>
            </div>
          </AnimateOnScroll>

          {/* Step selector */}
          <AnimateOnScroll variant="fade-up" delay={0.2}>
            <div className="space-y-4">
              {steps.map((step, i) => (
                <button
                  key={step}
                  onClick={() => handleStepClick(i)}
                  className={`w-full text-left rounded-2xl p-5 transition-all duration-300 ${
                    activeStep === i
                      ? 'liquid-glass-card shadow-md scale-[1.02]'
                      : 'bg-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-colors duration-300 ${
                        activeStep === i
                          ? 'bg-landing-blue text-white shadow-lg shadow-blue-500/20'
                          : 'bg-gray-100 text-landing-text-body'
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`text-base font-semibold transition-colors duration-300 ${
                        activeStep === i ? 'text-landing-text-dark' : 'text-landing-text-body'
                      }`}>
                        {labels[step]}
                      </p>
                      <p className={`text-sm mt-0.5 transition-colors duration-300 ${
                        activeStep === i ? 'text-landing-text-body' : 'text-gray-400'
                      }`}>
                        {t.stepDescriptions[i]}
                      </p>
                    </div>
                    {/* Progress indicator */}
                    {activeStep === i && (
                      <motion.div
                        className="w-1.5 h-10 rounded-full overflow-hidden bg-gray-200"
                      >
                        <motion.div
                          className="w-full bg-landing-blue rounded-full"
                          initial={{ height: '0%' }}
                          animate={{ height: '100%' }}
                          transition={{ duration: 5, ease: 'linear' }}
                          key={`progress-${activeStep}`}
                        />
                      </motion.div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </section>
  );
}
