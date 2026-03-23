'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useScrolled } from '../hooks/useScrolled';
import GradientButton from '../GradientButton';
import content, { type Lang } from '../content';
import { cn } from '../utils';

const sectionIds = ['features', 'how-it-works', 'pricing', 'faq'];

export default function Navbar({ lang }: { lang: Lang }) {
  const scrolled = useScrolled();
  const [menuOpen, setMenuOpen] = useState(false);
  const t = content.nav[lang];
  const appLink = 'https://apps.apple.com/app/quibly/id6746427498';

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        scrolled
          ? 'liquid-glass-light shadow-sm'
          : 'bg-transparent',
      )}
    >
      <nav className="max-w-6xl mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href={lang === 'pt' ? '/pt' : '/'} className="flex items-center gap-2">
          <div className="bg-landing-blue text-white p-1.5 rounded-lg">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <span className={cn(
            'text-xl font-bold transition-colors duration-300',
            scrolled ? 'text-landing-text-dark' : 'text-white',
          )}>
            {t.logo}
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {t.links.map((label, i) => (
            <a
              key={label}
              href={`#${sectionIds[i]}`}
              className={cn(
                'text-sm font-medium transition-colors duration-300 hover:text-landing-blue',
                scrolled ? 'text-landing-text-body' : 'text-white/80',
              )}
            >
              {label}
            </a>
          ))}
          <Link
            href={t.switchHref}
            className={cn(
              'text-sm font-medium transition-colors duration-300 hover:text-landing-blue',
              scrolled ? 'text-landing-text-body' : 'text-white/80',
            )}
          >
            {t.switchLang}
          </Link>
          <GradientButton href={appLink} size="md">
            {t.cta}
          </GradientButton>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className={cn('md:hidden p-2 rounded-lg transition-colors', scrolled ? 'text-landing-text-dark' : 'text-white')}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden liquid-glass-light border-t border-white/20">
          <div className="px-4 py-4 space-y-3">
            {t.links.map((label, i) => (
              <a
                key={label}
                href={`#${sectionIds[i]}`}
                onClick={() => setMenuOpen(false)}
                className="block text-sm font-medium text-landing-text-dark py-2"
              >
                {label}
              </a>
            ))}
            <Link
              href={t.switchHref}
              className="block text-sm font-medium text-landing-text-body py-2"
            >
              {t.switchLang}
            </Link>
            <GradientButton href={appLink} className="w-full">
              {t.cta}
            </GradientButton>
          </div>
        </div>
      )}
    </header>
  );
}
