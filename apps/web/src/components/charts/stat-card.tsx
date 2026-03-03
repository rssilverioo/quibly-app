import { Card } from '../ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { value: number; label: string };
  className?: string;
}

export function StatCard({ title, value, subtitle, trend, className }: StatCardProps) {
  return (
    <Card className={cn('flex flex-col gap-1', className)}>
      <p className="text-sm text-quibly-text-muted">{title}</p>
      <p className="text-2xl font-bold text-quibly-text">{value}</p>
      {subtitle && (
        <p className="text-xs text-quibly-text-muted">{subtitle}</p>
      )}
      {trend && (
        <p className={cn(
          'text-xs font-medium',
          trend.value >= 0 ? 'text-quibly-success' : 'text-quibly-error',
        )}>
          {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
        </p>
      )}
    </Card>
  );
}
