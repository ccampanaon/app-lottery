'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { DrawHistoryRow } from './DrawHistoryRow';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDeletePrediction, usePredictionHistory } from '@/hooks/usePredictions';

export function SavedPredictions() {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = usePredictionHistory(page);
  const remove = useDeletePrediction();

  if (isPending) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'Could not load history'}
        onRetry={() => refetch()}
      />
    );
  }

  if (data.data.length === 0) {
    return (
      <EmptyState
        title="No predictions yet"
        description="Generate numbers for the next draw above. Once that draw is published, every set is scored against the real result automatically."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="border-border bg-card overflow-hidden rounded-lg border">
        <div className="border-border text-muted-foreground bg-muted/30 flex items-center gap-3 border-b px-4 py-2 text-xs font-medium tracking-wide uppercase sm:gap-4">
          <span className="w-28 shrink-0">Draw date</span>
          <span className="hidden w-20 shrink-0 sm:block">Draw</span>
          <span className="hidden flex-1 sm:block">Winning numbers</span>
          <span className="ml-auto shrink-0 sm:ml-0">Matches</span>
          <span className="size-5 shrink-0" aria-hidden />
        </div>

        {data.data.map((entry) => (
          <DrawHistoryRow
            key={entry.targetDrawDate}
            entry={entry}
            deletingId={remove.isPending ? remove.variables : undefined}
            onDelete={(id) => remove.mutate(id)}
          />
        ))}
      </div>

      {data.totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            Page {data.page} of {data.totalPages} · {data.total} draw
            {data.total === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden />
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
