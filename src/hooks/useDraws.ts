'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiFetch, queryString } from '@/lib/api-client';
import type { DrawPage } from '@/types';

export type DrawsQuery = {
  page: number;
  limit: number;
  sort: '-drawDate' | 'drawDate';
  from?: string;
  to?: string;
};

export function drawsQueryKey(query: DrawsQuery) {
  return ['draws', query] as const;
}

export function useDraws(query: DrawsQuery) {
  return useQuery({
    queryKey: drawsQueryKey(query),
    queryFn: () => apiFetch<DrawPage>(`/api/draws${queryString(query)}`),
    // Keep the previous page on screen while the next one loads, so paging does
    // not collapse the table to a spinner and jump the scroll position.
    placeholderData: keepPreviousData,
  });
}
