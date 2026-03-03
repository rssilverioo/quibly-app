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
      },
    },
  },
  plugins: [],
};

export default config;
