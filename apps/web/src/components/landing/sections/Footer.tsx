import Link from 'next/link';
import content, { type Lang } from '../content';

export default function Footer({ lang }: { lang: Lang }) {
  const t = content.footer[lang];
  const columns = [t.product, t.support, t.social];

  return (
    <footer className="bg-landing-footer-bg py-16">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid sm:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-landing-blue text-white p-1.5 rounded-lg">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="text-lg font-bold text-landing-text-dark">Quibly</span>
            </div>
            <p className="text-sm text-landing-text-body">
              {lang === 'en' ? 'Study smarter with AI.' : 'Estude melhor com IA.'}
            </p>
          </div>

          {/* Link columns */}
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold text-landing-text-dark mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-landing-text-body hover:text-landing-blue transition-colors"
                      {...(link.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-blue-200/50 pt-6 text-center">
          <p className="text-sm text-landing-text-body">
            © {new Date().getFullYear()} Quibly. {t.copyright}
          </p>
        </div>
      </div>
    </footer>
  );
}
