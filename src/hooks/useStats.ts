'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { StatsResponse } from '@/app/api/stats/route';
import { apiFetch, queryString } from '@/lib/api-client';

export function useStats(window?: number) {
  return useQuery({
    queryKey: ['stats', window ?? 'all'] as const,
    queryFn: () => apiFetch<StatsResponse>(`/api/stats${queryString({ window })}`),
    placeholderData: keepPreviousData,
  });
}
