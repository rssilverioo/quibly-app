'use client';

import {
  BookOpen,
  Zap,
  Brain,
  Upload,
  Flame,
  Check,
  Crown,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { LandingButton } from './button';
import { LandingCard, LandingCardContent } from './card';
import { LandingBadge } from './badge';

type Lang = 'en' | 'pt';

const t: Record<Lang, Record<string, string | string[]>> = {
  en: {
    login: 'Log In',
    cta: 'Start for free',
    badge: 'Powered by AI',
    heroTitle1: 'Turn PDFs into',
    heroTitle2: 'interactive study',
    heroSub:
      'Upload any PDF and AI creates flashcards with images and quizzes automatically. Study in a fun way, like Duolingo!',
    trustLine: 'No credit card required. Start in seconds.',
    howTitle: 'How it works',
    howSub: '3 simple steps to transform your study',
    step1Title: '1. Upload PDF',
    step1Desc: 'Drag and drop your study material. Accepts any PDF up to 10MB.',
    step2Title: '2. AI generates content',
    step2Desc:
      'Artificial intelligence analyzes the content and creates personalized flashcards and quizzes.',
    step3Title: '3. Study & earn XP',
    step3Desc:
      'Review flashcards, take quizzes, and track your progress with XP, streaks, and levels.',
    flashcardsTitle: 'Smart flashcards with images',
    flashcardsFeatures: [
      'AI identifies key concepts from your material',
      'Illustrative images fetched automatically',
      'Card flip animation to test your knowledge',
      '"Know" and "Don\'t know" system for spaced repetition',
    ],
    flashcardQ: 'What is mitochondria?',
    flashcardTap: 'Tap to flip',
    quizTitle: 'Duolingo-style quizzes',
    quizFeatures: [
      'AI-generated multiple choice questions',
      'Instant visual feedback (green/red)',
      'Progress bar and score counter',
      'Earn XP even when wrong — encourages trying!',
    ],
    quizQ: 'Which organelle is responsible for cellular respiration?',
    quizOpts: ['Ribosome', 'Mitochondria', 'Lysosome', 'Golgi'],
    pricingTitle: 'Simple plans',
    pricingSub: 'Start free, upgrade anytime',
    freeTitle: 'Free',
    freePrice: 'Free',
    freeSuffix: 'forever',
    freeFeatures: [
      '3 flashcard sets per day',
      '3 quizzes per day',
      'PDF upload',
      'Flashcards with images',
      'XP and streaks',
    ],
    freeCta: 'Start for free',
    proTitle: 'Pro',
    proBadge: 'Most popular',
    proPrice: '$9.99',
    proSuffix: '/month',
    proFeatures: [
      'Unlimited flashcard sets',
      'Unlimited quizzes',
      'PDF upload',
      'Flashcards with images',
      'XP and streaks',
      'Priority support',
    ],
    proCta: 'Start with Pro',
    ctaTitle: 'Ready to transform your study?',
    ctaSub:
      'Join thousands of students already using Quibly to study smarter.',
    ctaBtn: 'Start for free now',
    copyright: 'All rights reserved.',
    switchLang: 'Português',
    switchHref: '/pt',
  },
  pt: {
    login: 'Entrar',
    cta: 'Começar grátis',
    badge: 'Powered by AI',
    heroTitle1: 'Transforme PDFs em',
    heroTitle2: 'estudo interativo',
    heroSub:
      'Faça upload de qualquer PDF e a IA cria flashcards com imagens e quizzes automaticamente. Estude de forma divertida, como no Duolingo!',
    trustLine: 'Sem cartão de crédito. Comece em segundos.',
    howTitle: 'Como funciona',
    howSub: '3 passos simples para transformar seu estudo',
    step1Title: '1. Upload do PDF',
    step1Desc:
      'Arraste e solte seu material de estudo. Aceita qualquer PDF até 10MB.',
    step2Title: '2. IA gera conteúdo',
    step2Desc:
      'A inteligência artificial analisa o conteúdo e cria flashcards e quizzes personalizados.',
    step3Title: '3. Estude e ganhe XP',
    step3Desc:
      'Revise flashcards, faça quizzes e acompanhe seu progresso com XP, streaks e níveis.',
    flashcardsTitle: 'Flashcards inteligentes com imagens',
    flashcardsFeatures: [
      'IA identifica os conceitos-chave do seu material',
      'Imagens ilustrativas buscadas automaticamente',
      'Animação de virar o card para testar seu conhecimento',
      'Sistema de "Sei" e "Não sei" para revisão espaçada',
    ],
    flashcardQ: 'O que é mitocôndria?',
    flashcardTap: 'Toque para virar',
    quizTitle: 'Quizzes estilo Duolingo',
    quizFeatures: [
      'Questões de múltipla escolha geradas pela IA',
      'Feedback visual imediato (verde/vermelho)',
      'Barra de progresso e contador de acertos',
      'Ganhe XP mesmo errando - incentiva a tentar!',
    ],
    quizQ: 'Qual organela é responsável pela respiração celular?',
    quizOpts: ['Ribossomo', 'Mitocôndria', 'Lisossomo', 'Golgi'],
    pricingTitle: 'Planos simples',
    pricingSub: 'Comece grátis, faça upgrade quando quiser',
    freeTitle: 'Free',
    freePrice: 'Grátis',
    freeSuffix: 'para sempre',
    freeFeatures: [
      '3 sets de flashcards por dia',
      '3 quizzes por dia',
      'Upload de PDF',
      'Flashcards com imagens',
      'XP e streaks',
    ],
    freeCta: 'Começar grátis',
    proTitle: 'Pro',
    proBadge: 'Mais popular',
    proPrice: '$9.99',
    proSuffix: '/mês',
    proFeatures: [
      'Flashcards ilimitados',
      'Quizzes ilimitados',
      'Upload de PDF',
      'Flashcards com imagens',
      'XP e streaks',
      'Suporte prioritário',
    ],
    proCta: 'Começar com Pro',
    ctaTitle: 'Pronto para transformar seu estudo?',
    ctaSub:
      'Junte-se a milhares de estudantes que já usam o Quibly para estudar de forma mais inteligente.',
    ctaBtn: 'Começar grátis agora',
    copyright: 'Todos os direitos reservados.',
    switchLang: 'English',
    switchHref: '/',
  },
};

function s(lang: Lang, key: string): string {
  return t[lang][key] as string;
}

function a(lang: Lang, key: string): string[] {
  return t[lang][key] as string[];
}

export default function LandingPage({ lang }: { lang: Lang }) {
  const appLink = 'https://apps.apple.com/app/quibly/id6746427498';

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fff', color: '#111' }}>
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-gray-200" style={{ backgroundColor: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="bg-violet-600 text-white p-1.5 rounded-lg">
              <BookOpen className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-violet-600 to-emerald-500 bg-clip-text text-transparent">
              Quibly
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link href={s(lang, 'switchHref')}>
              <LandingButton variant="ghost">{s(lang, 'switchLang')}</LandingButton>
            </Link>
            <Link href={appLink}>
              <LandingButton>{s(lang, 'cta')}</LandingButton>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-emerald-50" />
        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32 text-center">
          <LandingBadge variant="secondary" className="mb-6 border border-violet-200 px-4 py-1.5 text-sm">
            <Zap className="h-3.5 w-3.5 mr-1" />
            {s(lang, 'badge')}
          </LandingBadge>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-gray-900">
            {s(lang, 'heroTitle1')}
            <br />
            <span className="bg-gradient-to-r from-violet-600 to-emerald-500 bg-clip-text text-transparent">
              {s(lang, 'heroTitle2')}
            </span>
          </h1>
          <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-8">
            {s(lang, 'heroSub')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href={appLink}>
              <LandingButton size="lg" className="h-14 px-8 text-lg gap-2">
                {s(lang, 'cta')}
                <ArrowRight className="h-5 w-5" />
              </LandingButton>
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-4">{s(lang, 'trustLine')}</p>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20" style={{ backgroundColor: '#f9fafb' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">{s(lang, 'howTitle')}</h2>
            <p className="text-lg text-gray-500">{s(lang, 'howSub')}</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { Icon: Upload, title: 'step1Title', desc: 'step1Desc', bg: 'bg-violet-100', color: 'text-violet-600' },
              { Icon: Brain, title: 'step2Title', desc: 'step2Desc', bg: 'bg-emerald-100', color: 'text-emerald-600' },
              { Icon: Flame, title: 'step3Title', desc: 'step3Desc', bg: 'bg-orange-100', color: 'text-orange-500' },
            ].map(({ Icon, title, desc, bg, color }) => (
              <LandingCard key={title} className="border-0 shadow-lg">
                <LandingCardContent className="p-8 text-center">
                  <div className={`${bg} w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6`}>
                    <Icon className={`h-8 w-8 ${color}`} />
                  </div>
                  <h3 className="text-xl font-semibold mb-3 text-gray-900">{s(lang, title)}</h3>
                  <p className="text-gray-500">{s(lang, desc)}</p>
                </LandingCardContent>
              </LandingCard>
            ))}
          </div>
        </div>
      </section>

      {/* Flashcards feature */}
      <section className="py-20" style={{ backgroundColor: '#fff' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold mb-6 text-gray-900">{s(lang, 'flashcardsTitle')}</h2>
              <ul className="space-y-4">
                {a(lang, 'flashcardsFeatures').map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700">
                    <Check className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-violet-100 to-violet-50 rounded-2xl p-8 flex items-center justify-center min-h-[300px]">
              <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm text-center transform rotate-2">
                <div className="bg-violet-100 rounded-lg h-32 mb-4 flex items-center justify-center">
                  <BookOpen className="h-12 w-12 text-violet-400" />
                </div>
                <p className="font-semibold text-lg mb-2 text-gray-900">{s(lang, 'flashcardQ')}</p>
                <p className="text-sm text-gray-400">{s(lang, 'flashcardTap')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quiz feature */}
      <section className="py-20" style={{ backgroundColor: '#f9fafb' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="bg-gradient-to-br from-emerald-100 to-emerald-50 rounded-2xl p-8 flex items-center justify-center min-h-[300px] order-2 md:order-1">
              <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-sm">
                <p className="font-semibold mb-4 text-gray-900">{s(lang, 'quizQ')}</p>
                <div className="space-y-2">
                  {a(lang, 'quizOpts').map((opt, i) => (
                    <div
                      key={opt}
                      className={`p-3 rounded-lg border-2 text-sm font-medium ${
                        i === 1
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 text-gray-700'
                      }`}
                    >
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-3xl font-bold mb-6 text-gray-900">{s(lang, 'quizTitle')}</h2>
              <ul className="space-y-4">
                {a(lang, 'quizFeatures').map((item) => (
                  <li key={item} className="flex items-start gap-3 text-gray-700">
                    <Check className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-20" id="pricing" style={{ backgroundColor: '#fff' }}>
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900">{s(lang, 'pricingTitle')}</h2>
            <p className="text-lg text-gray-500">{s(lang, 'pricingSub')}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Free */}
            <LandingCard>
              <LandingCardContent className="p-8">
                <h3 className="text-xl font-semibold mb-2 text-gray-900">{s(lang, 'freeTitle')}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">{s(lang, 'freePrice')}</span>
                  <span className="text-gray-500 ml-1">{s(lang, 'freeSuffix')}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {a(lang, 'freeFeatures').map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="h-4 w-4 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={appLink}>
                  <LandingButton variant="outline" className="w-full h-12">
                    {s(lang, 'freeCta')}
                  </LandingButton>
                </Link>
              </LandingCardContent>
            </LandingCard>

            {/* Pro */}
            <LandingCard className="border-2 border-violet-500 shadow-lg relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <LandingBadge className="gap-1 px-3 py-1">
                  <Crown className="h-3.5 w-3.5" />
                  {s(lang, 'proBadge')}
                </LandingBadge>
              </div>
              <LandingCardContent className="p-8 pt-10">
                <h3 className="text-xl font-semibold mb-2 text-gray-900">{s(lang, 'proTitle')}</h3>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">{s(lang, 'proPrice')}</span>
                  <span className="text-gray-500 ml-1">{s(lang, 'proSuffix')}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {a(lang, 'proFeatures').map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-700">
                      <Check className="h-4 w-4 text-emerald-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href={appLink}>
                  <LandingButton className="w-full h-12 text-base">
                    {s(lang, 'proCta')}
                  </LandingButton>
                </Link>
              </LandingCardContent>
            </LandingCard>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-violet-600 to-purple-700 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{s(lang, 'ctaTitle')}</h2>
          <p className="text-lg text-violet-200 mb-8">{s(lang, 'ctaSub')}</p>
          <Link href={appLink}>
            <LandingButton
              size="lg"
              className="bg-white text-violet-700 hover:bg-gray-100 h-14 px-8 text-lg gap-2"
            >
              {s(lang, 'ctaBtn')}
              <ArrowRight className="h-5 w-5" />
            </LandingButton>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-200" style={{ backgroundColor: '#fff' }}>
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-violet-600 text-white p-1 rounded">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="font-semibold text-sm text-gray-900">Quibly</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <Link href="/terms" className="hover:text-gray-700">
              {lang === 'en' ? 'Terms of Use' : 'Termos de Uso'}
            </Link>
            <Link href="/privacy" className="hover:text-gray-700">
              {lang === 'en' ? 'Privacy Policy' : 'Política de Privacidade'}
            </Link>
          </div>
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} Quibly. {s(lang, 'copyright')}
          </p>
        </div>
      </footer>
    </div>
  );
}
