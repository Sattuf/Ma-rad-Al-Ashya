import { WifiOff } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/cn';

/**
 * A failed request is not an empty result. Showing "no listings" when the network failed
 * tells users the marketplace is empty; this says what happened and offers a retry.
 */
export function ErrorState({
  title = 'تعذّر تحميل البيانات',
  description = 'تحقّق من اتصالك بالإنترنت ثم حاول مجدداً.',
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-pill bg-danger-soft text-danger">
        <WifiOff className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold text-fg">{title}</h3>
      <p className="max-w-sm text-sm text-fg-muted">{description}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-2">
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
