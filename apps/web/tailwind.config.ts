import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        quibly: {
          bg: '#0A0A0F',
          surface: '#141420',
          'surface-light': '#1E1E2E',
          border: '#2A2A3E',
          primary: '#1E40AF',
          'primary-light': '#2B53D8',
          secondary: '#00D4AA',
          accent: '#FF6B6B',
          warning: '#FFB84D',
          success: '#00D4AA',
          error: '#FF4757',
          text: '#FFFFFF',
          'text-secondary': '#9CA3AF',
          'text-muted': '#6B7280',
          gold: '#FFD700',
          silver: '#C0C0C0',
          bronze: '#CD7F32',
        },
        landing: {
          blue: '#3B82F6',
          'blue-deep': '#1E40AF',
          'blue-mid': '#2B53D8',
          'blue-light': '#60A5FA',
          'blue-lighter': '#93C5FD',
          emerald: '#10B981',
          orange: '#F59E0B',
          gold: '#FFD700',
          'hero-start': '#040301',
          'hero-mid': '#1E40AF',
          'text-dark': '#0A1628',
          'text-body': '#6B7280',
          'footer-bg': '#EFF6FF',
          'cta-bg': '#DBEAFE',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #040301 0%, #1E40AF 40%, #3B82F6 100%)',
        'cta-gradient': 'linear-gradient(135deg, #DBEAFE 0%, #EFF6FF 100%)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float-emoji': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-12px) rotate(5deg)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        shimmer: 'shimmer 2s linear infinite',
        'float-emoji': 'float-emoji 3s ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
