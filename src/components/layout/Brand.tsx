import { cn } from '@/lib/utils';

export function Brand({ collapsible = false }: { collapsible?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5',
        collapsible && 'md:justify-center lg:justify-start',
      )}
    >
      <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold">
        PB
      </span>
      <span
        className={cn(
          'text-sm font-semibold whitespace-nowrap',
          collapsible && 'md:hidden lg:inline',
        )}
      >
        Powerball
      </span>
    </div>
  );
}
