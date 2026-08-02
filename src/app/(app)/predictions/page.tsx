import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { PredictionsView } from '@/components/predictions/PredictionsView';

export const metadata: Metadata = { title: 'Predictions' };

export default function PredictionsPage() {
  return (
    <>
      <PageHeader
        title="Predictions"
        description="Generate number sets from historical patterns and save them against the next draw."
      />
      <PredictionsView />
    </>
  );
}
