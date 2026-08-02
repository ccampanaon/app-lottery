import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Stat tile: label (sentence case) + value + optional supporting line.
 * The value uses proportional figures — tabular-nums is for columns that must
 * align vertically, and makes a standalone display number look loose.
 */
export function StatCard({
  label,
  value,
  sub,
  children,
}: {
  label: string;
  value?: string | number;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      {children ?? (
        <p className="mt-1.5 text-2xl font-semibold">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      )}
      {sub && <p className="text-muted-foreground mt-1 text-xs">{sub}</p>}
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-2.5 h-7 w-20" />
      <Skeleton className="mt-2 h-3 w-28" />
    </div>
  );
}
