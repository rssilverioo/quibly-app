import { cn } from './utils';

interface Props {
  number: string;
  title: string;
  description: string;
  className?: string;
}

export default function StepCard({ number, title, description, className }: Props) {
  return (
    <div className={cn('text-center liquid-glass-card rounded-2xl p-8 transition-shadow duration-200 hover:shadow-md', className)}>
      <div className="w-16 h-16 rounded-full bg-landing-blue text-white text-2xl font-bold flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-500/25">
        {number}
      </div>
      <h3 className="text-xl font-semibold text-landing-text-dark mb-2">{title}</h3>
      <p className="text-landing-text-body text-sm leading-relaxed max-w-xs mx-auto">{description}</p>
    </div>
  );
}
