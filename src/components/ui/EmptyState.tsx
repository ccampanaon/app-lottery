import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('px-6 py-14 text-center', className)}>
      <p className="text-sm font-medium">{title}</p>
      {description && (
        <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn('px-6 py-14 text-center', className)} role="alert">
      <p className="text-danger text-sm font-medium">Something went wrong</p>
      <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-primary mt-4 text-sm font-medium underline underline-offset-4"
        >
          Try again
        </button>
      )}
    </div>
  );
}
