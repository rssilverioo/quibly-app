import { cn } from './utils';
import GradientButton from './GradientButton';

interface PlanData {
  title: string;
  price: string;
  suffix: string;
  cta: string;
  features: readonly string[];
  badge?: string;
}

interface Props {
  free: PlanData;
  pro: PlanData;
  appLink: string;
  className?: string;
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-4 w-4 flex-shrink-0', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function SplitComparisonPanel({ free, pro, appLink, className }: Props) {
  return (
    <div className={cn('grid md:grid-cols-2 gap-8 max-w-4xl mx-auto', className)}>
      {/* Free */}
      <div className="rounded-2xl liquid-glass-card relative overflow-hidden p-8">
        <h3 className="text-xl font-semibold text-landing-text-dark mb-2">{free.title}</h3>
        <div className="mb-6">
          <span className="text-4xl font-bold text-landing-text-dark">{free.price}</span>
          <span className="text-landing-text-body ml-2">{free.suffix}</span>
        </div>
        <ul className="space-y-3 mb-8">
          {free.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-landing-text-body">
              <CheckIcon className="text-landing-emerald" />
              {f}
            </li>
          ))}
        </ul>
        <GradientButton href={appLink} variant="white" className="w-full">
          {free.cta}
        </GradientButton>
      </div>

      {/* Pro */}
      <div className="rounded-2xl bg-[#0A1628] p-8 text-white relative shadow-xl liquid-glass-shine overflow-hidden">
        {pro.badge && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-landing-blue text-white text-xs font-semibold px-4 py-1 rounded-full shadow-lg z-10">
            {pro.badge}
          </span>
        )}
        <h3 className="text-xl font-semibold mb-2">{pro.title}</h3>
        <div className="mb-6">
          <span className="text-4xl font-bold">{pro.price}</span>
          <span className="text-blue-300 ml-2">{pro.suffix}</span>
        </div>
        <ul className="space-y-3 mb-8">
          {pro.features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-sm text-blue-200">
              <CheckIcon className="text-landing-emerald" />
              {f}
            </li>
          ))}
        </ul>
        <GradientButton href={appLink} className="w-full">
          {pro.cta}
        </GradientButton>
      </div>
    </div>
  );
}
