import { cn } from './utils';

interface Props {
  value: string;
  className?: string;
}

export default function XPBadge({ value, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-landing-gold/20 px-3 py-1 text-xs font-bold text-landing-gold',
        className,
      )}
    >
      ⚡ {value} XP
    </span>
  );
}
