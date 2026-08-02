'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch, queryString } from '@/lib/api-client';
import type { CurrentPrediction, DrawHistoryEntry, Paginated } from '@/types';

export type GenerateArgs = { sets: number; window?: number };

/** What has already been generated for the upcoming draw. */
export function useCurrentPrediction() {
  return useQuery({
    queryKey: ['prediction-current'] as const,
    queryFn: () => apiFetch<CurrentPrediction>('/api/predictions/current'),
  });
}

/**
 * Generate every strategy and persist it. POST, because it writes — and the
 * server refuses a second generation for the same draw with a 409.
 */
export function useGeneratePrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (args: GenerateArgs) =>
      apiFetch<CurrentPrediction>(`/api/predictions/generate${queryString(args)}`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(['prediction-current'], data);
      queryClient.invalidateQueries({ queryKey: ['predictions'] });
      toast.success(`Saved ${data.predictions.length} strategies for the next draw`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Generation failed');
      // A 409 means someone else already generated — show what actually exists.
      queryClient.invalidateQueries({ queryKey: ['prediction-current'] });
    },
  });
}

/** History grouped by draw — one entry per draw, not one per strategy record. */
export function usePredictionHistory(page = 1) {
  return useQuery({
    queryKey: ['predictions', page] as const,
    queryFn: () =>
      apiFetch<Paginated<DrawHistoryEntry>>(`/api/predictions/history${queryString({ page })}`),
  });
}

export function useDeletePrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/predictions/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete prediction');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions'] });
      // Deleting every record for the upcoming draw re-enables Generate.
      queryClient.invalidateQueries({ queryKey: ['prediction-current'] });
      toast.success('Prediction deleted');
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not delete'),
  });
}
