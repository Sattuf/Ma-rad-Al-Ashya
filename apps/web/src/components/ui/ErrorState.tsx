import { CloudOff, Lock, SearchX, ServerCrash, WifiOff, type LucideIcon } from 'lucide-react';
import { Button } from './Button';
import { cn } from '@/lib/cn';
import { ERROR_COPY, errorKind, type ErrorKind } from '@/lib/errors';

const ICONS: Partial<Record<ErrorKind, LucideIcon>> = {
  offline: WifiOff,
  network: CloudOff,
  timeout: CloudOff,
  server: ServerCrash,
  unauthorized: Lock,
  forbidden: Lock,
  'not-found': SearchX,
};

/**
 * A failed request is not an empty result. Showing "no listings" when the network failed
 * tells users the marketplace is empty; this says what happened and offers a retry.
 *
 * Pass the `error` so the explanation matches the cause (offline vs our server vs
 * missing item); the `title` names what failed to load.
 */
export function ErrorState({
  error,
  title,
  description,
  onRetry,
  className,
}: {
  error?: unknown;
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const kind = errorKind(error);
  const copy = ERROR_COPY[kind];
  const Icon = ICONS[kind] ?? CloudOff;
  // Retrying cannot fix a missing item or a missing permission.
  const canRetry = onRetry && kind !== 'not-found' && kind !== 'forbidden';
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 px-6 py-12 text-center', className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-pill bg-danger-soft text-danger">
        <Icon className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="text-lg font-semibold text-fg">{title ?? copy.title}</h3>
      <p className="max-w-sm text-sm text-fg-muted">{description ?? copy.description}</p>
      {canRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-2">
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
