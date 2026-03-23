import { cn } from './utils';

interface Props {
  value: string;
  label: string;
  className?: string;
}

export default function StatCard({ value, label, className }: Props) {
  return (
    <div className={cn('rounded-2xl liquid-glass-card p-6 text-center transition-shadow duration-200 hover:shadow-md', className)}>
      <p className="text-3xl font-bold text-landing-blue mb-1">{value}</p>
      <p className="text-sm text-landing-text-body">{label}</p>
    </div>
  );
}
