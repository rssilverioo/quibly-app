'use client';

import type { Lang } from './content';
import Navbar from './sections/Navbar';
import Hero from './sections/Hero';
import Features from './sections/Features';
import AppDemo from './sections/AppDemo';
import HowItWorks from './sections/HowItWorks';
import Comparison from './sections/Comparison';
import Stats from './sections/Stats';
import FAQ from './sections/FAQ';
import CTAFinal from './sections/CTAFinal';
import Footer from './sections/Footer';

export default function LandingPage({ lang }: { lang: Lang }) {
  return (
    <div className="min-h-screen bg-white text-landing-text-dark">
      <Navbar lang={lang} />
      <Hero lang={lang} />
      <Features lang={lang} />
      <AppDemo lang={lang} />
      <HowItWorks lang={lang} />
      <Comparison lang={lang} />
      <Stats lang={lang} />
      <FAQ lang={lang} />
      <CTAFinal lang={lang} />
      <Footer lang={lang} />
    </div>
  );
}
