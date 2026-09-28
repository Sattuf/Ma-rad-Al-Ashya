import { cn } from '@/lib/cn';

/** Placeholder with the shape of the content being loaded (avoids layout shift). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-control bg-surface-muted', className)} />;
}
