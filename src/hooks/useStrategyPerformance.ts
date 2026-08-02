'use client';

import { useQuery } from '@tanstack/react-query';
import type { PerformanceResponse } from '@/app/api/predictions/performance/route';
import { apiFetch } from '@/lib/api-client';

export function useStrategyPerformance() {
  return useQuery({
    queryKey: ['strategy-performance'] as const,
    queryFn: () => apiFetch<PerformanceResponse>('/api/predictions/performance'),
  });
}
