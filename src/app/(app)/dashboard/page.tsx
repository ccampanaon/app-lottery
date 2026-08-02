import type { Metadata } from 'next';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { PageHeader } from '@/components/layout/PageHeader';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Frequency, distribution and recent draws across the published history."
      />
      <DashboardView />
    </>
  );
}
