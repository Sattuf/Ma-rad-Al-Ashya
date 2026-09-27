import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'danger' | 'success' | 'warning' | 'info';

const TONES: Record<Tone, string> = {
  danger: 'bg-danger-soft text-danger border-danger/30',
  success: 'bg-success-soft text-success border-success/30',
  warning: 'bg-warning-soft text-warning border-warning/30',
  info: 'bg-primary-soft text-on-primary-soft border-primary/30',
};

/** Inline message. Errors use role="alert" so screen readers announce them immediately. */
export function Alert({ tone = 'info', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('rounded-control border p-3 text-sm', TONES[tone], className)}
    >
      {children}
    </div>
  );
}
