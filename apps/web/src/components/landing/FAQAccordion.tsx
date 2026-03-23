'use client';

import * as Accordion from '@radix-ui/react-accordion';
import { cn } from './utils';

interface FAQItem {
  q: string;
  a: string;
}

interface Props {
  items: FAQItem[];
  className?: string;
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5 transition-transform duration-200', className)} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function FAQAccordion({ items, className }: Props) {
  return (
    <Accordion.Root type="single" collapsible className={cn('space-y-3', className)}>
      {items.map((item, i) => (
        <Accordion.Item
          key={i}
          value={`faq-${i}`}
          className="rounded-2xl liquid-glass-card overflow-hidden transition-shadow duration-200 hover:shadow-md"
        >
          <Accordion.Header>
            <Accordion.Trigger className="flex w-full items-center justify-between px-6 py-4 text-left text-base font-medium text-landing-text-dark transition-colors group">
              {item.q}
              <ChevronIcon className="text-landing-text-body group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <p className="px-6 pb-4 text-sm leading-relaxed text-landing-text-body">
              {item.a}
            </p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
