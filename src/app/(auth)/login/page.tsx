import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="bg-primary text-primary-foreground mx-auto flex size-12 items-center justify-center rounded-full text-lg font-bold">
            PB
          </div>
          <h1 className="mt-4 text-2xl font-semibold">Powerball Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Sign in to continue</p>
        </div>

        <div className="bg-card border-border rounded-lg border p-6 shadow-lg">
          {/* useSearchParams needs a Suspense boundary to keep the page static. */}
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
