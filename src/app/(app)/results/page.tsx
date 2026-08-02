import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/PageHeader';
import { DrawsTable } from '@/components/draws/DrawsTable';

export const metadata: Metadata = { title: 'Previous Results' };

export default function ResultsPage() {
  return (
    <>
      <PageHeader
        title="Previous Results"
        description="Every published draw since the 69/26 matrix began on 7 October 2015, read live from NY open data."
      />
      <DrawsTable />
    </>
  );
}
