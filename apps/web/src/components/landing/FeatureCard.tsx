import { cn } from './utils';

type Variant = 'dark' | 'light' | 'emerald' | 'orange';

interface Props {
  emoji: string;
  title: string;
  description: string;
  variant?: Variant;
  className?: string;
}

const styles: Record<Variant, { bg: string; title: string; desc: string; icon: string }> = {
  dark: {
    bg: 'bg-landing-text-dark text-white liquid-glass-shine relative overflow-hidden',
    title: 'text-white',
    desc: 'text-gray-300',
    icon: 'bg-blue-500/20 backdrop-blur-sm',
  },
  light: {
    bg: 'liquid-glass-card relative overflow-hidden',
    title: 'text-landing-text-dark',
    desc: 'text-landing-text-body',
    icon: 'bg-blue-100/80',
  },
  emerald: {
    bg: 'liquid-glass-card relative overflow-hidden',
    title: 'text-landing-text-dark',
    desc: 'text-landing-text-body',
    icon: 'bg-emerald-100/80',
  },
  orange: {
    bg: 'liquid-glass-card relative overflow-hidden',
    title: 'text-landing-text-dark',
    desc: 'text-landing-text-body',
    icon: 'bg-orange-100/80',
  },
};

export default function FeatureCard({ emoji, title, description, variant = 'light', className }: Props) {
  const s = styles[variant];

  return (
    <div className={cn('rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg', s.bg, className)}>
      <div className={cn('w-14 h-14 rounded-xl flex items-center justify-center text-2xl mb-5', s.icon)}>
        {emoji}
      </div>
      <h3 className={cn('text-xl font-semibold mb-2', s.title)}>{title}</h3>
      <p className={cn('text-sm leading-relaxed', s.desc)}>{description}</p>
    </div>
  );
}
